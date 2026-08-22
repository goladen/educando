import React, { useState, useEffect, useRef, useCallback } from 'react';
import { db } from './firebase';
import { doc, getDoc, addDoc, collection } from 'firebase/firestore';
import correctSoundFile from './assets/correct-choice-43861.mp3';
import wrongSoundFile from './assets/negative_beeps-6008.mp3';
import winSoundFile from './assets/applause-small-audience-97257.mp3';
import pikaSprite from './assets/pikatron-sprite2.png';
import problemasData from './data/problemasSistemas.json';
import { guardarRegistroLocal } from './utils/registrosLocales';

// ─── Progreso local (localStorage) del modo Problemas ─────────────────────────
const PROG_KEY = 'pikt_sistemas_problemas_v1';
const loadProgreso = () => {
  try {
    const raw = localStorage.getItem(PROG_KEY);
    const o = raw ? JSON.parse(raw) : {};
    return { solved: Array.isArray(o.solved) ? o.solved : [], correctCount: Number(o.correctCount) || 0 };
  } catch {
    return { solved: [], correctCount: 0 };
  }
};
const saveProgreso = (p) => { try { localStorage.setItem(PROG_KEY, JSON.stringify(p)); } catch { /* silencioso */ } };

// Adaptamos los problemas de enunciado al formato que usa SolverPanel
const PROBLEMAS = problemasData.map((p) => ({
  ...p,
  type: 'problemas',
  title: p.titulo,
  variables: ['x', 'y'],
  answers: p.solucion,
  steps: p.pasos,
}));

// ─── Sonidos (mismos archivos que Ecuaciones / CazaBurbujas) ──────────────────
const playSound = (type) => {
  try {
    let file = null;
    if (type === 'correct') file = correctSoundFile;
    else if (type === 'incorrect') file = wrongSoundFile;
    else if (type === 'win') file = winSoundFile;
    if (!file) return;
    const audio = new Audio(file);
    audio.volume = 0.6;
    audio.play().catch(() => {});
    if (type === 'correct') setTimeout(() => { audio.pause(); audio.currentTime = 0; }, 1500);
  } catch (e) { /* noop */ }
};

// ─── Paleta ────────────────────────────────────────────────────────────────────
const colors = {
  gradientHeader: 'linear-gradient(135deg, #6c5ce7, #a29bfe)',
  accentBlue: '#74b9ff',
  neonGreen: '#2ed573',
  neonRed: '#ff4757',
  darkCard: '#2f3542',
  bgApp: '#f1f2f6',
  white: '#ffffff',
  textDark: '#2f3542',
  warnYellow: '#ffa502',
};

// ─── Banco de problemas ──────────────────────────────────────────────────────
const problems = {
  visual: [
    {
      id: 'v1',
      title: 'Reto Ropa Gamer 👕',
      type: 'visual',
      items: { x: { label: 'Camiseta Molona 👕', value: 5 }, y: { label: 'Collar Amuleto 📿', value: 3 } },
      equationsText: ['👕 + 📿 + 👕 = 13', '📿 + 📿 + 👕 = 11'],
      questionText: '¡Deduce el poder de cada objeto para activar el combo!',
      variables: ['x', 'y'],
      steps: [
        '⚡ Paso 1: Simplificamos las ecuaciones visuales.\nFila 1: 2 Camisetas 👕 + 1 Collar 📿 = 13\nFila 2: 1 Camiseta 👕 + 2 Collares 📿 = 11',
        '⚡ Paso 2: Despejamos la Camiseta de la segunda fila:\nCamiseta = 11 - 2 Collares.',
        '⚡ Paso 3: Sustituimos en la primera fila:\n2 * (11 - 2 Collares) + Collar = 13\n22 - 4 Collares + Collar = 13\n22 - 3 Collares = 13',
        '⚡ Paso 4: Despejamos el valor del Collar:\n3 Collares = 9  =>  Collar 📿 = 3.',
        '⚡ Paso 5: ¡Calculamos la Camiseta con el valor obtenido!\nCamiseta 👕 = 11 - 2 * (3) = 5.',
      ],
    },
    {
      id: 'v2',
      title: 'Poder Saludable 🥗',
      type: 'visual',
      items: { x: { label: 'Súper Ensalada 🥗', value: 6 }, y: { label: 'Mega Zanahoria 🥕', value: 4 } },
      equationsText: ['🥗 + 🥗 + 🥗 = 18', '🥕 + 🥕 + 🥗 = 14'],
      questionText: '¿Cuánto vale cada alimento del menú energético?',
      variables: ['x', 'y'],
      steps: [
        '⚡ Paso 1: En la primera fila tienes 3 ensaladas iguales que suman 18.\nAsí que cada Ensalada 🥗 = 18 / 3 = 6.',
        '⚡ Paso 2: Mira la segunda fila sabiendo que la ensalada vale 6:\nZanahoria + Zanahoria + 6 = 14',
        '⚡ Paso 3: Agrupamos las zanahorias:\n2 🥕 + 6 = 14  =>  2 🥕 = 14 - 6  =>  2 🥕 = 8.',
        '⚡ Paso 4: Dividimos para hallar una unidad:\nZanahoria 🥕 = 8 / 2 = 4.',
      ],
    },
  ],
  '2x2': [
    {
      id: '2x2_1',
      title: 'Misión Crítica 2x2: Despeje Rápido',
      type: '2x2',
      eq1: { x: 2, y: 1, c: 7 },
      eq2: { x: 1, y: -1, c: 2 },
      variables: ['x', 'y'],
      answers: { x: 3, y: 1 },
      steps: {
        reduccion: [
          '🔥 Reducción Paso 1: Alineamos los sistemas:\n(1) 2x + y = 7\n(2) x - y = 2',
          '🔥 Reducción Paso 2: ¡Fíjate en las "y"! Son totalmente opuestas (+1 y -1), así que sumamos las dos filas directamente:\n(2x + x) = 7 + 2\n3x = 9',
          '🔥 Reducción Paso 3: Despejamos la x:\nx = 9 / 3 = 3.',
          '🔥 Reducción Paso 4: Volvemos a la ecuación (2) y metemos el valor de x:\n3 - y = 2  =>  -y = 2 - 3  =>  y = 1.\n¡Conseguido! (x=3, y=1)',
        ],
        sustitucion: [
          '💎 Sustitución Paso 1: Despejamos la x de la ecuación (2) por ser más fácil:\nx = 2 + y',
          '💎 Sustitución Paso 2: Inyectamos este valor de x dentro de la primera ecuación:\n2 * (2 + y) + y = 7',
          '💎 Sustitución Paso 3: Rompemos los paréntesis operando:\n4 + 2y + y = 7\n4 + 3y = 7  =>  3y = 3  =>  y = 1.',
          '💎 Sustitución Paso 4: Hallamos x usando nuestro despeje inicial:\nx = 2 + (1) = 3.',
        ],
      },
    },
    {
      id: '2x2_2',
      title: 'Sistema 2x2: Doble Reducción',
      type: '2x2',
      eq1: { x: 3, y: 2, c: 16 },
      eq2: { x: 2, y: -1, c: 6 },
      variables: ['x', 'y'],
      answers: { x: 4, y: 2 },
      steps: {
        reduccion: [
          '🔥 Reducción Paso 1: Escribimos el sistema:\n(1) 3x + 2y = 16\n(2) 2x - y = 6',
          '🔥 Reducción Paso 2: Multiplicamos la (2) por 2 para tener +2y y -2y:\n(2\') 4x - 2y = 12',
          '🔥 Reducción Paso 3: Sumamos (1) + (2\') y desaparece la y:\n7x = 28  =>  x = 4.',
          '🔥 Reducción Paso 4: Sustituimos en (2): 2·4 - y = 6  =>  8 - y = 6  =>  y = 2.\n¡Resuelto! (x=4, y=2)',
        ],
        sustitucion: [
          '💎 Sustitución Paso 1: Despejamos la y en (2) por ser la más sencilla:\ny = 2x - 6',
          '💎 Sustitución Paso 2: Sustituimos en (1):\n3x + 2(2x - 6) = 16',
          '💎 Sustitución Paso 3: Operamos:\n3x + 4x - 12 = 16  =>  7x = 28  =>  x = 4.',
          '💎 Sustitución Paso 4: y = 2·4 - 6 = 2.\n¡Resuelto! (x=4, y=2)',
        ],
      },
    },
  ],
  // Sistemas 2x2 con denominadores (nivel complejo)
  '2x2c': [
    {
      id: '2x2c_1',
      title: 'Fracciones Nivel Pro: m.c.m.',
      type: '2x2c',
      eqDisplay: ['x/2 + y/3 = 4', 'x - y = 3'],
      variables: ['x', 'y'],
      answers: { x: 6, y: 3 },
      steps: {
        reduccion: [
          '🧩 Reducción Paso 1: La (1) tiene denominadores 2 y 3. Multiplicamos TODA la ecuación por su m.c.m. = 6:\n6·(x/2) + 6·(y/3) = 6·4  =>  3x + 2y = 24.',
          '🧩 Reducción Paso 2: Sistema equivalente ya sin fracciones:\n(1\') 3x + 2y = 24\n(2)  x - y = 3',
          '🧩 Reducción Paso 3: Multiplicamos la (2) por 2 para igualar las "y":\n(2\') 2x - 2y = 6. Sumamos (1\') + (2\'):\n5x = 30  =>  x = 6.',
          '🧩 Reducción Paso 4: Sustituimos en (2): 6 - y = 3  =>  y = 3.\n¡Fracciones domadas! (x=6, y=3)',
        ],
        sustitucion: [
          '💎 Sustitución Paso 1: Quitamos denominadores en (1) × 6:\n3x + 2y = 24.',
          '💎 Sustitución Paso 2: Despejamos x en la (2):\nx = y + 3.',
          '💎 Sustitución Paso 3: Sustituimos:\n3(y + 3) + 2y = 24  =>  3y + 9 + 2y = 24  =>  5y = 15  =>  y = 3.',
          '💎 Sustitución Paso 4: x = 3 + 3 = 6.\n¡Resuelto! (x=6, y=3)',
        ],
      },
    },
    {
      id: '2x2c_2',
      title: 'Fracciones Nivel Pro: Cuartos',
      type: '2x2c',
      eqDisplay: ['x/4 + y/2 = 4', '2x - y = 2'],
      variables: ['x', 'y'],
      answers: { x: 4, y: 6 },
      steps: {
        reduccion: [
          '🧩 Reducción Paso 1: Multiplicamos la (1) por el m.c.m. de 4 y 2, que es 4:\n4·(x/4) + 4·(y/2) = 4·4  =>  x + 2y = 16.',
          '🧩 Reducción Paso 2: Sistema sin fracciones:\n(1\') x + 2y = 16\n(2)  2x - y = 2',
          '🧩 Reducción Paso 3: Multiplicamos la (2) por 2:\n(2\') 4x - 2y = 4. Sumamos (1\') + (2\'):\n5x = 20  =>  x = 4.',
          '🧩 Reducción Paso 4: En (2): 2·4 - y = 2  =>  8 - y = 2  =>  y = 6.\n¡Resuelto! (x=4, y=6)',
        ],
        sustitucion: [
          '💎 Sustitución Paso 1: Quitamos denominadores en (1) × 4:\nx + 2y = 16.',
          '💎 Sustitución Paso 2: Despejamos y en (2):\ny = 2x - 2.',
          '💎 Sustitución Paso 3: Sustituimos:\nx + 2(2x - 2) = 16  =>  x + 4x - 4 = 16  =>  5x = 20  =>  x = 4.',
          '💎 Sustitución Paso 4: y = 2·4 - 2 = 6.\n¡Resuelto! (x=4, y=6)',
        ],
      },
    },
    {
      id: '2x2c_3',
      title: 'Fracciones Nivel Pro: Doble denominador',
      type: '2x2c',
      eqDisplay: ['x/4 + y/2 = 3', 'x/2 - y = 2'],
      variables: ['x', 'y'],
      answers: { x: 8, y: 2 },
      steps: {
        reduccion: [
          '🧩 Reducción Paso 1: Quitamos denominadores en las dos ecuaciones:\n(1) × 4  =>  x + 2y = 12\n(2) × 2  =>  x - 2y = 4.',
          '🧩 Reducción Paso 2: Sistema equivalente:\n(1\') x + 2y = 12\n(2\') x - 2y = 4',
          '🧩 Reducción Paso 3: Sumamos (1\') + (2\') y las "y" se anulan:\n2x = 16  =>  x = 8.',
          '🧩 Reducción Paso 4: En (1\'): 8 + 2y = 12  =>  2y = 4  =>  y = 2.\n¡Resuelto! (x=8, y=2)',
        ],
        sustitucion: [
          '💎 Sustitución Paso 1: Quitamos denominadores:\n(1) × 4  =>  x + 2y = 12\n(2) × 2  =>  x - 2y = 4.',
          '💎 Sustitución Paso 2: Despejamos x en la (2\'):\nx = 4 + 2y.',
          '💎 Sustitución Paso 3: Sustituimos en (1\'):\n(4 + 2y) + 2y = 12  =>  4 + 4y = 12  =>  4y = 8  =>  y = 2.',
          '💎 Sustitución Paso 4: x = 4 + 2·2 = 8.\n¡Resuelto! (x=8, y=2)',
        ],
      },
    },
  ],
  '3x3': [
    {
      id: '3x3_1',
      title: 'Nivel Épico 3x3: Algoritmo de Gauss',
      type: '3x3',
      eq1: { x: 1, y: 1, z: 1, c: 6 },
      eq2: { x: 1, y: -1, z: 2, c: 5 },
      eq3: { x: 2, y: 1, z: -1, c: 1 },
      variables: ['x', 'y', 'z'],
      answers: { x: 1, y: 2, z: 3 },
      steps: [
        '🔮 Matriz Inicial de Gauss:\n[ 1   1   1 | 6 ]\n[ 1  -1   2 | 5 ]\n[ 2   1  -1 | 1 ]',
        '🔮 Paso 1: Hacemos ceros en la primera columna usando la Fila 1.\nFila 2 = Fila 2 - Fila 1  => [ 0  -2   1 | -1 ]\nFila 3 = Fila 3 - 2*Fila 1 => [ 0  -1  -3 | -11 ]',
        '🔮 Paso 2: Eliminamos la variable "y" en la Fila 3 para hacer el triángulo.\nMultiplicamos Fila 3 por 2 y le restamos la Fila 2 (2*F3 - F2):\nNueva Fila 3 => [ 0   0  -7 | -21 ]',
        '🔮 Paso 3: Reconstruimos el sistema triangular:\n1) x + y + z = 6\n2) -2y + z = -1\n3) -7z = -21',
        '🔮 Paso 4: Despeje en cascada hacia arriba:\nDe 3) z = -21 / -7 = 3\nDe 2) -2y + 3 = -1  => -2y = -4  => y = 2\nDe 1) x + 2 + 3 = 6  => x = 1.\n🚀 ¡Sistema hackeado!',
      ],
    },
  ],
  problemas: PROBLEMAS,
};

// ─── Generador aleatorio de sistemas 2x2 ──────────────────────────────────────
const rInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const rNonZero = (min, max) => { let v = 0; while (v === 0) v = rInt(min, max); return v; };

// Formateadores de términos para los pasos
const fx = (a) => (a === 1 ? 'x' : a === -1 ? '-x' : `${a}x`);
const fy = (b) => {
  const s = b >= 0 ? '+' : '-';
  const ab = Math.abs(b);
  return `${s} ${ab === 1 ? 'y' : `${ab}y`}`;
};
const eqStr = (a, b, c) => `${fx(a)} ${fy(b)} = ${c}`;

// Configuración de dificultad del generador 2x2
const DIF_CONFIG = {
  facil:   { xy: [0, 3],   coef: [1, 6],    soloPos: true },   // solo positivos, soluciones 0..3
  medio:   { xy: [-5, 5],  coef: [-9, 9] },
  dificil: { xy: [-8, 8],  coef: [-15, 15] },
};
const DIFICULTADES = [
  { id: 'facil', label: '🟢 Fácil', color: '#2ecc71' },
  { id: 'medio', label: '🟡 Medio', color: '#f39c12' },
  { id: 'dificil', label: '🔴 Difícil', color: '#e74c3c' },
];

const generarSistema2x2 = (dif = 'facil') => {
  const cfg = DIF_CONFIG[dif] || DIF_CONFIG.facil;
  const [xyMin, xyMax] = cfg.xy;
  const [cMin, cMax] = cfg.coef;
  const randCoef = cfg.soloPos ? () => rInt(Math.max(1, cMin), cMax) : () => rNonZero(cMin, cMax);

  let x, y;
  do { x = rInt(xyMin, xyMax); y = rInt(xyMin, xyMax); } while (x === 0 && y === 0);

  let a1, b1, a2, b2;
  // 4 coeficientes según dificultad, con solución única (determinante ≠ 0)
  do {
    a1 = randCoef(); b1 = randCoef();
    a2 = randCoef(); b2 = randCoef();
  } while (a1 * b2 - a2 * b1 === 0);
  const c1 = a1 * x + b1 * y;
  const c2 = a2 * x + b2 * y;

  // Pasos por REDUCCIÓN (eliminando la x)
  const r1x = a1 * a2, r1y = b1 * a2, r1c = c1 * a2; // (1) × a2
  const r2y = b2 * a1, r2c = c2 * a1;                // (2) × a1
  const coefY = r1y - r2y;      // (b1·a2 − b2·a1)
  const indY = r1c - r2c;       // (c1·a2 − c2·a1)
  const reduccion = [
    `🔥 Reducción Paso 1: Escribimos el sistema:\n(1) ${eqStr(a1, b1, c1)}\n(2) ${eqStr(a2, b2, c2)}`,
    `🔥 Reducción Paso 2: Para eliminar la x igualamos sus coeficientes.\nMultiplicamos (1)×${a2} y (2)×${a1}:\n(1') ${eqStr(r1x, r1y, r1c)}\n(2') ${eqStr(r1x, r2y, r2c)}`,
    `🔥 Reducción Paso 3: Restamos (1') − (2') y la x desaparece:\n(${r1y} − ${r2y})y = ${r1c} − ${r2c}\n${coefY}y = ${indY}\ny = ${indY} / ${coefY} = ${y}`,
    `🔥 Reducción Paso 4: Sustituimos y = ${y} en (1):\n${fx(a1)} ${fy(b1)}·(${y}) = ${c1}\n${a1}x = ${c1} − (${b1 * y}) = ${c1 - b1 * y}\nx = ${x}.\n¡Resuelto! (x=${x}, y=${y})`,
  ];

  // Pasos por SUSTITUCIÓN (despejando x en la (1))
  const sustitucion = [
    `💎 Sustitución Paso 1: Despejamos x en la (1):\n${a1}x = ${c1} ${fy(-b1)}\nx = (${c1} − ${b1}y) / ${a1}`,
    `💎 Sustitución Paso 2: Sustituimos esa x en la (2):\n${a2}·(${c1} − ${b1}y)/${a1} ${fy(b2)} = ${c2}`,
    `💎 Sustitución Paso 3: Multiplicamos todo por ${a1} y agrupamos las y:\n${a2}(${c1} − ${b1}y) + ${a1 * b2}y = ${a1 * c2}\n(${a1 * b2 - a2 * b1})y = ${a1 * c2 - a2 * c1}\ny = ${y}`,
    `💎 Sustitución Paso 4: Con y = ${y} hallamos x = (${c1} − ${b1}·${y})/${a1} = ${x}.\n¡Resuelto! (x=${x}, y=${y})`,
  ];

  const difLabel = (DIFICULTADES.find(d => d.id === dif) || {}).label || '';
  return {
    id: 'gen2x2', title: `Sistema 2x2 ${difLabel} 🎲`, type: '2x2',
    eq1: { x: a1, y: b1, c: c1 }, eq2: { x: a2, y: b2, c: c2 },
    variables: ['x', 'y'], answers: { x, y },
    steps: { reduccion, sustitucion },
  };
};

// Modos que se generan al vuelo en vez de usar banco estático
const GENERADORES = { '2x2': generarSistema2x2 };

const MODES = [
  { id: 'visual', label: '🖼️ Retos Visuales' },
  { id: '2x2', label: '⚡ Sistemas 2x2' },
  { id: '2x2c', label: '🧩 2x2 con Fracciones' },
  { id: '3x3', label: '🔮 Matrices 3x3 (Gauss)' },
  { id: 'grafico', label: '📈 Método Gráfico' },
  { id: 'problemas', label: '📖 Problemas' },
];

// Etiquetas legibles para el informe al profesor
const TIPO_LABEL = {
  visual: 'Retos visuales',
  '2x2': 'Sistemas 2x2',
  '2x2c': 'Sistemas 2x2 con fracciones',
  '3x3': 'Matrices 3x3 (Gauss)',
  grafico: 'Método gráfico',
  problemas: 'Problemas de enunciado',
};
const DIF_LABEL = { facil: 'Fácil', medio: 'Medio', dificil: 'Difícil' };

// ─── Estilos compartidos ──────────────────────────────────────────────────────
const makeStyles = (isMobile, isCanvasOpen) => ({
  container: {
    fontFamily: '"Comfortaa", "Nunito", "Segoe UI", sans-serif',
    maxWidth: '1200px',
    margin: '0 auto',
    padding: isMobile ? '10px' : '20px',
    backgroundColor: colors.bgApp,
    borderRadius: '24px',
    minHeight: '100vh',
    boxSizing: 'border-box',
  },
  header: {
    background: colors.gradientHeader,
    padding: '20px 15px',
    borderRadius: '20px',
    textAlign: 'center',
    color: colors.white,
    marginBottom: '20px',
    boxShadow: '0 8px 16px rgba(108,92,231,0.2)',
    position: 'relative',
  },
  title: { margin: 0, fontSize: isMobile ? '22px' : '32px', fontWeight: '800', letterSpacing: '0.5px' },
  subtitle: { margin: '6px 0 0 0', fontSize: isMobile ? '13px' : '16px', opacity: 0.9 },
  navTabs: {
    display: 'flex',
    flexDirection: isMobile ? 'column' : 'row',
    gap: '10px',
    marginBottom: '15px',
    justifyContent: 'center',
    flexWrap: 'wrap',
  },
  tabButton: (isActive) => ({
    padding: '14px 20px',
    fontSize: '15px',
    fontWeight: 'bold',
    cursor: 'pointer',
    backgroundColor: isActive ? '#6c5ce7' : colors.white,
    color: isActive ? colors.white : '#6c5ce7',
    border: '3px solid #6c5ce7',
    borderRadius: '16px',
    transition: 'all 0.2s ease',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    boxShadow: isActive ? '0 6px 12px rgba(108,92,231,0.3)' : '0 2px 4px rgba(0,0,0,0.05)',
  }),
  subNavTabs: {
    display: 'flex',
    gap: '8px',
    backgroundColor: '#dfe4ea',
    padding: '6px',
    borderRadius: '12px',
    maxWidth: '100%',
    margin: '0 auto 20px auto',
  },
  subTabButton: (isActive) => ({
    flex: 1,
    padding: '10px 12px',
    fontSize: '13px',
    fontWeight: 'bold',
    cursor: 'pointer',
    backgroundColor: isActive ? '#6c5ce7' : 'transparent',
    color: isActive ? colors.white : '#57606f',
    border: 'none',
    borderRadius: '10px',
    transition: 'all 0.2s ease',
  }),
  mainGrid: {
    display: 'flex',
    flexDirection: (isMobile || !isCanvasOpen) ? 'column' : 'row',
    gap: '20px',
    alignItems: 'stretch',
  },
  card: {
    backgroundColor: colors.white,
    padding: isMobile ? '16px' : '24px',
    borderRadius: '20px',
    boxShadow: '0 10px 20px rgba(0,0,0,0.05)',
    flex: 1,
    border: '2px solid #e4e7eb',
  },
  equationBox: {
    background: 'linear-gradient(135deg, #2f3542, #1e222b)',
    color: '#2ed573',
    fontFamily: '"Courier New", Courier, monospace',
    padding: '20px',
    borderRadius: '16px',
    textAlign: 'center',
    fontSize: isMobile ? '20px' : '28px',
    fontWeight: 'bold',
    margin: '20px 0',
    boxShadow: 'inset 0 4px 10px rgba(0,0,0,0.3)',
    borderLeft: '6px solid #2ed573',
    lineHeight: '1.6',
  },
  inputSection: {
    marginTop: '20px',
    backgroundColor: '#f1f2f6',
    padding: '16px',
    borderRadius: '16px',
    border: '1px solid #ced4da',
  },
  inputGroup: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '10px',
    marginBottom: '12px',
    fontSize: '16px',
    fontWeight: 'bold',
  },
  inputField: {
    width: '90px',
    padding: '10px',
    fontSize: '18px',
    textAlign: 'center',
    borderRadius: '12px',
    border: '3px solid #ced4da',
    backgroundColor: colors.white,
    color: colors.textDark,
    outline: 'none',
    transition: 'border-color 0.2s',
    fontWeight: 'bold',
  },
  buttonAction: (bg, shadowColor) => ({
    padding: '14px 22px',
    fontSize: '15px',
    fontWeight: '800',
    color: colors.white,
    backgroundColor: bg,
    border: 'none',
    borderRadius: '14px',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    boxShadow: `0 5px 0px ${shadowColor}`,
    marginBottom: '5px',
    transition: 'transform 0.1s',
    flex: isMobile ? '1 1 100%' : 'initial',
  }),
  feedbackBanner: (type) => ({
    padding: '16px',
    borderRadius: '14px',
    marginTop: '20px',
    fontSize: '15px',
    fontWeight: 'bold',
    textAlign: 'center',
    backgroundColor: type === 'correct' ? '#e1f7ec' : '#ffebeb',
    color: type === 'correct' ? colors.neonGreen : colors.neonRed,
    border: `2px solid ${type === 'correct' ? colors.neonGreen : colors.neonRed}`,
  }),
  stepsBox: {
    marginTop: '20px',
    padding: '16px',
    backgroundColor: '#fffaf0',
    color: '#b7791f',
    borderRadius: '16px',
    border: '2px solid #fbd38d',
    lineHeight: '1.6',
    fontSize: '14px',
  },
  canvasContainer: {
    backgroundColor: colors.white,
    padding: '16px',
    borderRadius: '20px',
    boxShadow: '0 10px 20px rgba(0,0,0,0.05)',
    border: '3px dashed #6c5ce7',
    flex: isMobile ? 'initial' : '0 0 420px',
    display: isCanvasOpen ? 'block' : 'none',
    width: '100%',
    boxSizing: 'border-box',
  },
  canvasArea: {
    backgroundColor: '#f8f9fa',
    border: '2px solid #dfe4ea',
    borderRadius: '14px',
    cursor: 'crosshair',
    touchAction: 'none',
    width: '100%',
    height: '320px',
  },
});

// ─── Panel resolutor reutilizable (usado en modo simple y dual) ────────────────
function SolverPanel({ mode, subMode, isMobile, compact = false, panelLabel = null, panelColor = '#6c5ce7', difficulty = 'facil', reportar = null, competitivo = false, onResultado = null, bloqueado = false }) {
  const styles = makeStyles(isMobile, false);
  const gen = GENERADORES[mode];            // generador aleatorio (si el modo lo tiene)
  const bank = problems[mode] || [];
  const idxRef = useRef(0);
  const [currentProblem, setCurrentProblem] = useState(() => (gen ? gen(difficulty) : bank[0]));
  const [userAnswers, setUserAnswers] = useState({});
  const [feedback, setFeedback] = useState(null);
  const [showSteps, setShowSteps] = useState(false);
  const [terminal, setTerminal] = useState(null); // null | 'acierto' | 'revelado' → estado final del ejercicio actual
  const [progreso, setProgreso] = useState(loadProgreso); // { solved:[ids], correctCount }

  // Informa al componente principal de un ejercicio terminado (para el informe al profesor)
  const informar = (resultado) => {
    if (typeof reportar === 'function') {
      reportar({
        modo: mode,
        dificultad: gen ? difficulty : null,
        resultado, // 'acierto' | 'revelado'
        problemaId: currentProblem.id,
      });
    }
  };

  const siguienteProblema = () => {
    if (gen) {
      setCurrentProblem(gen(difficulty));
    } else {
      idxRef.current = (idxRef.current + 1) % bank.length;
      setCurrentProblem(bank[idxRef.current]);
    }
  };

  const irAProblema = (i) => {
    idxRef.current = i;
    setCurrentProblem(bank[i]);
  };

  // Al cambiar de problema, limpiamos respuestas, feedback, pasos y estado final
  useEffect(() => {
    setUserAnswers({});
    setFeedback(null);
    setShowSteps(false);
    setTerminal(null);
  }, [currentProblem]);

  const esProblema = mode === 'problemas';

  // Mostrar la solución bloquea la respuesta: el ejercicio cuenta como "visto sin resolver"
  const revelarSolucion = () => {
    if (!terminal) { setTerminal('revelado'); informar('revelado'); }
    setShowSteps(true);
  };

  const handleCheckAnswers = () => {
    if (terminal || bloqueado) return; // ya resuelto, solución revelada o partida terminada
    let isCorrect = true;
    if (currentProblem.type === 'visual') {
      Object.keys(currentProblem.items).forEach((varKey) => {
        if (parseInt(userAnswers[varKey]) !== currentProblem.items[varKey].value) isCorrect = false;
      });
    } else if (esProblema) {
      // Los problemas pueden tener solución decimal → comparamos con tolerancia
      currentProblem.variables.forEach((v) => {
        const val = parseFloat((userAnswers[v] || '').toString().replace(',', '.'));
        if (isNaN(val) || Math.abs(val - currentProblem.answers[v]) > 0.05) isCorrect = false;
      });
    } else {
      currentProblem.variables.forEach((v) => {
        if (parseInt(userAnswers[v]) !== currentProblem.answers[v]) isCorrect = false;
      });
    }
    // ── Modo competición (tirón de cuerda): cada respuesta resuelve el turno y avanza ──
    if (competitivo) {
      if (isCorrect) { setFeedback('correct'); playSound('correct'); if (esProblema) registrarAcierto(); }
      else { setFeedback('incorrect'); playSound('incorrect'); }
      if (typeof onResultado === 'function') onResultado(isCorrect);
      setTimeout(() => { setFeedback(null); siguienteProblema(); }, 700);
      return;
    }

    if (isCorrect) {
      setFeedback('correct');
      playSound('correct');
      setTerminal('acierto');
      informar('acierto');
      if (esProblema) registrarAcierto();
    } else {
      setFeedback('incorrect');
      playSound('incorrect');
    }
  };

  // Guarda el progreso en el dispositivo cuando se resuelve bien un problema
  const registrarAcierto = () => {
    setProgreso((prev) => {
      const yaResuelto = prev.solved.includes(currentProblem.id);
      const solved = yaResuelto ? prev.solved : [...prev.solved, currentProblem.id];
      const next = { solved, correctCount: prev.correctCount + 1 };
      saveProgreso(next);
      // La primera vez que se resuelve un problema, lo anotamos en "Mis registros"
      if (!yaResuelto) {
        guardarRegistroLocal('ECUACION_SISTEMAS', {
          titulo: currentProblem.titulo || currentProblem.title,
          aciertos: 1, intentos: 1, porcentaje: 100, via: 'problema',
        });
      }
      return next;
    });
  };

  const hasSubSteps = mode === '2x2' || mode === '2x2c';

  return (
    <div style={{ ...styles.card, ...(compact ? { padding: isMobile ? '12px' : '16px' } : {}) }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', flexWrap: 'wrap', gap: '10px' }}>
        <span style={{ backgroundColor: panelColor, color: 'white', padding: '6px 12px', borderRadius: '10px', fontSize: '12px', fontWeight: 'bold' }}>
          {panelLabel ? `${panelLabel} · ${currentProblem.title}` : currentProblem.title}
        </span>
        <button
          style={{ background: '#ffa502', border: 'none', padding: '8px 14px', borderRadius: '10px', color: 'white', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 3px 0 #d68902' }}
          onClick={siguienteProblema}
        >
          {esProblema ? 'Siguiente Problema ➡️' : 'Siguiente Nivel ➡️'}
        </button>
      </div>

      <p style={{ fontSize: '15px', color: '#57606f', fontWeight: '600', margin: '10px 0' }}>
        {mode === 'visual'
          ? currentProblem.questionText
          : esProblema
            ? '📖 Lee el problema, plantea el sistema y halla las dos incógnitas:'
            : '¡Consigue resolver el sistema! Usa el bloc de notas si lo necesitas:'}
      </p>

      {/* Marcador de progreso (guardado en el dispositivo) */}
      {esProblema && (() => {
        const total = bank.length;
        const resueltos = progreso.solved.length;
        const pct = total > 0 ? Math.round((resueltos / total) * 100) : 0;
        return (
          <div style={{ background: '#f8f9ff', border: '2px solid #e4e7fb', borderRadius: '16px', padding: '12px 14px', margin: '4px 0 14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginBottom: '8px' }}>
              <span style={{ fontWeight: 800, color: '#4b3db3', fontSize: '14px' }}>
                🏆 Resueltos: {resueltos}/{total}
              </span>
              <span style={{ fontSize: '12px', color: '#57606f', fontWeight: 700 }}>
                ✅ Ejercicios hechos bien: {progreso.correctCount}
              </span>
            </div>
            <div style={{ height: '10px', background: '#e4e7fb', borderRadius: '6px', overflow: 'hidden', marginBottom: '10px' }}>
              <div style={{ height: '100%', width: `${pct}%`, background: 'linear-gradient(90deg,#6c5ce7,#a29bfe)', transition: 'width 0.3s' }} />
            </div>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {bank.map((p, i) => {
                const done = progreso.solved.includes(p.id);
                const actual = p.id === currentProblem.id;
                return (
                  <button key={p.id} onClick={() => irAProblema(i)} title={p.titulo}
                    style={{ width: '30px', height: '30px', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: 800,
                      border: actual ? '3px solid #2f3542' : '2px solid transparent',
                      background: done ? '#2ed573' : '#dfe4ea', color: done ? 'white' : '#57606f' }}>
                    {done ? '✓' : i + 1}
                  </button>
                );
              })}
            </div>
            {resueltos > 0 && (
              <button
                onClick={() => { const next = { solved: [], correctCount: 0 }; setProgreso(next); saveProgreso(next); }}
                style={{ marginTop: '10px', background: 'transparent', border: 'none', color: '#a4b0be', fontSize: '11px', cursor: 'pointer', textDecoration: 'underline' }}>
                Reiniciar progreso
              </button>
            )}
          </div>
        );
      })()}

      {/* Enunciado (modo problemas) o sistema de ecuaciones */}
      {esProblema ? (
        <div style={{ background: '#eef2ff', border: '2px solid #c7d2fe', borderLeft: '6px solid #6c5ce7',
          borderRadius: '16px', padding: '16px 18px', margin: '14px 0', fontSize: isMobile ? '15px' : '17px',
          lineHeight: 1.55, color: '#2f3542', fontWeight: 600 }}>
          {currentProblem.enunciado}
        </div>
      ) : (
      <div style={styles.equationBox}>
        {mode === 'visual' && currentProblem.equationsText.map((eq, i) => (
          <div key={i} style={{ padding: '4px 0' }}>{eq}</div>
        ))}

        {mode === '2x2c' && currentProblem.eqDisplay.map((eq, i) => (
          <div key={i} style={{ padding: '4px 0' }}>{eq}</div>
        ))}

        {mode === '2x2' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <div>{currentProblem.eq1.x}x {currentProblem.eq1.y >= 0 ? `+ ${currentProblem.eq1.y}` : `${currentProblem.eq1.y}`}y = {currentProblem.eq1.c}</div>
            <div>{currentProblem.eq2.x}x {currentProblem.eq2.y >= 0 ? `+ ${currentProblem.eq2.y}` : `${currentProblem.eq2.y}`}y = {currentProblem.eq2.c}</div>
          </div>
        )}

        {mode === '3x3' && (
          <div style={{ fontSize: isMobile ? '16px' : '22px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <div>{currentProblem.eq1.x}x + {currentProblem.eq1.y}y + {currentProblem.eq1.z}z = {currentProblem.eq1.c}</div>
            <div>{currentProblem.eq2.x}x + ({currentProblem.eq2.y})y + {currentProblem.eq2.z}z = {currentProblem.eq2.c}</div>
            <div>{currentProblem.eq3.x}x + {currentProblem.eq3.y}y + ({currentProblem.eq3.z})z = {currentProblem.eq3.c}</div>
          </div>
        )}
      </div>
      )}

      {/* Inputs */}
      <div style={styles.inputSection}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '15px' }}>
          {mode === 'visual' ? (
            Object.keys(currentProblem.items).map((key) => (
              <div key={key} style={styles.inputGroup}>
                <span style={{ color: colors.textDark }}>{currentProblem.items[key].label}:</span>
                <input type="number" style={styles.inputField} value={userAnswers[key] || ''}
                  onChange={(e) => setUserAnswers({ ...userAnswers, [key]: e.target.value })} placeholder="?" />
              </div>
            ))
          ) : (
            currentProblem.variables.map((v) => (
              <div key={v} style={{ ...styles.inputGroup, ...(esProblema ? { flexWrap: 'wrap' } : {}) }}>
                <span style={{ color: colors.textDark, fontSize: esProblema ? '15px' : '18px', textTransform: esProblema ? 'none' : 'uppercase' }}>
                  {esProblema ? `${v} = ${currentProblem.incognitas[v]}:` : `Variable ${v}:`}
                </span>
                <input type="number" step="any" style={styles.inputField} value={userAnswers[v] || ''}
                  onChange={(e) => setUserAnswers({ ...userAnswers, [v]: e.target.value })} placeholder="?" />
              </div>
            ))
          )}
        </div>

        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button
            style={{ ...styles.buttonAction((terminal || bloqueado) ? '#b2bec3' : colors.neonGreen, (terminal || bloqueado) ? '#8d99a3' : '#1b9e49'),
              cursor: (terminal || bloqueado) ? 'not-allowed' : 'pointer' }}
            onClick={handleCheckAnswers} disabled={!!terminal || bloqueado}>
            ✅ {esProblema ? 'Comprobar' : 'Validar código'}
          </button>
          {esProblema && !terminal && !competitivo && (
            <button style={styles.buttonAction('#6c5ce7', '#4b3db3')} onClick={revelarSolucion}>
              💡 Ver planteamiento y solución
            </button>
          )}
        </div>
        {terminal === 'revelado' && (
          <p style={{ margin: '10px 0 0', color: '#e67e22', fontWeight: 700, fontSize: '13px' }}>
            🔒 Has visto la solución: este ejercicio ya no se puede responder (cuenta como visto sin resolver).
          </p>
        )}
      </div>

      {feedback === 'correct' && (
        <div style={styles.feedbackBanner('correct')}>
          🎉 ¡SÚPER! {esProblema ? '¡Problema resuelto! ¡Eres un crack!' : 'Código correcto desbloqueado. ¡Eres un crack!'}
        </div>
      )}

      {feedback === 'incorrect' && (
        <div>
          <div style={styles.feedbackBanner('incorrect')}>
            👾 ¡Ups! {competitivo ? '¡Fallo! El rival tira de la cuerda.' : 'Algún parámetro falla en la matriz. Vuelve a intentarlo.'}
          </div>
          {!competitivo && (
            <button style={styles.buttonAction(colors.warnYellow, '#b37402')} onClick={revelarSolucion}>
              🔍 Desplegar Guía de Hackeo (Paso a Paso)
            </button>
          )}
        </div>
      )}

      {showSteps && (
        <div style={styles.stepsBox}>
          <h4 style={{ margin: '0 0 10px 0', fontSize: '16px', fontWeight: 'bold' }}>
            {esProblema ? '📋 Planteamiento y resolución paso a paso:' : '📋 Algoritmo de resolución guiada:'}
          </h4>

          {esProblema && (
            <div style={{ background: '#2f3542', color: '#2ed573', fontFamily: '"Courier New", monospace',
              borderRadius: '10px', padding: '10px 14px', marginBottom: '12px', borderLeft: '5px solid #2ed573' }}>
              <div style={{ color: '#a29bfe', fontSize: '12px', marginBottom: '4px' }}>Sistema de ecuaciones:</div>
              {currentProblem.sistema.map((eq, i) => (
                <div key={i} style={{ padding: '2px 0', fontSize: '16px', fontWeight: 'bold' }}>{eq}</div>
              ))}
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {(hasSubSteps ? currentProblem.steps[subMode] : currentProblem.steps).map((step, idx) => (
              <div key={idx} style={{ whiteSpace: 'pre-line', padding: '4px 0', borderBottom: '1px dashed #fbd38d' }}>{step}</div>
            ))}
          </div>

          {esProblema && (
            <div style={{ marginTop: '12px', background: '#e1f7ec', border: '2px solid #2ed573',
              borderRadius: '12px', padding: '12px 14px', color: '#1b7a45', fontWeight: 700, lineHeight: 1.5 }}>
              ✅ {currentProblem.explicacion}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Modo Gráfico: tablas de valores + plano de coordenadas ───────────────────
const G_RANGE = 7; // ejes de -7 a 7
const G_TOL = 0.01; // tolerancia para admitir decimales
// Formatea una ecuación en forma implícita: ax + by = c
const fmtImplicita = (a, b, c) => `${fx(a)} ${fy(b)} = ${c}`;
// Puntos con coordenadas enteras que están sobre la recta ax+by=c dentro del plano
const puntosEnterosDe = (a, b, c) => {
  const pts = [];
  for (let x = -G_RANGE; x <= G_RANGE; x++) {
    if (b === 0) continue;
    const y = (c - a * x) / b;
    if (Number.isInteger(y) && Math.abs(y) <= G_RANGE) pts.push({ x, y });
  }
  return pts;
};

// Genera un sistema en forma ax+by=c con intersección entera dentro del plano
const generarSistemaGrafico = () => {
  const coef = [-2, -1, 1, 2];
  let a1, b1, c1, a2, b2, c2, sx, sy, lat1, lat2;
  for (let intento = 0; intento < 400; intento++) {
    sx = rInt(-3, 3); sy = rInt(-3, 3);
    a1 = coef[rInt(0, 3)]; b1 = coef[rInt(0, 3)];
    a2 = coef[rInt(0, 3)]; b2 = coef[rInt(0, 3)];
    if (a1 * b2 - a2 * b1 === 0) continue; // rectas paralelas → sin solución única
    c1 = a1 * sx + b1 * sy; c2 = a2 * sx + b2 * sy;
    lat1 = puntosEnterosDe(a1, b1, c1);
    lat2 = puntosEnterosDe(a2, b2, c2);
    if (lat1.length >= 3 && lat2.length >= 3) break;
  }
  return { id: 'graf', title: 'Sistema gráfico 📈', a1, b1, c1, a2, b2, c2, sx, sy, lat1, lat2 };
};

function GraficoSistema({ isMobile, compact = false, panelLabel = null, panelColor = '#6c5ce7', reportar = null, competitivo = false, onResultado = null, bloqueado = false }) {
  const size = compact || isMobile ? 300 : 360;
  const scale = size / (G_RANGE * 2);
  const OX = size / 2, OY = size / 2;
  const toCanvas = (mx, my) => ({ x: OX + mx * scale, y: OY - my * scale });
  const toMath = (cx, cy) => ({ x: (cx - OX) / scale, y: (OY - cy) / scale });

  const canvasRef = useRef(null);
  const [sys, setSys] = useState(generarSistemaGrafico);
  const [valores, setValores] = useState({}); // clave `${linea}_${x}` → string
  const [puntos, setPuntos] = useState([]);    // [{x,y}] plotados por el alumno
  const [rectas, setRectas] = useState({ 1: [], 2: [] }); // 2 extremos por recta
  const [herramienta, setHerramienta] = useState('punto'); // 'punto' | 'recta1' | 'recta2'
  const [feedback, setFeedback] = useState(null); // 'correct' | 'incorrect'
  const [errores, setErrores] = useState([]);
  const [resuelto, setResuelto] = useState(false); // muestra las rectas correctas
  const [terminal, setTerminal] = useState(null);   // null | 'acierto' | 'revelado'

  const nuevo = () => {
    setSys(generarSistemaGrafico());
    setValores({}); setPuntos([]); setRectas({ 1: [], 2: [] }); setHerramienta('punto');
    setFeedback(null); setErrores([]); setResuelto(false); setTerminal(null);
  };

  const informar = (resultado) => {
    if (typeof reportar === 'function') reportar({ modo: 'grafico', dificultad: null, resultado, problemaId: sys.id });
  };

  // Dibujo del plano
  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, size, size);
    ctx.fillStyle = '#f8f9ff'; ctx.fillRect(0, 0, size, size);
    // rejilla fina a los 0,5 (precisión de clic)
    ctx.strokeStyle = '#eef0fb'; ctx.lineWidth = 0.6;
    for (let i = -G_RANGE; i <= G_RANGE - 0.5; i += 0.5) {
      if (Number.isInteger(i)) continue;
      const px = toCanvas(i, 0).x, py = toCanvas(0, i).y;
      ctx.beginPath(); ctx.moveTo(px, 0); ctx.lineTo(px, size); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, py); ctx.lineTo(size, py); ctx.stroke();
    }
    // cuadrícula entera
    ctx.strokeStyle = '#dde1f5'; ctx.lineWidth = 0.8;
    for (let i = -G_RANGE; i <= G_RANGE; i++) {
      const px = toCanvas(i, 0).x, py = toCanvas(0, i).y;
      ctx.beginPath(); ctx.moveTo(px, 0); ctx.lineTo(px, size); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, py); ctx.lineTo(size, py); ctx.stroke();
    }
    // ejes
    ctx.strokeStyle = '#2c3e50'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, OY); ctx.lineTo(size, OY); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(OX, 0); ctx.lineTo(OX, size); ctx.stroke();
    ctx.fillStyle = '#7f8c8d'; ctx.font = '10px Georgia,serif'; ctx.textAlign = 'center';
    for (let i = -G_RANGE + 1; i <= G_RANGE - 1; i++) { if (i === 0) continue; ctx.fillText(i, toCanvas(i, 0).x, OY + 13); }
    ctx.textAlign = 'right';
    for (let i = -G_RANGE + 1; i <= G_RANGE - 1; i++) { if (i === 0) continue; ctx.fillText(i, OX - 5, toCanvas(0, i).y + 4); }
    // rectas correctas (solo al resolver)
    if (resuelto) {
      [[sys.a1, sys.b1, sys.c1, '#3498db'], [sys.a2, sys.b2, sys.c2, '#e74c3c']].forEach(([a, b, c, col]) => {
        ctx.strokeStyle = col; ctx.lineWidth = 2.5;
        if (b === 0) { const p = toCanvas(c / a, -G_RANGE), q = toCanvas(c / a, G_RANGE); ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke(); }
        else { const p = toCanvas(-G_RANGE, (c - a * -G_RANGE) / b), q = toCanvas(G_RANGE, (c - a * G_RANGE) / b); ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke(); }
      });
      const s = toCanvas(sys.sx, sys.sy);
      ctx.beginPath(); ctx.arc(s.x, s.y, 7, 0, Math.PI * 2); ctx.fillStyle = '#2ecc71'; ctx.fill();
      ctx.strokeStyle = 'white'; ctx.lineWidth = 2; ctx.stroke();
    }
    // rectas trazadas por el alumno (mientras no se ha resuelto)
    if (!resuelto) {
      [[1, '#3498db'], [2, '#e74c3c']].forEach(([idx, col]) => {
        const pr = rectas[idx];
        if (!pr || pr.length === 0) return;
        // extremos marcados
        pr.forEach((p) => {
          const c = toCanvas(p.x, p.y);
          ctx.beginPath(); ctx.arc(c.x, c.y, 5, 0, Math.PI * 2); ctx.fillStyle = col; ctx.fill();
          ctx.strokeStyle = 'white'; ctx.lineWidth = 2; ctx.stroke();
        });
        if (pr.length === 2) {
          const [p, q] = pr;
          ctx.strokeStyle = col; ctx.lineWidth = 2.5;
          if (p.x === q.x) { // recta vertical (no válida para estos sistemas, pero se dibuja)
            const a = toCanvas(p.x, -G_RANGE), b = toCanvas(p.x, G_RANGE);
            ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
          } else {
            const m = (q.y - p.y) / (q.x - p.x), n = p.y - m * p.x;
            const a = toCanvas(-G_RANGE, m * -G_RANGE + n), b = toCanvas(G_RANGE, m * G_RANGE + n);
            ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
          }
        }
      });
    }
    // puntos del alumno
    puntos.forEach((p) => {
      const c = toCanvas(p.x, p.y);
      ctx.beginPath(); ctx.arc(c.x, c.y, 5, 0, Math.PI * 2);
      ctx.fillStyle = '#8e44ad'; ctx.fill();
      ctx.strokeStyle = 'white'; ctx.lineWidth = 2; ctx.stroke();
    });
  }, [sys, puntos, rectas, resuelto, size]);

  const handleCanvasClick = (e) => {
    if (terminal || bloqueado) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const cx = (e.clientX - rect.left) * (size / rect.width);
    const cy = (e.clientY - rect.top) * (size / rect.height);
    const { x, y } = toMath(cx, cy);
    const snap = (v) => Math.round(v * 2) / 2; // precisión 0,5
    const sx = snap(x), sy = snap(y);
    if (Math.abs(sx) > G_RANGE || Math.abs(sy) > G_RANGE) return;

    if (herramienta === 'punto') {
      setPuntos((prev) => {
        const existe = prev.find((p) => p.x === sx && p.y === sy);
        return existe ? prev.filter((p) => !(p.x === sx && p.y === sy)) : [...prev, { x: sx, y: sy }];
      });
    } else {
      const idx = herramienta === 'recta1' ? 1 : 2;
      setRectas((prev) => {
        const actual = prev[idx] || [];
        // dos extremos por recta; al 3er clic se empieza de nuevo
        const nuevos = actual.length >= 2 ? [{ x: sx, y: sy }] : [...actual, { x: sx, y: sy }];
        return { ...prev, [idx]: nuevos };
      });
    }
  };

  const G_ROWS = 3; // filas por tabla
  const num = (v) => parseFloat((v || '').toString().replace(',', '.'));
  const setVal = (linea, row, campo, v) => setValores((prev) => ({ ...prev, [`${linea}_${row}_${campo}`]: v }));

  // Filas (x,y) válidas y distintas de una tabla que cumplen ax+by=c
  const filasValidas = (linea, a, b, c) => {
    const vistos = [];
    for (let r = 0; r < G_ROWS; r++) {
      const x = num(valores[`${linea}_${r}_x`]);
      const y = num(valores[`${linea}_${r}_y`]);
      if (isNaN(x) || isNaN(y)) continue;
      if (Math.abs(a * x + b * y - c) > G_TOL) continue;
      if (!vistos.some((p) => Math.abs(p.x - x) < G_TOL && Math.abs(p.y - y) < G_TOL)) vistos.push({ x, y });
    }
    return vistos;
  };

  const comprobar = () => {
    if (terminal || bloqueado) return;
    const errs = [];
    const tabla1Ok = filasValidas(1, sys.a1, sys.b1, sys.c1).length >= 2;
    const tabla2Ok = filasValidas(2, sys.a2, sys.b2, sys.c2).length >= 2;
    if (!tabla1Ok) errs.push('En la tabla de la 1.ª ecuación necesitas al menos 2 pares (x, y) correctos.');
    if (!tabla2Ok) errs.push('En la tabla de la 2.ª ecuación necesitas al menos 2 pares (x, y) correctos.');

    // rectas trazadas: 2 extremos distintos (precisión 0,5) que estén sobre la recta ax+by=c
    const rectaOk = (idx, a, b, c) => {
      const pr = rectas[idx];
      if (!pr || pr.length !== 2) return false;
      const [p, q] = pr;
      if (p.x === q.x && p.y === q.y) return false;
      return Math.abs(a * p.x + b * p.y - c) <= G_TOL && Math.abs(a * q.x + b * q.y - c) <= G_TOL;
    };
    const recta1Ok = rectaOk(1, sys.a1, sys.b1, sys.c1);
    const recta2Ok = rectaOk(2, sys.a2, sys.b2, sys.c2);
    if (!recta1Ok) errs.push('Traza la recta azul (1) uniendo dos de sus puntos.');
    if (!recta2Ok) errs.push('Traza la recta roja (2) uniendo dos de sus puntos.');

    const correcto = tabla1Ok && tabla2Ok && recta1Ok && recta2Ok;

    if (competitivo) {
      setFeedback(correcto ? 'correct' : 'incorrect');
      playSound(correcto ? 'correct' : 'incorrect');
      if (typeof onResultado === 'function') onResultado(correcto);
      setTimeout(() => { setFeedback(null); nuevo(); }, 900);
      return;
    }

    if (correcto) {
      setFeedback('correct'); setErrores([]); setResuelto(true); playSound('correct');
      setTerminal('acierto'); informar('acierto');
    } else {
      setFeedback('incorrect'); setErrores(errs); playSound('incorrect');
    }
  };

  const verSolucion = () => {
    if (!terminal) { setTerminal('revelado'); informar('revelado'); }
    // rellena las tablas con puntos enteros de cada recta y traza las rectas
    const nuevosVal = {};
    [[1, sys.lat1], [2, sys.lat2]].forEach(([linea, lat]) => {
      for (let r = 0; r < G_ROWS; r++) {
        const p = lat[r] || lat[lat.length - 1];
        nuevosVal[`${linea}_${r}_x`] = String(p.x);
        nuevosVal[`${linea}_${r}_y`] = String(p.y);
      }
    });
    setValores(nuevosVal);
    setRectas({ 1: [sys.lat1[0], sys.lat1[sys.lat1.length - 1]], 2: [sys.lat2[0], sys.lat2[sys.lat2.length - 1]] });
    setResuelto(true);
    setFeedback(null);
    setErrores([]);
  };

  const card = { backgroundColor: colors.white, padding: compact ? (isMobile ? '12px' : '16px') : (isMobile ? '16px' : '24px'),
    borderRadius: '20px', boxShadow: '0 10px 20px rgba(0,0,0,0.05)', border: '2px solid #e4e7eb' };

  const inCell = { width: '100%', boxSizing: 'border-box', padding: '6px', textAlign: 'center', borderRadius: '8px',
    border: '2px solid #ced4da', fontWeight: 700, fontSize: '15px', outline: 'none' };
  const renderTabla = (linea, a, b, c, color) => (
    <div style={{ background: '#f8f9fa', border: `2px solid ${color}33`, borderRadius: '14px', padding: '10px 12px', flex: 1, minWidth: 150 }}>
      <div style={{ fontWeight: 800, color, fontSize: '15px', marginBottom: '8px', textAlign: 'center', fontFamily: '"Courier New", monospace' }}>
        {fmtImplicita(a, b, c)}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px', alignItems: 'center' }}>
        <div style={{ fontWeight: 700, textAlign: 'center', color: '#57606f', borderBottom: '2px solid #ced4da', paddingBottom: 4 }}>x</div>
        <div style={{ fontWeight: 700, textAlign: 'center', color: '#57606f', borderBottom: '2px solid #ced4da', paddingBottom: 4 }}>y</div>
        {Array.from({ length: G_ROWS }, (_, r) => (
          <React.Fragment key={r}>
            <input type="number" step="any" value={valores[`${linea}_${r}_x`] || ''} disabled={!!terminal || bloqueado}
              onChange={(e) => setVal(linea, r, 'x', e.target.value)} placeholder="x" style={inCell} />
            <input type="number" step="any" value={valores[`${linea}_${r}_y`] || ''} disabled={!!terminal || bloqueado}
              onChange={(e) => setVal(linea, r, 'y', e.target.value)} placeholder="y" style={inCell} />
          </React.Fragment>
        ))}
      </div>
    </div>
  );

  return (
    <div style={card}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '10px' }}>
        <span style={{ backgroundColor: panelColor, color: 'white', padding: '6px 12px', borderRadius: '10px', fontSize: '12px', fontWeight: 'bold' }}>
          {panelLabel ? `${panelLabel} · Gráfico` : 'Sistema Gráfico 📈'}
        </span>
        <button onClick={nuevo}
          style={{ background: '#ffa502', border: 'none', padding: '8px 14px', borderRadius: '10px', color: 'white', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 3px 0 #d68902' }}>
          Siguiente ➡️
        </button>
      </div>

      <p style={{ fontSize: '14px', color: '#57606f', fontWeight: 600, margin: '4px 0 10px' }}>
        1️⃣ Elige valores de <b>x</b> y calcula su <b>y</b> en cada tabla (mín. 2 pares por ecuación; se admiten decimales) · 2️⃣ Traza cada recta uniendo dos de sus puntos en el plano.
      </p>

      {/* Tablas de valores */}
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '14px' }}>
        {renderTabla(1, sys.a1, sys.b1, sys.c1, '#3498db')}
        {renderTabla(2, sys.a2, sys.b2, sys.c2, '#e74c3c')}
      </div>

      {/* Selector de herramienta */}
      {!terminal && !bloqueado && (
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', flexWrap: 'wrap', marginBottom: '10px' }}>
          {[
            { id: 'punto', label: '📍 Puntos', color: '#8e44ad' },
            { id: 'recta1', label: '📏 Recta azul', color: '#3498db' },
            { id: 'recta2', label: '📏 Recta roja', color: '#e74c3c' },
          ].map((h) => {
            const activo = herramienta === h.id;
            return (
              <button key={h.id} onClick={() => setHerramienta(h.id)}
                style={{ padding: '7px 12px', borderRadius: '10px', cursor: 'pointer', fontWeight: 800, fontSize: '13px',
                  border: `2px solid ${h.color}`, background: activo ? h.color : 'white', color: activo ? 'white' : h.color }}>
                {h.label}
              </button>
            );
          })}
        </div>
      )}

      {/* Plano de coordenadas */}
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '12px' }}>
        <canvas ref={canvasRef} width={size} height={size} onClick={handleCanvasClick}
          style={{ width: size, height: size, cursor: (terminal || bloqueado) ? 'default' : 'crosshair', borderRadius: 10,
            boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
            border: feedback === 'correct' ? '3px solid #2ecc71' : feedback === 'incorrect' ? '3px solid #e74c3c' : '3px solid #e0e4f0' }} />
      </div>

      {!terminal && !bloqueado && (
        <p style={{ textAlign: 'center', fontSize: '12px', color: '#8395a7', margin: '0 0 12px', fontWeight: 600 }}>
          {herramienta === 'punto'
            ? '📍 Haz clic para marcar/quitar puntos.'
            : `📏 Haz clic en 2 puntos de la ${herramienta === 'recta1' ? 'recta azul' : 'recta roja'} para trazarla.`}
        </p>
      )}

      {/* Botones */}
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
        <button onClick={comprobar} disabled={!!terminal || bloqueado}
          style={{ padding: '13px 22px', fontSize: '15px', fontWeight: 800, color: 'white', border: 'none', borderRadius: '14px',
            cursor: (terminal || bloqueado) ? 'not-allowed' : 'pointer',
            background: (terminal || bloqueado) ? '#b2bec3' : colors.neonGreen, boxShadow: `0 5px 0px ${(terminal || bloqueado) ? '#8d99a3' : '#1b9e49'}` }}>
          ✅ Comprobar
        </button>
        {!competitivo && !terminal && (
          <button onClick={verSolucion}
            style={{ padding: '13px 22px', fontSize: '15px', fontWeight: 800, color: 'white', border: 'none', borderRadius: '14px', cursor: 'pointer', background: '#6c5ce7', boxShadow: '0 5px 0px #4b3db3' }}>
            💡 Ver solución
          </button>
        )}
      </div>

      {feedback === 'correct' && (
        <div style={{ padding: '14px', borderRadius: '14px', marginTop: '14px', fontWeight: 'bold', textAlign: 'center', background: '#e1f7ec', color: colors.neonGreen, border: `2px solid ${colors.neonGreen}` }}>
          🎉 ¡Perfecto! Las dos rectas se cortan en el punto solución <b>({sys.sx}, {sys.sy})</b>.
        </div>
      )}
      {feedback === 'incorrect' && (
        <div style={{ padding: '14px', borderRadius: '14px', marginTop: '14px', fontWeight: 'bold', background: '#ffebeb', color: colors.neonRed, border: `2px solid ${colors.neonRed}` }}>
          👾 Aún no está del todo bien:
          <ul style={{ margin: '6px 0 0', paddingLeft: 20, fontWeight: 600 }}>
            {errores.map((er, i) => <li key={i}>{er}</li>)}
          </ul>
        </div>
      )}
      {terminal === 'revelado' && (
        <div style={{ padding: '10px 14px', borderRadius: '12px', marginTop: '12px', background: '#fff4e6', color: '#e67e22', border: '2px solid #ffd8a8', fontWeight: 700 }}>
          🔒 Solución mostrada: la intersección es ({sys.sx}, {sys.sy}). Pulsa «Siguiente» para otro sistema.
        </div>
      )}
    </div>
  );
}

// ─── Lienzo (bloc de notas) ───────────────────────────────────────────────────
function NotebookCanvas({ styles }) {
  const canvasRef = useRef(null);
  const isDrawingRef = useRef(false);
  const lastXRef = useRef(0);
  const lastYRef = useRef(0);
  const [strokeColor, setStrokeColor] = useState('#ff4757');
  const [lineWidth, setLineWidth] = useState(4);

  const getCoordinates = (e) => {
    if (!canvasRef.current) return null;
    const rect = canvasRef.current.getBoundingClientRect();
    if (e.touches && e.touches.length > 0) {
      return { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top };
    }
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };
  const startDrawing = (e) => {
    const coords = getCoordinates(e);
    if (!coords) return;
    isDrawingRef.current = true;
    lastXRef.current = coords.x;
    lastYRef.current = coords.y;
  };
  const draw = (e) => {
    if (!isDrawingRef.current || !canvasRef.current) return;
    const coords = getCoordinates(e);
    if (!coords) return;
    const ctx = canvasRef.current.getContext('2d');
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = lineWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(lastXRef.current, lastYRef.current);
    ctx.lineTo(coords.x, coords.y);
    ctx.stroke();
    lastXRef.current = coords.x;
    lastYRef.current = coords.y;
  };
  const stopDrawing = () => { isDrawingRef.current = false; };
  const clearCanvas = () => {
    if (!canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d');
    ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
  };

  return (
    <div style={styles.canvasContainer}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
        <span style={{ fontWeight: 'bold', fontSize: '14px', color: colors.textDark }}>📝 Lienzo de operaciones</span>
        <button onClick={clearCanvas} style={{ padding: '6px 12px', background: colors.neonRed, color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' }}>
          Borrar
        </button>
      </div>
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap' }}>
        {['#ff4757', '#2ed573', '#1e90ff', '#2f3542'].map((color) => (
          <div key={color}
            style={{ width: '24px', height: '24px', borderRadius: '50%', backgroundColor: color, cursor: 'pointer',
              border: strokeColor === color ? '3px solid #6c5ce7' : '2px solid transparent',
              transform: strokeColor === color ? 'scale(1.15)' : 'none', transition: 'transform 0.1s' }}
            onClick={() => setStrokeColor(color)} />
        ))}
        <input type="range" min="2" max="8" value={lineWidth}
          onChange={(e) => setLineWidth(parseInt(e.target.value))} style={{ width: '70px', marginLeft: 'auto' }} />
      </div>
      <canvas ref={canvasRef} width={380} height={320} style={styles.canvasArea}
        onMouseDown={startDrawing} onMouseMove={draw} onMouseUp={stopDrawing} onMouseLeave={stopDrawing}
        onTouchStart={startDrawing} onTouchMove={draw} onTouchEnd={stopDrawing} />
    </div>
  );
}

// ─── Columna independiente para el modo dual ──────────────────────────────────
function DualColumn({ isMobile, initialMode, panelLabel, panelColor, reportar, competitivo = false, onResultado = null, bloqueado = false }) {
  const [mode, setMode] = useState(initialMode);
  const [subMode, setSubMode] = useState('reduccion');
  const [difficulty, setDifficulty] = useState('facil');
  const styles = makeStyles(isMobile, false);
  const hasSubTabs = mode === '2x2' || mode === '2x2c';

  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      {/* Selector de tipo por jugador */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
        <span style={{ fontWeight: 'bold', color: panelColor, fontSize: '14px', whiteSpace: 'nowrap' }}>{panelLabel}</span>
        <select value={mode} onChange={(e) => setMode(e.target.value)}
          style={{ flex: 1, padding: '9px 10px', fontSize: '13px', fontWeight: 'bold', color: '#2f3542',
            border: `3px solid ${panelColor}`, borderRadius: '12px', backgroundColor: '#ffffff', cursor: 'pointer', outline: 'none' }}>
          {MODES.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
        </select>
      </div>

      {GENERADORES[mode] && (
        <DificultadSelector value={difficulty} onChange={setDifficulty} />
      )}

      {hasSubTabs && (
        <div style={styles.subNavTabs}>
          <button style={styles.subTabButton(subMode === 'reduccion')} onClick={() => setSubMode('reduccion')}>⚡ Reducción</button>
          <button style={styles.subTabButton(subMode === 'sustitucion')} onClick={() => setSubMode('sustitucion')}>💎 Sustitución</button>
        </div>
      )}

      {mode === 'grafico' ? (
        <GraficoSistema key={`g-${mode}`} isMobile={isMobile} compact panelLabel={panelLabel} panelColor={panelColor}
          reportar={reportar} competitivo={competitivo} onResultado={onResultado} bloqueado={bloqueado} />
      ) : (
        <SolverPanel key={`${mode}-${difficulty}`} mode={mode} subMode={subMode} isMobile={isMobile}
          difficulty={difficulty} compact panelLabel={panelLabel} panelColor={panelColor} reportar={reportar}
          competitivo={competitivo} onResultado={onResultado} bloqueado={bloqueado} />
      )}
    </div>
  );
}

// ─── Selector de dificultad (chips) ───────────────────────────────────────────
function DificultadSelector({ value, onChange }) {
  return (
    <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginBottom: '14px', flexWrap: 'wrap' }}>
      {DIFICULTADES.map((d) => {
        const active = value === d.id;
        return (
          <button key={d.id} onClick={() => onChange(d.id)}
            style={{ padding: '8px 14px', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer',
              backgroundColor: active ? d.color : colors.white, color: active ? colors.white : d.color,
              border: `3px solid ${d.color}`, borderRadius: '12px', transition: 'all 0.15s',
              boxShadow: active ? `0 4px 10px ${d.color}55` : '0 2px 4px rgba(0,0,0,0.05)' }}>
            {d.label}
          </button>
        );
      })}
    </div>
  );
}

// ─── Tirón de cuerda por EQUIPOS · 2 estilos (muñeco Pikatron / dibujo SVG) ────
const CUERDA_CSS = `
  @keyframes esHeaveL{0%,100%{transform:rotate(-9deg)}50%{transform:rotate(-19deg)}}
  @keyframes esHeaveR{0%,100%{transform:rotate(9deg)}50%{transform:rotate(19deg)}}
  @keyframes esCelebrate{0%,100%{transform:rotate(-5deg)}50%{transform:rotate(5deg)}}
  @keyframes esWinJump{0%,100%{transform:translateY(0)}40%{transform:translateY(-9px)}}
  @keyframes esDust{0%{opacity:.55;transform:translateX(-50%) scale(.5)}100%{opacity:0;transform:translateX(-50%) scale(1.7)}}
  @keyframes esRopeB{0%,100%{transform:translateY(0)}50%{transform:translateY(2px)}}
  @keyframes esPikaRun{0%{background-position:0% 0%}50%{background-position:0% 100%}100%{background-position:0% 0%}}
`;

function FiguraSVG({ shirt, hair }) {
  return (
    <svg viewBox="-22 -64 46 68" width="48" height="70" style={{ overflow: 'visible', display: 'block' }}>
      <path d="M-12,0 L-1,-26" stroke="#324a5f" strokeWidth="5" strokeLinecap="round" fill="none" />
      <path d="M13,0 L5,-14 L0,-27" stroke="#3a5568" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <path d="M0,-25 L-6,-46" stroke={shirt} strokeWidth="12" strokeLinecap="round" fill="none" />
      <path d="M-5,-44 L18,-33" stroke={shirt} strokeWidth="6" strokeLinecap="round" fill="none" />
      <circle cx="18" cy="-33" r="3.6" fill="#f6c9a0" />
      <circle cx="-8" cy="-52" r="7.6" fill="#f6c9a0" />
      {hair === 'pony'
        ? <><path d="M-16,-54 a8.5,8.5 0 0 1 15,-2 l-2,5 z" fill="#7a4a1e" /><path d="M-14,-56 q-12,6 -9,21 q1,6 6,6" fill="none" stroke="#7a4a1e" strokeWidth="6" strokeLinecap="round" /></>
        : <path d="M-16,-52 a8,8 0 0 1 15,-3 l-2,4 z" fill="#3a2817" />}
    </svg>
  );
}

function ZonaCuerda({ diff, ganador, limite, variant = 'pika' }) {
  const off = diff * (30 / limite);
  const POS = [3, 12, 21];

  const miembro = (side, idx) => {
    const win = (side === 'L' && ganador === 1) || (side === 'R' && ganador === 2);
    const delay = `${idx * 0.13}s`;
    const anclaje = side === 'L' ? { left: `${POS[idx]}%` } : { right: `${POS[idx]}%` };
    const faceFlip = variant === 'pika' ? (side === 'L') : (side === 'R');
    const leanAnim = win ? 'esCelebrate' : (side === 'L' ? 'esHeaveL' : 'esHeaveR');
    const cuerpo = variant === 'pika'
      ? <div style={{ width: 46, height: 46, backgroundImage: `url(${pikaSprite})`, backgroundSize: '200% 200%', backgroundRepeat: 'no-repeat', animation: 'esPikaRun 0.55s steps(1) infinite', animationDelay: delay, filter: side === 'R' ? 'hue-rotate(150deg) saturate(1.5)' : 'none' }} />
      : <FiguraSVG shirt={side === 'L' ? '#2f7fd8' : '#e14b4b'} hair={side === 'L' ? 'pony' : 'short'} />;
    return (
      <div key={side + idx} style={{ position: 'absolute', bottom: 16, ...anclaje, zIndex: 5 - idx }}>
        <div style={{ animation: win ? 'esWinJump 0.6s ease-in-out infinite' : 'none', filter: win ? 'drop-shadow(0 0 7px #FFE234)' : 'none' }}>
          <div style={{ transformOrigin: '50% 100%', animation: `${leanAnim} 0.8s ease-in-out infinite`, animationDelay: delay }}>
            <div style={{ transform: faceFlip ? 'scaleX(-1)' : 'none' }}>{cuerpo}</div>
          </div>
        </div>
        <span style={{ position: 'absolute', bottom: -2, left: '50%', width: 22, height: 7, borderRadius: '50%', background: '#fff', animation: 'esDust 0.9s ease-out infinite', animationDelay: delay }} />
      </div>
    );
  };

  return (
    <div style={{ position: 'relative', height: 138, overflow: 'hidden', borderRadius: 16, background: 'linear-gradient(180deg,#0b2447 0%,#19376d 58%,#3aa15f 58%,#1c7a43 100%)', boxShadow: 'inset 0 -10px 18px rgba(0,0,0,0.25)' }}>
      <style>{CUERDA_CSS}</style>
      <div style={{ position: 'absolute', left: '50%', top: 0, bottom: 24, width: 2, background: 'rgba(255,255,255,0.14)', zIndex: 1 }} />
      <div style={{ position: 'absolute', inset: 0, transform: `translateX(${off}%)`, transition: 'transform 0.4s cubic-bezier(0.34,1.56,0.64,1)', zIndex: 2 }}>
        <div style={{ position: 'absolute', left: '24%', right: '24%', bottom: 40, height: 9, borderRadius: 5,
          background: 'repeating-linear-gradient(62deg,#5c3a0e 0 3px,#9a6a18 3px 6px,#d29a2c 6px 8px,#9a6a18 8px 10px)',
          boxShadow: '0 2px 5px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.25), inset 0 -2px 3px rgba(0,0,0,0.35)',
          animation: 'esRopeB 0.75s ease-in-out infinite', zIndex: 3 }}>
          <div style={{ position: 'absolute', left: '50%', top: -24, transform: 'translateX(-50%)' }}>
            <div style={{ width: 2, height: 26, background: '#FFE234' }} />
            <div style={{ position: 'absolute', top: 0, left: 2, width: 16, height: 11, background: 'linear-gradient(135deg,#E53935,#FF5722)', clipPath: 'polygon(0 0,100% 0,80% 100%,0 100%)' }} />
          </div>
        </div>
        {[0, 1, 2].map((i) => miembro('L', i))}
        {[0, 1, 2].map((i) => miembro('R', i))}
      </div>
      <div style={{ position: 'absolute', bottom: 5, left: '50%', transform: 'translateX(-50%)', background: 'rgba(0,0,0,0.6)', borderRadius: 20, padding: '2px 12px', fontSize: '0.7rem', color: 'rgba(255,255,255,0.85)', fontWeight: 700, zIndex: 6, whiteSpace: 'nowrap' }}>
        {diff === 0 ? '— ¡Igualados! —' : diff < 0 ? `🔵 Equipo 1 +${Math.abs(diff)}` : `🔴 Equipo 2 +${diff}`}
      </div>
    </div>
  );
}

const METAS_COMPETICION = [
  { valor: 3, label: '⚡ Exprés', desc: '±3' },
  { valor: 5, label: '🎯 Corta', desc: '±5' },
  { valor: 7, label: '🔥 Media', desc: '±7' },
  { valor: 10, label: '🏔️ Larga', desc: '±10' },
];

function CompeticionDual({ isMobile, onSalir }) {
  const [limite, setLimite] = useState(7);
  const [variante, setVariante] = useState('pika'); // 'pika' | 'svg'
  const [diff, setDiff] = useState(0);
  const [ganador, setGanador] = useState(null);
  const [p1, setP1] = useState(0);
  const [p2, setP2] = useState(0);
  const [ronda, setRonda] = useState(0);

  // Declara ganador cuando la ventaja llega al límite
  useEffect(() => {
    if (!ganador && Math.abs(diff) >= limite) setGanador(diff < 0 ? 1 : 2);
  }, [diff, ganador, limite]);

  const reiniciar = () => { setDiff(0); setGanador(null); setP1(0); setP2(0); setRonda((r) => r + 1); };

  const cambiarMeta = (v) => { setLimite(v); reiniciar(); };

  const aplicar = (jugador, correcto) => {
    if (ganador) return;
    if (correcto) (jugador === 1 ? setP1 : setP2)((v) => v + 1);
    // acierto → tira hacia tu lado; fallo → cede terreno al rival
    const delta = correcto ? (jugador === 1 ? -1 : 1) : (jugador === 1 ? 1 : -1);
    setDiff((prev) => Math.max(-limite, Math.min(limite, prev + delta)));
  };

  const revancha = () => reiniciar();

  return (
    <div>
      <style>{CUERDA_CSS}</style>
      <div style={{ background: '#fff9e6', border: '2px solid #f39c12', borderRadius: 12, padding: '10px 14px', marginBottom: 12, fontSize: '0.82rem', color: '#7d6608', textAlign: 'center', fontWeight: 700 }}>
        🪢 <b>Modo Competición</b> · Acierta para tirar de la cuerda · Falla y el rival gana terreno
        {/* Selector de meta (según el tiempo de clase) */}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap', marginTop: 8 }}>
          <span style={{ alignSelf: 'center', color: '#a37f10' }}>Meta:</span>
          {METAS_COMPETICION.map((m) => {
            const activo = limite === m.valor;
            return (
              <button key={m.valor} onClick={() => cambiarMeta(m.valor)}
                style={{ padding: '6px 12px', borderRadius: 20, cursor: 'pointer', fontWeight: 800, fontSize: '0.78rem',
                  border: `2px solid #f39c12`, background: activo ? '#f39c12' : 'white', color: activo ? 'white' : '#b9770f' }}>
                {m.label} <span style={{ opacity: 0.8 }}>{m.desc}</span>
              </button>
            );
          })}
          <span style={{ alignSelf: 'center', color: '#a37f10', marginLeft: 8 }}>Animación:</span>
          {[{ id: 'pika', label: '🕹️ Muñecos' }, { id: 'svg', label: '✏️ Dibujo' }].map((v) => (
            <button key={v.id} onClick={() => setVariante(v.id)}
              style={{ padding: '6px 12px', borderRadius: 20, cursor: 'pointer', fontWeight: 800, fontSize: '0.78rem', border: '2px solid #8e44ad', background: variante === v.id ? '#8e44ad' : 'white', color: variante === v.id ? 'white' : '#8e44ad' }}>
              {v.label}
            </button>
          ))}
        </div>
      </div>

      <ZonaCuerda diff={diff} ganador={ganador} limite={limite} variant={variante} />

      <div style={{ display: 'flex', gap: '18px', alignItems: 'flex-start', marginTop: 14 }}>
        <DualColumn key={`comp1-${ronda}`} isMobile={isMobile} initialMode="2x2" panelLabel="🔵 Jugador 1" panelColor="#3498db"
          competitivo onResultado={(c) => aplicar(1, c)} bloqueado={!!ganador} />
        <div style={{ width: 4, background: '#dfe4ea', alignSelf: 'stretch', borderRadius: 4 }} />
        <DualColumn key={`comp2-${ronda}`} isMobile={isMobile} initialMode="2x2" panelLabel="🔴 Jugador 2" panelColor="#e74c3c"
          competitivo onResultado={(c) => aplicar(2, c)} bloqueado={!!ganador} />
      </div>

      {ganador && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', zIndex: 10000, gap: 14, padding: 20, boxSizing: 'border-box' }}>
          <div style={{ fontSize: '4.5rem' }}>🏆</div>
          <div style={{ fontSize: '2.2rem', fontWeight: 900, color: ganador === 1 ? '#42A5F5' : '#EF5350', textAlign: 'center',
            textShadow: '0 4px 16px rgba(0,0,0,0.5)' }}>
            ¡Gana el Jugador {ganador}!
          </div>
          <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.95rem' }}>
            🔵 J1: {p1} aciertos · 🔴 J2: {p2} aciertos
          </div>
          <div style={{ display: 'flex', gap: 12, marginTop: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
            <button onClick={revancha} style={{ padding: '13px 32px', fontSize: '1rem', fontWeight: 900, border: 'none', borderRadius: 16,
              background: 'linear-gradient(135deg,#f093fb,#f5576c)', color: 'white', cursor: 'pointer', boxShadow: '0 6px 18px rgba(245,87,108,0.35)' }}>
              🔄 Revancha
            </button>
            <button onClick={onSalir} style={{ padding: '13px 24px', fontSize: '0.9rem', fontWeight: 900, borderRadius: 16,
              background: 'transparent', color: 'rgba(255,255,255,0.7)', border: '2px solid rgba(255,255,255,0.25)', cursor: 'pointer' }}>
              ← Salir de competición
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Resumen de la sesión para el informe ─────────────────────────────────────
const resumirEjercicios = (ejercicios) => {
  const total = ejercicios.length;
  const aciertos = ejercicios.filter((e) => e.resultado === 'acierto').length;
  const revelados = total - aciertos;

  const agrupar = (keyFn, labelFn) => {
    const map = {};
    ejercicios.forEach((e) => {
      const k = keyFn(e);
      if (k == null) return;
      if (!map[k]) map[k] = { key: k, label: labelFn(k), total: 0, aciertos: 0 };
      map[k].total += 1;
      if (e.resultado === 'acierto') map[k].aciertos += 1;
    });
    return Object.values(map);
  };

  const porTipo = agrupar((e) => e.modo, (k) => TIPO_LABEL[k] || k);
  const porDificultad = agrupar((e) => e.dificultad, (k) => DIF_LABEL[k] || k);
  const problemasResueltos = ejercicios
    .filter((e) => e.modo === 'problemas' && e.resultado === 'acierto')
    .map((e) => e.problemaId);

  return { total, aciertos, revelados, porTipo, porDificultad, problemasResueltos };
};

// ─── Modal "Enviar al profesor" ───────────────────────────────────────────────
function ModalEnviarProfe({ ejercicios, onClose }) {
  const [codigo, setCodigo] = useState('');
  const [nombre, setNombre] = useState('');
  const [curso, setCurso] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [error, setError] = useState('');

  const r = resumirEjercicios(ejercicios);
  const porcentaje = r.total > 0 ? Math.round((r.aciertos / r.total) * 100) : 0;

  const enviar = async () => {
    const code = codigo.trim().toUpperCase();
    if (!nombre.trim()) { setError('Escribe tu nombre.'); return; }
    if (!code) { setError('Escribe el código del profesor.'); return; }
    if (r.total === 0) { setError('Todavía no has hecho ningún ejercicio.'); return; }
    setEnviando(true); setError('');
    try {
      const snap = await getDoc(doc(db, 'codigos_profesor', code));
      if (!snap.exists()) { setError('Código de profesor no encontrado.'); setEnviando(false); return; }
      await addDoc(collection(db, 'informes_juegos'), {
        tipo: 'ECUACION_SISTEMAS',
        modalidad: 'Individual',
        fecha: new Date(),
        codigoProfesor: code,
        jugadores: [{
          nombre: nombre.trim(),
          curso: curso.trim(),
          aciertos: r.aciertos,
          intentos: r.total,
          porcentaje,
          revelados: r.revelados,
          porTipo: r.porTipo,
          porDificultad: r.porDificultad,
          problemasResueltos: r.problemasResueltos,
        }],
      });
      setEnviado(true);
    } catch (e) { setError('Error al enviar: ' + e.message); }
    setEnviando(false);
  };

  const inp = { padding: '9px 12px', borderRadius: 9, border: '1.5px solid rgba(255,255,255,0.15)',
    background: 'rgba(255,255,255,0.08)', color: 'white', fontSize: '0.9rem', outline: 'none',
    width: '100%', boxSizing: 'border-box', fontFamily: 'inherit' };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 10000, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: 16 }}>
      <div style={{ background: '#1e272e', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 20, width: '100%', maxWidth: 420, maxHeight: '90vh', overflowY: 'auto', padding: '24px 26px', color: 'white', fontFamily: "'Segoe UI',sans-serif" }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <h3 style={{ margin: 0, fontSize: '1.05rem', color: '#f1c40f' }}>📤 Enviar al profesor</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#aaa', fontSize: '1.2rem' }}>✕</button>
        </div>

        {enviado ? (
          <div style={{ textAlign: 'center', padding: '18px 0' }}>
            <div style={{ fontSize: '3rem' }}>✅</div>
            <div style={{ color: '#2ecc71', fontWeight: 700 }}>¡Informe enviado!</div>
            <div style={{ color: '#aaa', fontSize: '0.88rem', marginTop: 8 }}>{r.aciertos}/{r.total} ejercicios correctos ({porcentaje}%)</div>
            <button onClick={onClose} style={{ marginTop: 16, padding: '9px 22px', borderRadius: 10, border: 'none', background: 'rgba(255,255,255,0.1)', cursor: 'pointer', color: 'white' }}>Cerrar</button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {/* Resumen de la sesión */}
            <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 12, padding: '12px 14px', fontSize: '0.82rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ color: '#aaa' }}>Ejercicios realizados</span>
                <span style={{ fontWeight: 700 }}>{r.total}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ color: '#aaa' }}>Correctos / Vistos sin resolver</span>
                <span style={{ fontWeight: 700 }}><span style={{ color: '#2ecc71' }}>{r.aciertos}</span> / <span style={{ color: '#e67e22' }}>{r.revelados}</span></span>
              </div>
              {r.porTipo.length > 0 && (
                <div style={{ marginTop: 8, borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 8 }}>
                  <div style={{ color: '#aaa', marginBottom: 4 }}>Por tipo:</div>
                  {r.porTipo.map((t) => (
                    <div key={t.key} style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>{t.label}</span><span style={{ fontWeight: 700 }}>{t.aciertos}/{t.total} ✓</span>
                    </div>
                  ))}
                </div>
              )}
              {r.porDificultad.length > 0 && (
                <div style={{ marginTop: 8, borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 8 }}>
                  <div style={{ color: '#aaa', marginBottom: 4 }}>Dificultad (2x2):</div>
                  {r.porDificultad.map((d) => (
                    <div key={d.key} style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>{d.label}</span><span style={{ fontWeight: 700 }}>{d.aciertos}/{d.total} ✓</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div><label style={{ fontSize: '0.78rem', color: '#aaa', fontWeight: 600, display: 'block', marginBottom: 4 }}>Nombre y apellidos</label>
              <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Tu nombre completo" style={inp} /></div>
            <div><label style={{ fontSize: '0.78rem', color: '#aaa', fontWeight: 600, display: 'block', marginBottom: 4 }}>Curso</label>
              <input value={curso} onChange={(e) => setCurso(e.target.value)} placeholder="Ej: 3º ESO B" style={inp} /></div>
            <div><label style={{ fontSize: '0.78rem', color: '#aaa', fontWeight: 600, display: 'block', marginBottom: 4 }}>Código del profesor</label>
              <input value={codigo} onChange={(e) => setCodigo(e.target.value.toUpperCase())} placeholder="Ej: PROF01" maxLength={10} style={{ ...inp, letterSpacing: 2, fontWeight: 700 }} /></div>

            {error && <div style={{ color: '#e74c3c', fontSize: '0.8rem' }}>⚠ {error}</div>}
            <div style={{ display: 'flex', gap: 9, marginTop: 4 }}>
              <button onClick={onClose} style={{ flex: 1, padding: '10px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.2)', background: 'transparent', cursor: 'pointer', color: 'white' }}>Cancelar</button>
              <button onClick={enviar} disabled={enviando} style={{ flex: 2, padding: '10px', borderRadius: 10, border: 'none', background: enviando ? '#555' : 'linear-gradient(135deg,#3498db,#2980b9)', color: 'white', fontWeight: 700, cursor: enviando ? 'default' : 'pointer' }}>
                {enviando ? 'Enviando…' : '📤 Enviar'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function EcuacionSistemas({ onExit }) {
  const [activeMode, setActiveMode] = useState('visual');
  const [subMode, setSubMode] = useState('reduccion');
  const [isMobile, setIsMobile] = useState(false);
  const [isCanvasOpen, setIsCanvasOpen] = useState(false);
  const [dualMode, setDualMode] = useState(false);
  const [competicion, setCompeticion] = useState(false);
  const [difficulty, setDifficulty] = useState('facil');

  // Registro de ejercicios de la sesión para el informe al profesor
  const [ejercicios, setEjercicios] = useState([]); // [{ modo, dificultad, resultado, problemaId }]
  const [mostrarEnvio, setMostrarEnvio] = useState(false);
  const reportarEjercicio = useCallback((e) => setEjercicios((prev) => [...prev, e]), []);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // El modo dual no tiene sentido en móvil (dos columnas): lo desactivamos.
  useEffect(() => { if (isMobile && dualMode) setDualMode(false); }, [isMobile, dualMode]);
  // La competición solo existe dentro del modo dual
  useEffect(() => { if (!dualMode && competicion) setCompeticion(false); }, [dualMode, competicion]);

  const styles = makeStyles(isMobile, isCanvasOpen && !dualMode);
  const hasSubTabs = activeMode === '2x2' || activeMode === '2x2c';

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        {typeof onExit === 'function' && (
          <button onClick={onExit}
            style={{ position: 'absolute', top: '14px', left: '14px', background: 'rgba(255,255,255,0.25)', border: 'none', color: 'white', padding: '8px 14px', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer', fontSize: '13px' }}>
            ← Volver
          </button>
        )}
        <button onClick={() => setMostrarEnvio(true)}
          style={{ position: 'absolute', top: '14px', right: '14px', background: 'linear-gradient(135deg,#f1c40f,#e67e22)', border: 'none', color: 'white', padding: '8px 14px', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer', fontSize: '13px', boxShadow: '0 3px 8px rgba(230,126,34,0.35)' }}>
          📤 Enviar al profesor{ejercicios.length > 0 ? ` (${ejercicios.length})` : ''}
        </button>
        <h1 style={styles.title}>🚀 Gamemath: Sistema de Ecuaciones</h1>
        <p style={styles.subtitle}>Supera los niveles deduciendo y calculando incógnitas</p>
      </div>

      {mostrarEnvio && (
        <ModalEnviarProfe ejercicios={ejercicios} onClose={() => setMostrarEnvio(false)} />
      )}

      {/* Selector de modo (oculto en dual: cada jugador elige el suyo) */}
      {!dualMode && (
        <div style={styles.navTabs}>
          {MODES.map((m) => (
            <button key={m.id} style={styles.tabButton(activeMode === m.id)} onClick={() => setActiveMode(m.id)}>
              {m.label}
            </button>
          ))}
        </div>
      )}

      {/* Toggles modo dual y competición (solo escritorio) */}
      {!isMobile && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', marginBottom: '18px', flexWrap: 'wrap' }}>
          <button
            onClick={() => setDualMode((d) => !d)}
            style={{ padding: '10px 18px', fontSize: '14px', fontWeight: 'bold', cursor: 'pointer',
              backgroundColor: dualMode ? '#27ae60' : colors.white, color: dualMode ? colors.white : '#27ae60',
              border: '3px solid #27ae60', borderRadius: '14px', display: 'flex', alignItems: 'center', gap: '8px',
              boxShadow: dualMode ? '0 4px 10px rgba(39,174,96,0.3)' : '0 2px 4px rgba(0,0,0,0.05)' }}>
            👥 {dualMode ? 'Modo Dual activado (2 jugadores)' : 'Activar Modo Dual (2 jugadores)'}
          </button>
          {dualMode && (
            <button
              onClick={() => setCompeticion((c) => !c)}
              style={{ padding: '10px 18px', fontSize: '14px', fontWeight: 'bold', cursor: 'pointer',
                backgroundColor: competicion ? '#f5576c' : colors.white, color: competicion ? colors.white : '#f5576c',
                border: '3px solid #f5576c', borderRadius: '14px', display: 'flex', alignItems: 'center', gap: '8px',
                boxShadow: competicion ? '0 4px 10px rgba(245,87,108,0.3)' : '0 2px 4px rgba(0,0,0,0.05)' }}>
              🪢 {competicion ? 'Competición activada' : 'Modo Competición (tirón de cuerda)'}
            </button>
          )}
        </div>
      )}

      {/* Selector de dificultad para modos aleatorios (modo simple) */}
      {!dualMode && GENERADORES[activeMode] && (
        <DificultadSelector value={difficulty} onChange={setDifficulty} />
      )}

      {/* Submodo para 2x2 y 2x2c (modo simple) */}
      {!dualMode && hasSubTabs && (
        <div style={styles.subNavTabs}>
          <button style={styles.subTabButton(subMode === 'reduccion')} onClick={() => setSubMode('reduccion')}>
            ⚡ Reducción
          </button>
          <button style={styles.subTabButton(subMode === 'sustitucion')} onClick={() => setSubMode('sustitucion')}>
            💎 Sustitución
          </button>
        </div>
      )}

      {dualMode && competicion ? (
        /* ── MODO COMPETICIÓN: tirón de cuerda ── */
        <CompeticionDual isMobile={isMobile} onSalir={() => setCompeticion(false)} />
      ) : dualMode ? (
        /* ── MODO DUAL: dos jugadores independientes (cada uno elige su tipo) ── */
        <div style={{ display: 'flex', gap: '18px', alignItems: 'flex-start' }}>
          <DualColumn isMobile={isMobile} initialMode="visual" panelLabel="🔵 Jugador 1" panelColor="#3498db" reportar={reportarEjercicio} />
          <div style={{ width: 4, background: '#dfe4ea', alignSelf: 'stretch', borderRadius: 4 }} />
          <DualColumn isMobile={isMobile} initialMode="2x2" panelLabel="🔴 Jugador 2" panelColor="#e74c3c" reportar={reportarEjercicio} />
        </div>
      ) : (
        /* ── MODO SIMPLE: panel + lienzo ── */
        <div style={styles.mainGrid}>
          {activeMode === 'grafico' ? (
            <GraficoSistema key="solo-grafico" isMobile={isMobile} reportar={reportarEjercicio} />
          ) : (
            <SolverPanel key={`solo-${activeMode}-${difficulty}`} mode={activeMode} subMode={subMode} isMobile={isMobile} difficulty={difficulty} reportar={reportarEjercicio} />
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {!isCanvasOpen && (
              <button style={{ ...styles.buttonAction('#6c5ce7', '#4b3db3'), width: '100%' }} onClick={() => setIsCanvasOpen(true)}>
                📝 Abrir Cuaderno
              </button>
            )}
            {isCanvasOpen && (
              <>
                <NotebookCanvas styles={styles} />
                <button style={{ ...styles.buttonAction('#6c5ce7', '#4b3db3'), width: '100%' }} onClick={() => setIsCanvasOpen(false)}>
                  Ocultar Cuaderno
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
