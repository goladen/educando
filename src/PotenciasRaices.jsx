import React, { useState, useEffect } from 'react';
import { db } from './firebase';
import { doc, getDoc, addDoc, collection } from 'firebase/firestore';
import correctSoundFile from './assets/correct-choice-43861.mp3';
import wrongSoundFile from './assets/negative_beeps-6008.mp3';
import pikaSprite from './assets/pikatron-sprite2.png';

// ─── Sonidos ───────────────────────────────────────────────────────────────────
const playSound = (type) => {
  try {
    const file = type === 'correct' ? correctSoundFile : wrongSoundFile;
    const audio = new Audio(file);
    audio.volume = 0.6;
    audio.play().catch(() => {});
    if (type === 'correct') setTimeout(() => { audio.pause(); audio.currentTime = 0; }, 1500);
  } catch (e) { /* noop */ }
};

// ─── Helpers ───────────────────────────────────────────────────────────────────
const rInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const pick = (arr) => arr[rInt(0, arr.length - 1)];
const SQFREE = [2, 3, 5, 6, 7, 10, 11, 13, 14, 15];
const gcd = (a, b) => { a = Math.abs(a); b = Math.abs(b); while (b) { [a, b] = [b, a % b]; } return a || 1; };
const fracStr = (nn, dd) => { let n = nn, d = dd; if (d < 0) { n = -n; d = -d; } const g = gcd(n, d); n /= g; d /= g; return d === 1 ? `${n}` : `${n}/${d}`; };
// Convierte dígitos significativos + posición del primer dígito en el número decimal "plano"
const SIGD = ['3', '456', '5', '65', '184', '93', '123', '167', '345', '73', '25', '7', '989', '1673', '4'];
const toPlain = (D, E, neg) => {
  const L = D.length; let s;
  if (E >= L - 1) s = D + '0'.repeat(E - (L - 1));
  else if (E >= 0) s = D.slice(0, E + 1) + '.' + D.slice(E + 1);
  else s = '0.' + '0'.repeat(-E - 1) + D;
  return (neg ? '-' : '') + s;
};

// ─── Teoría ────────────────────────────────────────────────────────────────────
const TEORIA_POTENCIAS = [
  { f: 'a^m * a^n = a^{m+n}', k: 'producto' },
  { f: 'FRAC(a^m,a^n) = a^{m-n}', k: 'cociente' },
  { f: '(a^m)^n = a^{m·n}', k: 'powpow' },
  { f: '(a * b)^n = a^n * b^n', k: 'prodexp' },
  { f: '(FRAC(a,b))^n = FRAC(a^n,b^n)', k: 'cocexp' },
  { f: 'a^0 = 1', k: 'exp0' },
  { f: 'a^{-n} = FRAC(1,a^n)', k: 'expneg' },
  { f: '(-1)^{par} = 1', k: 'paridad' },
  { f: '(-1)^{impar} = -1', k: 'paridad' },
];
const TEORIA_RAICES = [
  { f: 'ROOT(n,a^m) = a^{FRAC(m,n)}', k: 'raiz_exponente' },
  { f: 'SQRT(a^2 * b) = a SQRT(b)', k: 'raiz_extraer' },
  { f: 'c SQRT(r) + d SQRT(r) = (c+d) SQRT(r)', k: 'raiz_suma' },
  { f: 'SQRT(a * b) = SQRT(a) * SQRT(b)', k: 'raiz_producto' },
  { f: 'SQRT(FRAC(a,b)) = FRAC(SQRT(a),SQRT(b))', k: 'raiz_cociente' },
];

// Guiones de las explicaciones visuales (mini-vídeo paso a paso)
const EXPLICACIONES = {
  producto: {
    titulo: 'Producto de igual base: se SUMAN los exponentes',
    formula: 'a^m * a^n = a^{m+n}',
    frames: [
      { math: '2^{3} * 2^{2}', nota: 'Partimos de un ejemplo: 2³ por 2².' },
      { math: '(2·2·2) * (2·2)', nota: '2³ son tres doses; 2² son dos doses.', visual: { label: '2', groups: [{ count: 3, color: '#3b82f6' }, { count: 2, color: '#10b981' }] } },
      { math: '2·2·2·2·2', nota: 'Juntamos TODOS los factores: 3 + 2 = 5.', visual: { label: '2', groups: [{ count: 5, color: '#6366f1' }] } },
      { math: '2^{5}', nota: '5 factores ⇒ exponente 5. Por eso los exponentes se SUMAN.' },
      { math: 'a^m * a^n = a^{m+n}', nota: 'Regla general para cualquier base a.' },
    ],
  },
  cociente: {
    titulo: 'Cociente de igual base: se RESTAN los exponentes',
    formula: 'FRAC(a^m,a^n) = a^{m-n}',
    frames: [
      { math: 'FRAC(2^{5},2^{2})', nota: 'Ejemplo: 2⁵ entre 2².' },
      { math: 'FRAC(2·2·2·2·2, 2·2)', nota: 'Escribimos los factores arriba y abajo.', visual: { label: '2', num: 5, den: 2 } },
      { math: '2·2·2', nota: 'Cancelamos 2 de arriba con 2 de abajo. Quedan 5 − 2 = 3.', visual: { label: '2', num: 5, den: 2, cancel: 2 } },
      { math: '2^{3}', nota: 'Por eso los exponentes se RESTAN.' },
      { math: 'FRAC(a^m,a^n) = a^{m-n}', nota: 'Regla general (a ≠ 0).' },
    ],
  },
  powpow: {
    titulo: 'Potencia de una potencia: se MULTIPLICAN los exponentes',
    formula: '(a^m)^n = a^{m·n}',
    frames: [
      { math: '(2^{3})^{2}', nota: 'Ejemplo: (2³)².' },
      { math: '2^{3} * 2^{3}', nota: 'El exponente exterior 2 significa: 2³ repetido 2 veces.', visual: { label: '2³', groups: [{ count: 2, color: '#8b5cf6' }] } },
      { math: '2^{6}', nota: 'Sumando: 3 + 3 = 3·2 = 6. Se MULTIPLICAN los exponentes.' },
      { math: '(a^m)^n = a^{m·n}', nota: 'Regla general.' },
    ],
  },
  prodexp: {
    titulo: 'Potencia de un producto: cada factor se eleva',
    formula: '(a * b)^n = a^n * b^n',
    frames: [
      { math: '(2·3)^{2}', nota: 'Ejemplo: (2·3)².' },
      { math: '(2·3) * (2·3)', nota: 'El cuadrado es multiplicarlo por sí mismo.' },
      { math: '(2·2) * (3·3)', nota: 'Reordenamos: juntamos los 2 y juntamos los 3.', visual: { label: '2·3', groups: [{ count: 2, color: '#3b82f6' }, { count: 2, color: '#f59e0b' }] } },
      { math: '2^{2} * 3^{2}', nota: 'Cada base se eleva al exponente.' },
      { math: '(a·b)^n = a^n * b^n', nota: 'Regla general.' },
    ],
  },
  cocexp: {
    titulo: 'Potencia de un cociente',
    formula: '(FRAC(a,b))^n = FRAC(a^n,b^n)',
    frames: [
      { math: '(FRAC(2,3))^{2}', nota: 'Ejemplo: (2/3)².' },
      { math: 'FRAC(2,3) * FRAC(2,3)', nota: 'Es multiplicar la fracción por sí misma.' },
      { math: 'FRAC(2·2, 3·3)', nota: 'Se multiplican numeradores y denominadores.' },
      { math: 'FRAC(2^{2}, 3^{2})', nota: 'El exponente va al numerador Y al denominador.' },
      { math: '(FRAC(a,b))^n = FRAC(a^n,b^n)', nota: 'Regla general.' },
    ],
  },
  exp0: {
    titulo: '¿Por qué a⁰ = 1?',
    formula: 'a^0 = 1',
    frames: [
      { math: 'FRAC(2^{3}, 2^{3}) = 1', nota: 'Cualquier número (≠0) dividido entre sí mismo es 1.' },
      { math: 'FRAC(2^{3}, 2^{3}) = 2^{3-3} = 2^{0}', nota: 'Pero por la resta de exponentes, ese cociente es 2⁰.' },
      { math: '2^{0} = 1', nota: 'Así que 2⁰ tiene que valer 1.' },
      { math: 'a^0 = 1', nota: 'Regla general (a ≠ 0).' },
    ],
  },
  expneg: {
    titulo: '¿Por qué el exponente negativo invierte?',
    formula: 'a^{-n} = FRAC(1,a^n)',
    frames: [
      { math: '2^{2}=4,  2^{1}=2,  2^{0}=1', nota: 'Cada vez que bajamos 1 el exponente, dividimos entre 2.' },
      { math: '2^{-1} = FRAC(1,2)', nota: 'Seguimos dividiendo: después de 2⁰ = 1 viene 1/2.' },
      { math: '2^{-2} = FRAC(1,2^{2}) = FRAC(1,4)', nota: 'El exponente negativo pasa la potencia al denominador.' },
      { math: 'a^{-n} = FRAC(1,a^n)', nota: 'Regla general.' },
    ],
  },
  paridad: {
    titulo: 'Signo de una base negativa',
    formula: '(-1)^{par} = +1;  (-1)^{impar} = -1',
    frames: [
      { math: '(-1)^{2} = (-1)·(-1) = 1', nota: 'Dos signos menos se hacen MÁS.' },
      { math: '(-1)^{3} = (-1)·(-1)·(-1) = -1', nota: 'Un número IMPAR de factores negativos deja signo menos.' },
      { math: '(-1)^{par} = 1;   (-1)^{impar} = -1', nota: 'Depende de si el exponente es par o impar.' },
    ],
  },
  raiz_exponente: {
    titulo: 'Raíz = potencia de exponente fraccionario',
    formula: 'ROOT(n,a^m) = a^{FRAC(m,n)}',
    frames: [
      { math: 'ROOT(3, 2^{2})', nota: 'La raíz cúbica de 2². El índice de la raíz es 3.' },
      { math: 'ROOT(3, 2^{2}) = 2^{FRAC(2,3)}', nota: 'El exponente (2) va al NUMERADOR y el índice de la raíz (3) al DENOMINADOR.' },
      { math: 'ROOT(n, a^{m}) = a^{FRAC(m,n)}', nota: 'Regla general: toda raíz es una potencia de exponente fraccionario.' },
      { math: 'SQRT(2^{3}) = 2^{FRAC(3,2)}', nota: '🔑 TRUCO: pasa la raíz a potencia y ya puedes usar TODAS las propiedades de las potencias.' },
    ],
  },
  raiz_extraer: {
    titulo: 'Extraer factores de una raíz',
    formula: 'SQRT(a^2 * b) = a SQRT(b)',
    frames: [
      { math: 'SQRT(72)', nota: 'Queremos simplificar √72.' },
      { math: 'SQRT(36 * 2)', nota: 'Buscamos el mayor cuadrado perfecto que divide a 72:  36 = 6².' },
      { math: 'SQRT(6^{2} * 2)', nota: 'Escribimos 36 como 6².' },
      { math: 'SQRT(6^{2}) * SQRT(2) = 6 SQRT(2)', nota: 'La raíz de un cuadrado sale entera: √(6²) = 6. ¡El 6 sale fuera!' },
      { math: 'SQRT(a^{2} * b) = a SQRT(b)', nota: 'Regla general.' },
    ],
  },
  raiz_suma: {
    titulo: 'Sumar raíces equivalentes',
    formula: 'c SQRT(r) + d SQRT(r) = (c+d) SQRT(r)',
    frames: [
      { math: 'SQRT(8) + SQRT(18)', nota: 'Así no se pueden sumar: primero hay que simplificarlas.' },
      { math: '2 SQRT(2) + 3 SQRT(2)', nota: '√8 = 2√2  y  √18 = 3√2 : ¡las dos tienen el mismo radicando √2!' },
      { math: '(2+3) SQRT(2) = 5 SQRT(2)', nota: 'Como son "√2", sumamos los coeficientes (igual que 2x + 3x = 5x).' },
      { math: 'c SQRT(r) + d SQRT(r) = (c+d) SQRT(r)', nota: 'Regla general: solo se suman raíces con el MISMO radicando.' },
    ],
  },
  raiz_producto: {
    titulo: 'Raíz de un producto',
    formula: 'SQRT(a * b) = SQRT(a) * SQRT(b)',
    frames: [
      { math: 'SQRT(4 * 9)', nota: 'Vamos a comprobarlo con √(4·9).' },
      { math: 'SQRT(36) = 6', nota: 'Por un lado: 4·9 = 36 y √36 = 6.' },
      { math: 'SQRT(4) * SQRT(9) = 2·3 = 6', nota: 'Por otro: √4·√9 = 2·3 = 6. ¡Da lo mismo!' },
      { math: 'SQRT(a·b) = SQRT(a) * SQRT(b)', nota: 'Regla general.' },
    ],
  },
  raiz_cociente: {
    titulo: 'Raíz de un cociente',
    formula: 'SQRT(FRAC(a,b)) = FRAC(SQRT(a),SQRT(b))',
    frames: [
      { math: 'SQRT(FRAC(9,4))', nota: 'La raíz de una fracción, √(9/4).' },
      { math: 'FRAC(SQRT(9),SQRT(4)) = FRAC(3,2)', nota: 'La raíz se reparte: √9 arriba y √4 abajo → 3/2.' },
      { math: 'SQRT(FRAC(a,b)) = FRAC(SQRT(a),SQRT(b))', nota: 'Regla general.' },
    ],
  },
};

// ─── Generadores de ejercicios ─────────────────────────────────────────────────
// Ej. 1-2: calcular potencias (exponente natural y entero → entero o fracción)
function genCalcular(n = 6) {
  const items = [];
  const tipos = ['nat', 'negbase', 'exp0', 'minus', 'neg1', 'negexp'];
  for (let i = 0; i < n; i++) {
    const t = pick(tipos);
    let q, sign = '+', val;
    if (t === 'nat') { const a = rInt(2, 6), e = rInt(2, 4); q = `${a}^{${e}}`; val = String(a ** e); }
    else if (t === 'negbase') { const a = rInt(2, 5), e = rInt(2, 5); q = `(-${a})^{${e}}`; sign = e % 2 ? '-' : '+'; val = String(a ** e); }
    else if (t === 'exp0') { const a = rInt(2, 30); q = `${a}^{0}`; val = '1'; }
    else if (t === 'minus') { const a = rInt(2, 5), e = rInt(2, 4); q = `-${a}^{${e}}`; sign = '-'; val = String(a ** e); }
    else if (t === 'neg1') { const e = rInt(2, 99); q = `(-1)^{${e}}`; sign = e % 2 ? '-' : '+'; val = '1'; }
    else { const a = rInt(2, 5), e = rInt(2, 3), nb = Math.random() < 0.4; if (nb) { q = `(-${a})^{-${e}}`; sign = e % 2 ? '-' : '+'; } else { q = `${a}^{-${e}}`; } val = `1/${a ** e}`; }
    items.push({ id: `c${i}`, q, format: 'number', sign, ans: { val } });
  }
  return items;
}

// Ej. 3: potencias de base fraccionaria → resultado en forma de fracción
function genFraccionaria(n = 6) {
  const items = [];
  for (let i = 0; i < n; i++) {
    let a = rInt(1, 5), b = rInt(2, 6);
    while (gcd(a, b) !== 1 || a === b) { a = rInt(1, 5); b = rInt(2, 6); }
    const e = rInt(2, 3), negBase = Math.random() < 0.35, negExp = Math.random() < 0.45;
    const num = negExp ? b ** e : a ** e;
    const den = negExp ? a ** e : b ** e;
    const sign = (negBase && e % 2) ? '-' : '+';
    const baseStr = negBase ? `-FRAC(${a},${b})` : `FRAC(${a},${b})`;
    const q = negExp ? `(${baseStr})^{-${e}}` : `(${baseStr})^{${e}}`;
    items.push({ id: `f${i}`, q, format: 'number', sign, ans: { val: fracStr(num, den) } });
  }
  return items;
}

// Ej. 4: pasar a potencia de base entera lo más simple posible
function genPotenciaBase(n = 6) {
  const items = [];
  const bases = [2, 3, 5, 7, 10];
  for (let i = 0; i < n; i++) {
    const b = pick(bases), e = pick([-4, -3, -2, -1, 2, 3, 4]);
    const q = e > 0 ? `${b ** e}` : `FRAC(1,${b ** Math.abs(e)})`;
    items.push({ id: `b${i}`, q, format: 'power', sign: '+', ans: { base: `${b}`, exp: `${e}` } });
  }
  return items;
}

// Ej. 5-7: propiedades → simplificar a una sola potencia (con bases enteras y racionales)
function genPropiedad(n = 6) {
  const items = [];
  const props = ['prod', 'coc', 'powpow', 'mulmismo', 'divmismo', 'fracprod', 'fraccoc'];
  for (let i = 0; i < n; i++) {
    const p = pick(props);
    let q, ans;
    if (p === 'prod') { const a = rInt(2, 9), m = rInt(1, 5), k = rInt(1, 5); q = `${a}^{${m}} * ${a}^{${k}}`; ans = { base: `${a}`, exp: `${m + k}` }; }
    else if (p === 'coc') { const a = rInt(2, 9), m = rInt(2, 6), k = rInt(1, 5); q = `FRAC(${a}^{${m}},${a}^{${k}})`; ans = { base: `${a}`, exp: `${m - k}` }; }
    else if (p === 'powpow') { const a = rInt(2, 7), m = rInt(2, 4), k = rInt(2, 3); q = `(${a}^{${m}})^{${k}}`; ans = { base: `${a}`, exp: `${m * k}` }; }
    else if (p === 'mulmismo') { const a = rInt(2, 5), b = rInt(2, 5), e = rInt(2, 4); q = `${a}^{${e}} * ${b}^{${e}}`; ans = { base: `${a * b}`, exp: `${e}` }; }
    else if (p === 'divmismo') { const b = rInt(2, 4), k = rInt(2, 4), e = rInt(2, 4); const a = b * k; q = `FRAC(${a}^{${e}},${b}^{${e}})`; ans = { base: `${k}`, exp: `${e}` }; }
    else if (p === 'fracprod') { let a = rInt(1, 4), b = rInt(2, 5); while (gcd(a, b) !== 1) { a = rInt(1, 4); b = rInt(2, 5); } const m = rInt(1, 3), k = rInt(1, 3); q = `(FRAC(${a},${b}))^{${m}} * (FRAC(${a},${b}))^{${k}}`; ans = { base: `${a}/${b}`, exp: `${m + k}` }; }
    else { let a = rInt(1, 4), b = rInt(2, 5); while (gcd(a, b) !== 1) { a = rInt(1, 4); b = rInt(2, 5); } const m = rInt(2, 5), k = rInt(1, 3); q = `FRAC((FRAC(${a},${b}))^{${m}},(FRAC(${a},${b}))^{${k}})`; ans = { base: `${a}/${b}`, exp: `${m - k}` }; }
    items.push({ id: `p${i}`, q, format: 'power', sign: '+', ans });
  }
  return items;
}

// Ej. 11: sacar factor común la menor potencia → c · bⁿ
function genFactorComun(n = 6) {
  const items = [];
  const T = ['dos', 'tres', 'resta', 'coef'];
  for (let i = 0; i < n; i++) {
    const t = pick(T), b = pick([2, 3, 5]), m = rInt(2, 6);
    let q, coef, exp = m;
    if (t === 'dos') { q = `${b}^{${m}} + ${b}^{${m + 1}}`; coef = 1 + b; }
    else if (t === 'tres') { q = `${b}^{${m}} + ${b}^{${m + 1}} + ${b}^{${m + 2}}`; coef = 1 + b + b * b; }
    else if (t === 'resta') { const k = rInt(2, 3); q = `${b}^{${m + k}} - ${b}^{${m}}`; coef = b ** k - 1; }
    else { const p = rInt(2, 6), r = rInt(1, 5), e = rInt(2, 4); q = `${p}*${b}^{${e}} + ${r}*${b}^{${e}}`; coef = p + r; exp = e; }
    items.push({ id: `fc${i}`, q, format: 'coefpow', ans: { coef: `${coef}`, base: `${b}`, exp: `${exp}` } });
  }
  return items;
}

// Ej. 14: escribir un número en notación científica a × 10ⁿ
function genCientifica(n = 6) {
  const items = [];
  for (let i = 0; i < n; i++) {
    const D = pick(SIGD), E = pick([-9, -7, -5, -4, -3, -2, -1, 2, 3, 4, 6, 8, 10]), neg = Math.random() < 0.25;
    const plain = toPlain(D, E, neg);
    const mant = (neg ? '-' : '') + (D.length > 1 ? `${D[0]}.${D.slice(1)}` : D[0]);
    items.push({ id: `sci${i}`, q: plain, format: 'sci', ans: { mant, exp: `${E}` } });
  }
  return items;
}

function genExtraer(n = 6) {
  const items = [];
  for (let i = 0; i < n; i++) {
    const f = rInt(2, 6), r = pick(SQFREE);
    items.push({ id: `e${i}`, q: `SQRT(${f * f * r})`, format: 'radical', ans: { coef: String(f), rad: String(r) } });
  }
  return items;
}

function genSumar(n = 6) {
  const items = [];
  for (let i = 0; i < n; i++) {
    const r = pick(SQFREE);
    const f1 = rInt(1, 4), f2 = rInt(1, 4), c1 = rInt(1, 3), c2 = rInt(1, 3);
    const t1 = c1 * f1, t2 = c2 * f2;
    let minus = Math.random() < 0.4 && t1 > t2;
    const total = minus ? t1 - t2 : t1 + t2;
    const d1 = `${c1 === 1 ? '' : c1}SQRT(${f1 * f1 * r})`;
    const d2 = `${c2 === 1 ? '' : c2}SQRT(${f2 * f2 * r})`;
    items.push({ id: `s${i}`, q: `${d1} ${minus ? '-' : '+'} ${d2}`, format: 'radical', ans: { coef: String(total), rad: String(r) } });
  }
  return items;
}

const MODES = [
  { id: 'theory', label: '📚 Teoría' },
  { id: 'calcular', label: '🔢 Calcular potencias', gen: genCalcular, desc: 'Calcula el valor. Elige el signo (+/−) y escribe el número (usa a/b para fracciones).' },
  { id: 'fraccion', label: '½ Base fraccionaria', gen: genFraccionaria, desc: 'Potencias de base fraccionaria; deja el resultado como fracción a/b (signo + fracción).' },
  { id: 'base', label: '🔟 Potencia de base entera', gen: genPotenciaBase, desc: 'Escribe el número como potencia de base entera lo más simple posible (base y exponente).' },
  { id: 'propiedades', label: '✖️ Propiedades', gen: genPropiedad, desc: 'Simplifica a UNA sola potencia: escribe la base (entera o a/b) y el exponente.' },
  { id: 'factor', label: '➕ Factor común', gen: genFactorComun, desc: 'Saca factor común la MENOR potencia. Resultado: coeficiente · base^exponente.' },
  { id: 'extraer', label: '√ Extraer factor', gen: genExtraer, desc: 'Saca factores fuera de la raíz:  √n = c·√r. Escribe el coeficiente y el radicando.' },
  { id: 'sumar', label: '➕√ Sumar raíces', gen: genSumar, desc: 'Simplifica cada raíz y suma/resta las equivalentes:  c·√r.' },
  { id: 'cientifica', label: '🔬 Notación científica', gen: genCientifica, desc: 'Escribe el número en notación científica a × 10ⁿ (con 1 ≤ a < 10).' },
];

// ─── Render matemático (FRAC, ^, SQRT) con parser recursivo ────────────────────
const findMatch = (s, openIdx) => { let d = 0; for (let i = openIdx; i < s.length; i++) { const c = s[i]; if (c === '(') d++; else if (c === ')') { d--; if (d === 0) return i; } } return -1; };
const splitTopComma = (s) => { let d = 0; for (let i = 0; i < s.length; i++) { const c = s[i]; if (c === '(') d++; else if (c === ')') d--; else if (c === ',' && d === 0) return [s.slice(0, i), s.slice(i + 1)]; } return [s, '']; };

const Fraction = ({ num, den }) => (
  <span style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', verticalAlign: 'middle', margin: '0 0.25em', textAlign: 'center', lineHeight: 1.15 }}>
    <span style={{ padding: '0 0.35em 0.1em' }}>{num}</span>
    <span style={{ borderTop: '1.5px solid currentColor', padding: '0.1em 0.35em 0', minWidth: '100%', boxSizing: 'border-box' }}>{den}</span>
  </span>
);

// Radical con símbolo y barra unidos: el SVG se posiciona en absoluto para tomar
// EXACTAMENTE la altura del radicando. Admite índice opcional (ⁿ√).
const Radical = ({ children, index }) => (
  <span style={{ position: 'relative', display: 'inline-block', paddingLeft: index != null ? '1.05em' : '0.72em', margin: '0 0.12em', verticalAlign: 'middle' }}>
    {index != null && (
      <span style={{ position: 'absolute', left: 0, top: '-0.35em', fontSize: '0.6em', fontWeight: 700, lineHeight: 1 }}>{index}</span>
    )}
    <span style={{ position: 'absolute', left: index != null ? '0.32em' : 0, top: 0, bottom: 0, width: '0.68em' }}>
      <svg viewBox="0 0 16 100" preserveAspectRatio="none" width="100%" height="100%" style={{ overflow: 'visible', display: 'block' }} aria-hidden="true">
        <path d="M0,64 L5,54 L9,95 L16,3" fill="none" stroke="currentColor" strokeWidth="1.3" vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
      </svg>
    </span>
    <span style={{ display: 'inline-block', borderTop: '1.4px solid currentColor', padding: '0.14em 0.3em 0 0.06em' }}>{children}</span>
  </span>
);

function renderText(text, isMobile, kp) {
  const sub = String(text).split(/\^([^{}\s()]+|\{[^}]+\})/g);
  return sub.map((sp, j) => {
    if (j % 2 === 1) {
      const exp = sp.startsWith('{') ? sp.slice(1, -1) : sp;
      // superíndice real: pequeño y elevado, pegado a la base (sin saltos de línea)
      return <sup key={`${kp}-s${j}`} style={{ fontSize: '0.68em', lineHeight: 0 }}>{renderNodes(exp, isMobile, `${kp}e${j}`)}</sup>;
    }
    return sp ? <span key={`${kp}-t${j}`} style={{ whiteSpace: 'pre' }}>{sp.replace(/\*/g, '·')}</span> : null;
  });
}

function renderNodes(str, isMobile, kp = 'm') {
  const out = []; let i = 0, buf = '', k = 0;
  const flush = () => { if (buf) { out.push(<React.Fragment key={`${kp}f${k++}`}>{renderText(buf, isMobile, `${kp}${k}`)}</React.Fragment>); buf = ''; } };
  while (i < str.length) {
    if (str.startsWith('FRAC(', i)) {
      flush(); const close = findMatch(str, i + 4); const inner = str.slice(i + 5, close);
      const [n, d] = splitTopComma(inner);
      out.push(<Fraction key={`${kp}fr${k++}`} num={renderNodes(n, isMobile, `${kp}n${k}`)} den={renderNodes(d, isMobile, `${kp}d${k}`)} />);
      i = close + 1;
    } else if (str.startsWith('SQRT(', i)) {
      flush(); const close = findMatch(str, i + 4); const inner = str.slice(i + 5, close);
      out.push(<Radical key={`${kp}rd${k++}`}>{renderNodes(inner, isMobile, `${kp}r${k}`)}</Radical>);
      i = close + 1;
    } else if (str.startsWith('ROOT(', i)) {
      flush(); const close = findMatch(str, i + 4); const inner = str.slice(i + 5, close);
      const [idx, rad] = splitTopComma(inner);
      out.push(<Radical key={`${kp}rt${k++}`} index={renderNodes(idx, isMobile, `${kp}ix${k}`)}>{renderNodes(rad, isMobile, `${kp}rr${k}`)}</Radical>);
      i = close + 1;
    } else { buf += str[i]; i++; }
  }
  flush();
  return out;
}

function renderMath(text, isMobile) {
  if (text == null) return null;
  return (
    <span style={{ display: 'inline-block', fontFamily: '"Cambria Math", "Times New Roman", Georgia, serif', fontSize: isMobile ? '1.2rem' : '1.4rem', lineHeight: 1.5, verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
      {renderNodes(String(text), isMobile)}
    </span>
  );
}

// ─── Visual de factores (cajitas) para la explicación ──────────────────────────
function VisualFactores({ visual, isMobile }) {
  if (!visual) return null;
  const box = (key, color, label, crossed) => (
    <span key={key} style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      minWidth: isMobile ? 26 : 32, height: isMobile ? 26 : 32, padding: '0 4px', margin: 2, borderRadius: 7,
      background: crossed ? '#e2e8f0' : color, color: crossed ? '#94a3b8' : 'white', fontWeight: 800, fontSize: isMobile ? '0.85rem' : '0.95rem',
      boxShadow: crossed ? 'none' : '0 2px 5px rgba(0,0,0,0.15)', opacity: crossed ? 0.6 : 1 }}>
      {label}
      {crossed && <span style={{ position: 'absolute', left: 2, right: 2, top: '50%', height: 2, background: '#ef4444', transform: 'rotate(-18deg)' }} />}
    </span>
  );
  // Fracción de cajas (numerador / denominador) con cancelaciones
  if (visual.num != null) {
    const { label, num, den, cancel = 0 } = visual;
    return (
      <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', margin: '4px 0' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', padding: '0 8px 6px' }}>
          {Array.from({ length: num }, (_, i) => box(`n${i}`, '#3b82f6', label, i < cancel))}
        </div>
        <div style={{ height: 3, background: '#334155', width: '90%', borderRadius: 2 }} />
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', padding: '6px 8px 0' }}>
          {Array.from({ length: den }, (_, i) => box(`d${i}`, '#10b981', label, i < cancel))}
        </div>
      </div>
    );
  }
  // Grupos en fila
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 6, margin: '4px 0' }}>
      {(visual.groups || []).map((g, gi) => (
        <div key={gi} style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', padding: 4, borderRadius: 10, background: `${g.color}14`, border: `2px dashed ${g.color}55` }}>
          {Array.from({ length: g.count }, (_, i) => box(`${gi}-${i}`, g.color, visual.label, false))}
        </div>
      ))}
    </div>
  );
}

// ─── Modal "mini-vídeo" con la explicación animada ─────────────────────────────
function ExplicaModal({ data, isMobile, onClose }) {
  const [frame, setFrame] = useState(0);
  const [playing, setPlaying] = useState(true);
  const total = data.frames.length;
  const last = frame >= total - 1;

  useEffect(() => {
    if (!playing) return undefined;
    if (last) { setPlaying(false); return undefined; }
    const t = setTimeout(() => setFrame((f) => Math.min(f + 1, total - 1)), 2600);
    return () => clearTimeout(t);
  }, [playing, frame, last, total]);

  const f = data.frames[frame];

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.72)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <style>{`@keyframes explIn{0%{opacity:0;transform:translateY(14px) scale(0.98)}100%{opacity:1;transform:none}}`}</style>
      <div onClick={(e) => e.stopPropagation()} style={{ background: 'white', borderRadius: 20, width: '100%', maxWidth: 560, boxShadow: '0 24px 70px rgba(0,0,0,0.4)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {/* Cabecera */}
        <div style={{ background: 'linear-gradient(135deg,#1e293b,#334155)', color: 'white', padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <div>
            <div style={{ fontSize: '0.72rem', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>🎬 ¿Por qué?</div>
            <div style={{ fontSize: isMobile ? '0.95rem' : '1.1rem', fontWeight: 800 }}>{data.titulo}</div>
          </div>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', color: 'white', width: 34, height: 34, borderRadius: 10, cursor: 'pointer', fontSize: '1.1rem' }}>✕</button>
        </div>

        {/* Escenario */}
        <div style={{ padding: isMobile ? '20px 16px' : '30px 24px', minHeight: 220, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, background: '#f8fafc' }}>
          <div key={frame} style={{ animation: 'explIn 0.45s ease', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, width: '100%' }}>
            <div style={{ fontSize: isMobile ? '1.4rem' : '1.7rem', color: '#0f172a', textAlign: 'center' }}>{renderMath(f.math, isMobile)}</div>
            {f.visual && <VisualFactores visual={f.visual} isMobile={isMobile} />}
            <div style={{ color: '#475569', fontSize: isMobile ? '0.9rem' : '1rem', textAlign: 'center', maxWidth: 460, lineHeight: 1.5 }}>{f.nota}</div>
          </div>
        </div>

        {/* Barra de progreso */}
        <div style={{ display: 'flex', gap: 6, padding: '0 20px', justifyContent: 'center' }}>
          {data.frames.map((_, i) => (
            <div key={i} onClick={() => { setPlaying(false); setFrame(i); }} style={{ flex: 1, maxWidth: 60, height: 6, borderRadius: 3, cursor: 'pointer', background: i <= frame ? '#3b82f6' : '#e2e8f0', transition: 'background 0.3s' }} />
          ))}
        </div>

        {/* Controles */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, padding: '14px 20px 20px' }}>
          <button onClick={() => { setPlaying(false); setFrame((x) => Math.max(0, x - 1)); }} disabled={frame === 0}
            style={{ padding: '9px 14px', borderRadius: 10, border: '1px solid #cbd5e1', background: 'white', cursor: frame === 0 ? 'default' : 'pointer', opacity: frame === 0 ? 0.4 : 1, fontWeight: 700 }}>◀</button>
          {last ? (
            <button onClick={() => { setFrame(0); setPlaying(true); }} style={{ padding: '9px 20px', borderRadius: 10, border: 'none', background: '#3b82f6', color: 'white', cursor: 'pointer', fontWeight: 800 }}>🔄 Repetir</button>
          ) : (
            <button onClick={() => setPlaying((p) => !p)} style={{ padding: '9px 20px', borderRadius: 10, border: 'none', background: '#10b981', color: 'white', cursor: 'pointer', fontWeight: 800 }}>{playing ? '⏸ Pausa' : '▶ Reproducir'}</button>
          )}
          <button onClick={() => { setPlaying(false); setFrame((x) => Math.min(total - 1, x + 1)); }} disabled={last}
            style={{ padding: '9px 14px', borderRadius: 10, border: '1px solid #cbd5e1', background: 'white', cursor: last ? 'default' : 'pointer', opacity: last ? 0.4 : 1, fontWeight: 700 }}>▶</button>
        </div>
      </div>
    </div>
  );
}

// Etiqueta legible por id de modo (para el informe)
const MODE_LABEL = Object.fromEntries(MODES.map((m) => [m.id, m.label.replace(/^[^ ]+ /, '')]));
// Modos jugables (los que generan ejercicios; sin teoría)
const MODOS_JUEGO = MODES.filter((m) => m.gen);

// ─── Validación e inputs reutilizables ─────────────────────────────────────────
const normAns = (s) => (s || '').toString().trim().replace(/\s+/g, '').replace(',', '.');
function checkAns(item, u = {}) {
  if (!item) return false;
  if (item.format === 'number') return normAns(u.sign) === normAns(item.sign) && normAns(u.val) === normAns(item.ans.val);
  if (item.format === 'power') return normAns(u.sign) === normAns(item.sign) && normAns(u.base) === normAns(item.ans.base) && normAns(u.exp) === normAns(item.ans.exp);
  if (item.format === 'radical') return normAns(u.coef) === normAns(item.ans.coef) && normAns(u.rad) === normAns(item.ans.rad);
  if (item.format === 'coefpow') return normAns(u.coef) === normAns(item.ans.coef) && normAns(u.base) === normAns(item.ans.base) && normAns(u.exp) === normAns(item.ans.exp);
  if (item.format === 'sci') { const m = parseFloat((u.mant || '').toString().replace(',', '.')); return !isNaN(m) && Math.abs(m - parseFloat(item.ans.mant)) < 1e-6 && normAns(u.exp) === normAns(item.ans.exp); }
  return false;
}
const inpStyleFor = (type, isMobile) => {
  const base = { textAlign: 'center', outline: 'none', border: '2px solid #cbd5e1', borderRadius: '8px', color: '#0f172a', backgroundColor: '#fff' };
  if (type === 'sign') return { ...base, width: isMobile ? '44px' : '52px', height: '44px', fontSize: '1.3rem', cursor: 'pointer' };
  if (type === 'val') return { ...base, width: isMobile ? '70px' : '90px', height: '44px', fontSize: '1.15rem' };
  if (type === 'base') return { ...base, width: isMobile ? '58px' : '72px', height: '44px', fontSize: '1.15rem' };
  if (type === 'exp') return { ...base, width: isMobile ? '44px' : '52px', height: '34px', fontSize: '1rem', transform: 'translateY(-14px)' };
  if (type === 'coef') return { ...base, width: isMobile ? '52px' : '64px', height: '44px', fontSize: '1.15rem' };
  if (type === 'rad') return { ...base, width: isMobile ? '58px' : '72px', height: '38px', fontSize: '1.1rem' };
  if (type === 'mant') return { ...base, width: isMobile ? '72px' : '90px', height: '44px', fontSize: '1.15rem' };
  return base;
};
function AnswerInputs({ item, u, onChange, isMobile }) {
  const S = (t) => inpStyleFor(t, isMobile);
  if (item.format === 'coefpow') {
    return (
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '4px' }}>
        <input type="text" placeholder="Coef" value={u.coef || ''} onChange={(e) => onChange('coef', e.target.value)} style={S('coef')} />
        <span style={{ alignSelf: 'center', fontSize: '1.3rem', fontWeight: 'bold', color: '#64748b' }}>·</span>
        <input type="text" placeholder="Base" value={u.base || ''} onChange={(e) => onChange('base', e.target.value)} style={S('base')} />
        <input type="text" placeholder="Exp" value={u.exp || ''} onChange={(e) => onChange('exp', e.target.value)} style={S('exp')} />
      </div>
    );
  }
  if (item.format === 'sci') {
    return (
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '4px' }}>
        <input type="text" placeholder="a" value={u.mant || ''} onChange={(e) => onChange('mant', e.target.value)} style={S('mant')} />
        <span style={{ alignSelf: 'center', fontSize: '1.15rem', fontWeight: 'bold', color: '#334155' }}>× 10</span>
        <input type="text" placeholder="n" value={u.exp || ''} onChange={(e) => onChange('exp', e.target.value)} style={S('exp')} />
      </div>
    );
  }
  if (item.format === 'radical') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
        <input type="text" placeholder="c" value={u.coef || ''} onChange={(e) => onChange('coef', e.target.value)} style={S('coef')} />
        <span style={{ position: 'relative', display: 'inline-block', paddingLeft: '16px', color: '#0f172a' }}>
          <span style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '15px' }}>
            <svg viewBox="0 0 16 100" preserveAspectRatio="none" width="100%" height="100%" style={{ overflow: 'visible', display: 'block' }} aria-hidden="true">
              <path d="M0,64 L5,54 L9,95 L16,3" fill="none" stroke="currentColor" strokeWidth="1.7" vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
            </svg>
          </span>
          <span style={{ display: 'flex', alignItems: 'center', borderTop: '2px solid #0f172a', paddingTop: '4px', paddingLeft: '3px' }}>
            <input type="text" placeholder="r" value={u.rad || ''} onChange={(e) => onChange('rad', e.target.value)} style={S('rad')} />
          </span>
        </span>
      </div>
    );
  }
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'nowrap', justifyContent: 'center' }}>
      <select value={u.sign || ''} onChange={(e) => onChange('sign', e.target.value)} style={S('sign')}>
        <option value="" disabled>?</option>
        <option value="+">+</option>
        <option value="-">−</option>
      </select>
      {item.format === 'number' && (
        <input type="text" placeholder="Valor" value={u.val || ''} onChange={(e) => onChange('val', e.target.value)} style={S('val')} />
      )}
      {item.format === 'power' && (
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '3px' }}>
          <input type="text" placeholder="Base" value={u.base || ''} onChange={(e) => onChange('base', e.target.value)} style={S('base')} />
          <input type="text" placeholder="Exp" value={u.exp || ''} onChange={(e) => onChange('exp', e.target.value)} style={S('exp')} />
        </div>
      )}
    </div>
  );
}

// ─── Tablero individual (usado en dual y competición) ──────────────────────────
function TableroPot({ isMobile, initialMode, fixedMode, panelLabel, panelColor, competitivo = false, onResultado = null, bloqueado = false }) {
  const [mode, setMode] = useState(fixedMode || initialMode || 'calcular');
  const modo = fixedMode || mode;
  const gen1 = () => { const m = MODES.find((x) => x.id === modo); return m && m.gen ? m.gen(1)[0] : null; };
  const [item, setItem] = useState(gen1);
  const [ans, setAns] = useState({});
  const [feedback, setFeedback] = useState(null);
  const [aciertos, setAciertos] = useState(0);

  const nuevo = () => { setItem(gen1()); setAns({}); setFeedback(null); };
  // Al cambiar de tipo, regenerar
  useEffect(() => { setItem(gen1()); setAns({}); setFeedback(null); /* eslint-disable-next-line */ }, [modo]);

  const comprobar = () => {
    if (bloqueado || !item || feedback) return;
    const ok = checkAns(item, ans);
    setFeedback(ok ? 'correct' : 'incorrect');
    playSound(ok ? 'correct' : 'incorrect');
    if (ok) setAciertos((a) => a + 1);
    if (competitivo) {
      if (typeof onResultado === 'function') onResultado(ok);
      setTimeout(() => nuevo(), 850);
    } else {
      setTimeout(() => setFeedback(null), 700);
    }
  };

  const borderC = feedback === 'correct' ? '#10b981' : feedback === 'incorrect' ? '#ef4444' : '#e2e8f0';

  return (
    <div style={{ flex: 1, minWidth: 0, background: 'white', borderRadius: 16, padding: isMobile ? '12px' : '16px', boxShadow: '0 4px 15px rgba(0,0,0,0.07)', border: `3px solid ${borderC}`, transition: 'border-color 0.2s', display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ fontWeight: 900, color: panelColor, fontSize: '1rem' }}>{panelLabel}</span>
        <span style={{ marginLeft: 'auto', background: panelColor, color: 'white', padding: '2px 10px', borderRadius: 20, fontWeight: 700, fontSize: '0.8rem' }}>✓ {aciertos}</span>
      </div>

      {!fixedMode && (
        <select value={mode} onChange={(e) => setMode(e.target.value)}
          style={{ padding: '8px 10px', fontSize: '13px', fontWeight: 'bold', color: '#0f172a', border: `2px solid ${panelColor}`, borderRadius: 10, background: 'white', cursor: 'pointer', outline: 'none' }}>
          {MODOS_JUEGO.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
        </select>
      )}

      <div style={{ background: '#f8fafc', borderRadius: 12, padding: '14px 8px', minHeight: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
        {item ? renderMath(item.q, isMobile) : '—'}
      </div>

      {item && (
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <AnswerInputs item={item} u={ans} onChange={(f, v) => { setAns((p) => ({ ...p, [f]: v })); }} isMobile={isMobile} />
        </div>
      )}

      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={comprobar} disabled={bloqueado || !!feedback}
          style={{ flex: 1, padding: '11px', border: 'none', borderRadius: 10, fontWeight: 800, fontSize: '0.95rem', cursor: (bloqueado || feedback) ? 'default' : 'pointer', color: 'white', background: (bloqueado || feedback) ? '#94a3b8' : '#10b981' }}>
          ✅ Comprobar
        </button>
        {!competitivo && (
          <button onClick={nuevo} style={{ padding: '11px 16px', border: 'none', borderRadius: 10, fontWeight: 800, fontSize: '0.95rem', cursor: 'pointer', color: 'white', background: '#6366f1' }}>➡️</button>
        )}
      </div>

      {feedback && (
        <div style={{ textAlign: 'center', fontWeight: 800, color: feedback === 'correct' ? '#10b981' : '#ef4444' }}>
          {feedback === 'correct' ? '🎉 ¡Correcto!' : '❌ Fallo'}
        </div>
      )}
    </div>
  );
}

// ─── Tirón de cuerda por EQUIPOS · 2 estilos (muñeco Pikatron / dibujo SVG) ────
const CUERDA_CSS = `
  @keyframes prHeaveL{0%,100%{transform:rotate(-9deg)}50%{transform:rotate(-19deg)}}
  @keyframes prHeaveR{0%,100%{transform:rotate(9deg)}50%{transform:rotate(19deg)}}
  @keyframes prCelebrate{0%,100%{transform:rotate(-5deg)}50%{transform:rotate(5deg)}}
  @keyframes prWinJump{0%,100%{transform:translateY(0)}40%{transform:translateY(-9px)}}
  @keyframes prDust{0%{opacity:.55;transform:translateX(-50%) scale(.5)}100%{opacity:0;transform:translateX(-50%) scale(1.7)}}
  @keyframes prRopeB{0%,100%{transform:translateY(0)}50%{transform:translateY(2px)}}
  @keyframes prPikaRun{0%{background-position:0% 0%}50%{background-position:0% 100%}100%{background-position:0% 0%}}
`;

// Muñequito dibujado (SVG) mirando a la derecha, pies en y=0
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
  const off = diff * (30 / limite); // % desplazamiento del conjunto
  const POS = [3, 12, 21];           // % desde el borde (3 miembros por equipo)

  const miembro = (side, idx) => {
    const win = (side === 'L' && ganador === 1) || (side === 'R' && ganador === 2);
    const delay = `${idx * 0.13}s`;
    const anclaje = side === 'L' ? { left: `${POS[idx]}%` } : { right: `${POS[idx]}%` };
    // Cada personaje debe MIRAR al centro (a la cuerda). El sprite Pi mira a la izquierda;
    // la figura SVG mira a la derecha → el volteo es opuesto según la variante.
    const faceFlip = variant === 'pika' ? (side === 'L') : (side === 'R');
    const leanAnim = win ? 'prCelebrate' : (side === 'L' ? 'prHeaveL' : 'prHeaveR');
    const cuerpo = variant === 'pika'
      ? <div style={{ width: 46, height: 46, backgroundImage: `url(${pikaSprite})`, backgroundSize: '200% 200%', backgroundRepeat: 'no-repeat', animation: 'prPikaRun 0.55s steps(1) infinite', animationDelay: delay, filter: side === 'R' ? 'hue-rotate(150deg) saturate(1.5)' : 'none' }} />
      : <FiguraSVG shirt={side === 'L' ? '#2f7fd8' : '#e14b4b'} hair={side === 'L' ? 'pony' : 'short'} />;
    return (
      <div key={side + idx} style={{ position: 'absolute', bottom: 16, ...anclaje, zIndex: 5 - idx }}>
        <div style={{ animation: win ? 'prWinJump 0.6s ease-in-out infinite' : 'none', filter: win ? 'drop-shadow(0 0 7px #FFE234)' : 'none' }}>
          <div style={{ transformOrigin: '50% 100%', animation: `${leanAnim} 0.8s ease-in-out infinite`, animationDelay: delay }}>
            <div style={{ transform: faceFlip ? 'scaleX(-1)' : 'none' }}>{cuerpo}</div>
          </div>
        </div>
        <span style={{ position: 'absolute', bottom: -2, left: '50%', width: 22, height: 7, borderRadius: '50%', background: '#fff', animation: 'prDust 0.9s ease-out infinite', animationDelay: delay }} />
      </div>
    );
  };

  return (
    <div style={{ position: 'relative', height: 138, overflow: 'hidden', borderRadius: 16, background: 'linear-gradient(180deg,#0b2447 0%,#19376d 58%,#3aa15f 58%,#1c7a43 100%)', boxShadow: 'inset 0 -10px 18px rgba(0,0,0,0.25)' }}>
      <style>{CUERDA_CSS}</style>
      <div style={{ position: 'absolute', left: '50%', top: 0, bottom: 24, width: 2, background: 'rgba(255,255,255,0.14)', zIndex: 1 }} />
      <div style={{ position: 'absolute', inset: 0, transform: `translateX(${off}%)`, transition: 'transform 0.4s cubic-bezier(0.34,1.56,0.64,1)', zIndex: 2 }}>
        {/* Cuerda */}
        <div style={{ position: 'absolute', left: '24%', right: '24%', bottom: 40, height: 9, borderRadius: 5,
          background: 'repeating-linear-gradient(62deg,#5c3a0e 0 3px,#9a6a18 3px 6px,#d29a2c 6px 8px,#9a6a18 8px 10px)',
          boxShadow: '0 2px 5px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.25), inset 0 -2px 3px rgba(0,0,0,0.35)',
          animation: 'prRopeB 0.75s ease-in-out infinite', zIndex: 3 }}>
          <div style={{ position: 'absolute', left: '50%', top: -24, transform: 'translateX(-50%)' }}>
            <div style={{ width: 2, height: 26, background: '#FFE234' }} />
            <div style={{ position: 'absolute', top: 0, left: 2, width: 16, height: 11, background: 'linear-gradient(135deg,#E53935,#FF5722)', clipPath: 'polygon(0 0,100% 0,80% 100%,0 100%)' }} />
          </div>
        </div>
        {/* Equipos */}
        {[0, 1, 2].map((i) => miembro('L', i))}
        {[0, 1, 2].map((i) => miembro('R', i))}
      </div>
      <div style={{ position: 'absolute', bottom: 5, left: '50%', transform: 'translateX(-50%)', background: 'rgba(0,0,0,0.6)', borderRadius: 20, padding: '2px 12px', fontSize: '0.7rem', color: 'rgba(255,255,255,0.85)', fontWeight: 700, zIndex: 6, whiteSpace: 'nowrap' }}>
        {diff === 0 ? '— ¡Igualados! —' : diff < 0 ? `🔵 Equipo 1 +${Math.abs(diff)}` : `🔴 Equipo 2 +${diff}`}
      </div>
    </div>
  );
}

const METAS_POT = [
  { valor: 3, label: '⚡ Exprés', desc: '±3' },
  { valor: 5, label: '🎯 Corta', desc: '±5' },
  { valor: 7, label: '🔥 Media', desc: '±7' },
  { valor: 10, label: '🏔️ Larga', desc: '±10' },
];

function CompeticionPot({ isMobile, onSalir }) {
  const [tipo, setTipo] = useState('calcular');
  const [limite, setLimite] = useState(5);
  const [variante, setVariante] = useState('pika'); // 'pika' | 'svg'
  const [diff, setDiff] = useState(0);
  const [ganador, setGanador] = useState(null);
  const [p1, setP1] = useState(0);
  const [p2, setP2] = useState(0);
  const [ronda, setRonda] = useState(0);

  useEffect(() => { if (!ganador && Math.abs(diff) >= limite) setGanador(diff < 0 ? 1 : 2); }, [diff, ganador, limite]);

  const reiniciar = () => { setDiff(0); setGanador(null); setP1(0); setP2(0); setRonda((r) => r + 1); };
  const cambiar = (fn) => { fn(); reiniciar(); };

  const aplicar = (jugador, ok) => {
    if (ganador) return;
    if (ok) (jugador === 1 ? setP1 : setP2)((v) => v + 1);
    const delta = ok ? (jugador === 1 ? -1 : 1) : (jugador === 1 ? 1 : -1);
    setDiff((prev) => Math.max(-limite, Math.min(limite, prev + delta)));
  };

  return (
    <div>
      <style>{CUERDA_CSS}</style>
      <div style={{ background: '#fff9e6', border: '2px solid #f39c12', borderRadius: 12, padding: '10px 14px', marginBottom: 12, fontSize: '0.85rem', color: '#7d6608', fontWeight: 700 }}>
        <div style={{ textAlign: 'center', marginBottom: 8 }}>🪢 <b>Competición</b> · Acierta para tirar de la cuerda · Falla y el rival gana terreno</div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap', alignItems: 'center' }}>
          <span>Tipo:</span>
          <select value={tipo} onChange={(e) => cambiar(() => setTipo(e.target.value))} style={{ padding: '6px 10px', borderRadius: 10, border: '2px solid #f39c12', fontWeight: 700, background: 'white', cursor: 'pointer' }}>
            {MODOS_JUEGO.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
          </select>
          <span style={{ marginLeft: 8 }}>Meta:</span>
          {METAS_POT.map((m) => (
            <button key={m.valor} onClick={() => cambiar(() => setLimite(m.valor))}
              style={{ padding: '5px 11px', borderRadius: 20, cursor: 'pointer', fontWeight: 800, fontSize: '0.78rem', border: '2px solid #f39c12', background: limite === m.valor ? '#f39c12' : 'white', color: limite === m.valor ? 'white' : '#b9770f' }}>
              {m.label} <span style={{ opacity: 0.8 }}>{m.desc}</span>
            </button>
          ))}
          <span style={{ marginLeft: 8 }}>Animación:</span>
          {[{ id: 'pika', label: '🕹️ Muñecos' }, { id: 'svg', label: '✏️ Dibujo' }].map((v) => (
            <button key={v.id} onClick={() => setVariante(v.id)}
              style={{ padding: '5px 11px', borderRadius: 20, cursor: 'pointer', fontWeight: 800, fontSize: '0.78rem', border: '2px solid #8e44ad', background: variante === v.id ? '#8e44ad' : 'white', color: variante === v.id ? 'white' : '#8e44ad' }}>
              {v.label}
            </button>
          ))}
        </div>
      </div>

      <ZonaCuerda diff={diff} ganador={ganador} limite={limite} variant={variante} />

      <div style={{ display: 'flex', gap: 16, marginTop: 14, alignItems: 'flex-start' }}>
        <TableroPot key={`c1-${tipo}-${ronda}`} isMobile={isMobile} fixedMode={tipo} panelLabel="🔵 Equipo 1" panelColor="#3498db" competitivo onResultado={(ok) => aplicar(1, ok)} bloqueado={!!ganador} />
        <div style={{ width: 4, background: '#e2e8f0', alignSelf: 'stretch', borderRadius: 4 }} />
        <TableroPot key={`c2-${tipo}-${ronda}`} isMobile={isMobile} fixedMode={tipo} panelLabel="🔴 Equipo 2" panelColor="#e74c3c" competitivo onResultado={(ok) => aplicar(2, ok)} bloqueado={!!ganador} />
      </div>

      {ganador && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 10002, gap: 14, padding: 20 }}>
          <div style={{ fontSize: '4.5rem' }}>🏆</div>
          <div style={{ fontSize: '2.2rem', fontWeight: 900, color: ganador === 1 ? '#42A5F5' : '#EF5350', textAlign: 'center' }}>¡Gana el Equipo {ganador}!</div>
          <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.95rem' }}>🔵 Equipo 1: {p1} aciertos · 🔴 Equipo 2: {p2} aciertos</div>
          <div style={{ display: 'flex', gap: 12, marginTop: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
            <button onClick={reiniciar} style={{ padding: '13px 32px', fontSize: '1rem', fontWeight: 900, border: 'none', borderRadius: 16, background: 'linear-gradient(135deg,#f093fb,#f5576c)', color: 'white', cursor: 'pointer' }}>🔄 Revancha</button>
            <button onClick={onSalir} style={{ padding: '13px 24px', fontSize: '0.9rem', fontWeight: 900, borderRadius: 16, background: 'transparent', color: 'rgba(255,255,255,0.7)', border: '2px solid rgba(255,255,255,0.25)', cursor: 'pointer' }}>← Salir</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Modal "Enviar al profesor" ────────────────────────────────────────────────
function ModalEnviarProfe({ stats, isMobile, onClose }) {
  const [codigo, setCodigo] = useState('');
  const [nombre, setNombre] = useState('');
  const [curso, setCurso] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [error, setError] = useState('');

  const porTipo = Object.keys(stats).map((id) => {
    const s = stats[id];
    return { id, label: MODE_LABEL[id] || id, intentos: s.intentos, aciertos: s.aciertos, porcentaje: s.intentos ? Math.round((s.aciertos / s.intentos) * 100) : 0 };
  });
  const totalInt = porTipo.reduce((a, t) => a + t.intentos, 0);
  const totalAc = porTipo.reduce((a, t) => a + t.aciertos, 0);
  const pct = totalInt ? Math.round((totalAc / totalInt) * 100) : 0;

  const enviar = async () => {
    const code = codigo.trim().toUpperCase();
    if (!nombre.trim()) { setError('Escribe tu nombre.'); return; }
    if (!code) { setError('Escribe el código del profesor.'); return; }
    if (totalInt === 0) { setError('Primero corrige algún ejercicio.'); return; }
    setEnviando(true); setError('');
    try {
      const snap = await getDoc(doc(db, 'codigos_profesor', code));
      if (!snap.exists()) { setError('Código de profesor no encontrado.'); setEnviando(false); return; }
      await addDoc(collection(db, 'informes_juegos'), {
        tipo: 'POTENCIAS_RAICES',
        modalidad: 'Individual',
        fecha: new Date(),
        codigoProfesor: code,
        jugadores: [{ nombre: nombre.trim(), curso: curso.trim(), aciertos: totalAc, intentos: totalInt, porcentaje: pct, porTipo }],
      });
      setEnviado(true);
    } catch (e) { setError('Error al enviar: ' + e.message); }
    setEnviando(false);
  };

  const inp = { padding: '9px 12px', borderRadius: 9, border: '1.5px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.08)', color: 'white', fontSize: '0.9rem', outline: 'none', width: '100%', boxSizing: 'border-box', fontFamily: 'inherit' };
  const pctColor = (p) => p >= 75 ? '#2ecc71' : p >= 50 ? '#f1c40f' : '#e74c3c';

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 10001, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: '#1e272e', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 20, width: '100%', maxWidth: 420, maxHeight: '90vh', overflowY: 'auto', padding: '24px 26px', color: 'white', fontFamily: "'Segoe UI',sans-serif" }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <h3 style={{ margin: 0, fontSize: '1.05rem', color: '#f1c40f' }}>📤 Enviar al profesor</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#aaa', fontSize: '1.2rem' }}>✕</button>
        </div>

        {enviado ? (
          <div style={{ textAlign: 'center', padding: '18px 0' }}>
            <div style={{ fontSize: '3rem' }}>✅</div>
            <div style={{ color: '#2ecc71', fontWeight: 700 }}>¡Informe enviado!</div>
            <div style={{ color: '#aaa', fontSize: '0.88rem', marginTop: 8 }}>{totalAc}/{totalInt} aciertos ({pct}%)</div>
            <button onClick={onClose} style={{ marginTop: 16, padding: '9px 22px', borderRadius: 10, border: 'none', background: 'rgba(255,255,255,0.1)', cursor: 'pointer', color: 'white' }}>Cerrar</button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 12, padding: '12px 14px', fontSize: '0.82rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ color: '#aaa' }}>Puntuación global</span>
                <span style={{ fontWeight: 800, color: pctColor(pct) }}>{pct}% ({totalAc}/{totalInt})</span>
              </div>
              {porTipo.length > 0 && (
                <div style={{ marginTop: 6, borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 8 }}>
                  <div style={{ color: '#aaa', marginBottom: 4 }}>Por tipo de ejercicio:</div>
                  {porTipo.map((t) => (
                    <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '1px 0' }}>
                      <span>{t.label}</span>
                      <span style={{ fontWeight: 700, color: pctColor(t.porcentaje) }}>{t.porcentaje}% ({t.aciertos}/{t.intentos})</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div><label style={{ fontSize: '0.78rem', color: '#aaa', fontWeight: 600, display: 'block', marginBottom: 4 }}>Nombre y apellidos</label>
              <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Tu nombre completo" style={inp} /></div>
            <div><label style={{ fontSize: '0.78rem', color: '#aaa', fontWeight: 600, display: 'block', marginBottom: 4 }}>Curso</label>
              <input value={curso} onChange={(e) => setCurso(e.target.value)} placeholder="Ej: 4º ESO B" style={inp} /></div>
            <div><label style={{ fontSize: '0.78rem', color: '#aaa', fontWeight: 600, display: 'block', marginBottom: 4 }}>Código del profesor</label>
              <input value={codigo} onChange={(e) => setCodigo(e.target.value.toUpperCase())} placeholder="Ej: PROF01" maxLength={10} style={{ ...inp, letterSpacing: 2, fontWeight: 700 }} /></div>
            {error && <div style={{ color: '#e74c3c', fontSize: '0.8rem' }}>⚠ {error}</div>}
            <div style={{ display: 'flex', gap: 9, marginTop: 4 }}>
              <button onClick={onClose} style={{ flex: 1, padding: '10px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.2)', background: 'transparent', cursor: 'pointer', color: 'white' }}>Cancelar</button>
              <button onClick={enviar} disabled={enviando} style={{ flex: 2, padding: '10px', borderRadius: 10, border: 'none', background: enviando ? '#555' : 'linear-gradient(135deg,#3498db,#2980b9)', color: 'white', fontWeight: 700, cursor: enviando ? 'default' : 'pointer' }}>{enviando ? 'Enviando…' : '📤 Enviar'}</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Componente principal ──────────────────────────────────────────────────────
export default function PotenciasRaices({ onExit }) {
  const [isMobile, setIsMobile] = useState(false);
  const [activeTab, setActiveTab] = useState('theory');
  const [items, setItems] = useState([]);
  const [answers, setAnswers] = useState({});
  const [results, setResults] = useState({});
  const [explica, setExplica] = useState(null); // clave de EXPLICACIONES o null
  const [puntuacion, setPuntuacion] = useState(null); // { aciertos, total, pct } del último Corregir
  const [stats, setStats] = useState({}); // { modoId: { intentos, aciertos } } acumulado en la sesión
  const [mostrarEnvio, setMostrarEnvio] = useState(false);
  const [dualMode, setDualMode] = useState(false);
  const [competicion, setCompeticion] = useState(false);

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 800);
    onResize(); window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // El modo dual/competición solo en escritorio; la competición vive dentro del dual
  useEffect(() => { if (isMobile) { setDualMode(false); setCompeticion(false); } }, [isMobile]);
  useEffect(() => { if (!dualMode) setCompeticion(false); }, [dualMode]);

  const modoActual = MODES.find((m) => m.id === activeTab);

  const generar = () => {
    if (modoActual?.gen) { setItems(modoActual.gen()); setAnswers({}); setResults({}); setPuntuacion(null); }
  };
  useEffect(() => { generar(); /* eslint-disable-next-line */ }, [activeTab]);

  const updateAnswer = (id, field, value) => {
    setAnswers((prev) => ({ ...prev, [id]: { ...(prev[id] || {}), [field]: value } }));
    setResults((prev) => ({ ...prev, [id]: null }));
  };

  const checkItem = (item) => checkAns(item, answers[item.id] || {});

  const corregir = () => {
    if (items.length === 0) return;
    const res = {};
    let ok = 0;
    items.forEach((it) => { const c = checkItem(it); res[it.id] = c ? 'correct' : 'incorrect'; if (c) ok++; });
    setResults(res);
    const total = items.length;
    const pct = Math.round((ok / total) * 100);
    setPuntuacion({ aciertos: ok, total, pct });
    playSound(pct >= 75 ? 'correct' : 'incorrect');
    // Acumular estadísticas por tipo para el informe al profesor
    setStats((prev) => {
      const cur = prev[activeTab] || { intentos: 0, aciertos: 0 };
      return { ...prev, [activeTab]: { intentos: cur.intentos + total, aciertos: cur.aciertos + ok } };
    });
  };

  const tabStyle = (active) => ({
    padding: '12px 16px', cursor: 'pointer', backgroundColor: active ? '#334155' : 'transparent', borderRadius: '8px',
    transition: 'all 0.2s', fontWeight: active ? 'bold' : 'normal', color: active ? '#60a5fa' : '#cbd5e1', whiteSpace: 'nowrap',
  });

  return (
    <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', minHeight: '100vh', width: '100%', fontFamily: '"Segoe UI", Roboto, Helvetica, Arial, sans-serif', backgroundColor: '#eef2f5', boxSizing: 'border-box' }}>
      {/* Sidebar */}
      <div style={{ width: isMobile ? '100%' : '280px', backgroundColor: '#1e293b', color: '#f8fafc', overflowY: 'auto', padding: '18px', display: 'flex', flexDirection: 'column', gap: '10px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
          <h2 style={{ fontSize: '1.25rem', margin: 0, color: '#38bdf8' }}>⚡ Potencias y Raíces</h2>
          {typeof onExit === 'function' && (
            <button onClick={onExit} style={{ background: '#334155', border: 'none', color: 'white', padding: '7px 12px', borderRadius: 10, cursor: 'pointer', fontWeight: 700, fontSize: 12 }}>← Volver</button>
          )}
        </div>
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: isMobile ? 'row' : 'column', gap: '8px', overflowX: isMobile ? 'auto' : 'visible' }}>
          {MODES.map((m) => (
            <li key={m.id} style={tabStyle(activeTab === m.id)} onClick={() => setActiveTab(m.id)}>{m.label}</li>
          ))}
        </ul>

        {/* Modo dual / competición (solo escritorio) */}
        {!isMobile && (
          <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid #334155', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <button onClick={() => { setDualMode((d) => !d); }}
              style={{ padding: '11px 12px', borderRadius: 10, border: '2px solid #22c55e', background: dualMode ? '#22c55e' : 'transparent', color: dualMode ? 'white' : '#86efac', fontWeight: 800, cursor: 'pointer', fontSize: 13 }}>
              👥 {dualMode ? 'Dual activado' : 'Modo Dual (2 jugadores)'}
            </button>
            {dualMode && (
              <button onClick={() => setCompeticion((c) => !c)}
                style={{ padding: '11px 12px', borderRadius: 10, border: '2px solid #f5576c', background: competicion ? '#f5576c' : 'transparent', color: competicion ? 'white' : '#fda4af', fontWeight: 800, cursor: 'pointer', fontSize: 13 }}>
                🪢 {competicion ? 'Competición activada' : 'Competición (tirón de cuerda)'}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Contenido */}
      <div style={{ flex: 1, padding: isMobile ? '18px' : '34px', overflowY: 'auto', backgroundColor: '#ffffff', margin: isMobile ? '10px' : '18px', borderRadius: '16px', boxShadow: '0 10px 25px rgba(0,0,0,0.05)' }}>
        {dualMode && competicion ? (
          <CompeticionPot isMobile={isMobile} onSalir={() => setCompeticion(false)} />
        ) : dualMode ? (
          <div>
            <h1 style={{ color: '#0f172a', marginBottom: '4px', fontSize: isMobile ? '1.4rem' : '1.8rem' }}>👥 Modo Dual</h1>
            <p style={{ color: '#64748b', marginBottom: 18, fontSize: '0.98rem' }}>Dos tableros independientes: cada jugador elige su propio tipo de ejercicio y avanza a su ritmo.</p>
            <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
              <TableroPot isMobile={isMobile} initialMode="calcular" panelLabel="🔵 Jugador 1" panelColor="#3498db" />
              <div style={{ width: 4, background: '#e2e8f0', alignSelf: 'stretch', borderRadius: 4 }} />
              <TableroPot isMobile={isMobile} initialMode="propiedades" panelLabel="🔴 Jugador 2" panelColor="#e74c3c" />
            </div>
          </div>
        ) : activeTab === 'theory' ? (
          <div>
            <h1 style={{ color: '#0f172a', marginBottom: '18px', fontSize: isMobile ? '1.6rem' : '2rem' }}>Repaso de Teoría</h1>
            <h3 style={{ color: '#3b82f6' }}>Propiedades de las potencias <span style={{ fontSize: '0.8rem', fontWeight: 400, color: '#64748b' }}>— pulsa una tarjeta para ver <b>por qué</b> 🎬</span></h3>
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fit, minmax(${isMobile ? '220px' : '300px'}, 1fr))`, gap: '16px', marginBottom: 28 }}>
              {TEORIA_POTENCIAS.map((t, i) => {
                const tieneExpl = !!EXPLICACIONES[t.k];
                return (
                  <div key={i} onClick={() => tieneExpl && setExplica(t.k)}
                    style={{ position: 'relative', padding: '18px', backgroundColor: '#f8fafc', borderLeft: '5px solid #3b82f6', borderRadius: '0 12px 12px 0', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: tieneExpl ? 'pointer' : 'default', transition: 'transform 0.12s, box-shadow 0.12s' }}
                    onMouseEnter={(e) => { if (tieneExpl) { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 6px 16px rgba(59,130,246,0.18)'; } }}
                    onMouseLeave={(e) => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none'; }}>
                    {renderMath(t.f, isMobile)}
                    {tieneExpl && (
                      <span style={{ position: 'absolute', top: 6, right: 8, fontSize: '0.68rem', fontWeight: 700, color: '#3b82f6', background: '#e0edff', borderRadius: 20, padding: '2px 8px' }}>🎬 ¿Por qué?</span>
                    )}
                  </div>
                );
              })}
            </div>
            <h3 style={{ color: '#10b981' }}>Propiedades de las raíces <span style={{ fontSize: '0.8rem', fontWeight: 400, color: '#64748b' }}>— pulsa una tarjeta para ver <b>por qué</b> 🎬</span></h3>
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fit, minmax(${isMobile ? '220px' : '300px'}, 1fr))`, gap: '16px' }}>
              {TEORIA_RAICES.map((t, i) => {
                const tieneExpl = !!EXPLICACIONES[t.k];
                return (
                  <div key={i} onClick={() => tieneExpl && setExplica(t.k)}
                    style={{ position: 'relative', padding: '18px', backgroundColor: '#f0fdf4', borderLeft: '5px solid #10b981', borderRadius: '0 12px 12px 0', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: tieneExpl ? 'pointer' : 'default', transition: 'transform 0.12s, box-shadow 0.12s' }}
                    onMouseEnter={(e) => { if (tieneExpl) { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 6px 16px rgba(16,185,129,0.18)'; } }}
                    onMouseLeave={(e) => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none'; }}>
                    {renderMath(t.f, isMobile)}
                    {tieneExpl && (
                      <span style={{ position: 'absolute', top: 6, right: 8, fontSize: '0.68rem', fontWeight: 700, color: '#10b981', background: '#d1fae5', borderRadius: 20, padding: '2px 8px' }}>🎬 ¿Por qué?</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div>
            <h1 style={{ color: '#0f172a', marginBottom: '6px', fontSize: isMobile ? '1.4rem' : '1.8rem' }}>{modoActual.label}</h1>
            <p style={{ color: '#64748b', marginBottom: '18px', fontSize: isMobile ? '0.95rem' : '1.05rem' }}>{modoActual.desc}</p>

            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 18, alignItems: 'center' }}>
              <button onClick={corregir} style={{ padding: '12px 22px', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '1.05rem', fontWeight: 'bold', boxShadow: '0 4px 6px rgba(16,185,129,0.2)' }}>✅ Corregir</button>
              <button onClick={generar} style={{ padding: '12px 22px', backgroundColor: '#6366f1', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '1.05rem', fontWeight: 'bold', boxShadow: '0 4px 6px rgba(99,102,241,0.2)' }}>🎲 Generar nuevos</button>
              <button onClick={() => setMostrarEnvio(true)} style={{ padding: '12px 22px', background: 'linear-gradient(135deg,#f1c40f,#e67e22)', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '1.05rem', fontWeight: 'bold', boxShadow: '0 4px 6px rgba(230,126,34,0.25)' }}>📤 Enviar al profesor</button>
            </div>

            {puntuacion && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', marginBottom: 22, padding: '14px 18px', borderRadius: 12,
                background: puntuacion.pct >= 75 ? '#ecfdf5' : '#fef2f2', border: `2px solid ${puntuacion.pct >= 75 ? '#10b981' : '#ef4444'}` }}>
                <span style={{ fontSize: '2rem', fontWeight: 900, color: puntuacion.pct >= 75 ? '#10b981' : '#ef4444' }}>{puntuacion.pct}%</span>
                <div style={{ flex: 1, minWidth: 160 }}>
                  <div style={{ fontWeight: 700, color: '#0f172a' }}>{puntuacion.aciertos} de {puntuacion.total} correctos</div>
                  <div style={{ fontSize: '0.85rem', color: puntuacion.pct >= 75 ? '#059669' : '#dc2626', fontWeight: 600 }}>
                    {puntuacion.pct >= 75 ? '🎉 ¡Muy bien! Has superado el 75%.' : '💪 Aún no llegas al 75%. ¡Inténtalo de nuevo!'}
                  </div>
                  <div style={{ marginTop: 6, height: 8, background: '#e5e7eb', borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${puntuacion.pct}%`, background: puntuacion.pct >= 75 ? '#10b981' : '#ef4444', transition: 'width 0.4s' }} />
                  </div>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '18px' }}>
              {items.map((item) => (
                <div key={item.id} style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', alignItems: 'center', justifyContent: 'center', gap: isMobile ? '10px' : '24px', padding: '18px', backgroundColor: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0', width: '100%', boxSizing: 'border-box' }}>
                  <div style={{ flex: 1, display: 'flex', justifyContent: isMobile ? 'center' : 'flex-end', color: '#1e293b', width: '100%' }}>
                    {renderMath(item.q, isMobile)}
                  </div>
                  <span style={{ fontSize: '1.3rem', fontWeight: 'bold', color: '#94a3b8', display: isMobile ? 'none' : 'block' }}>=</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <AnswerInputs item={item} u={answers[item.id] || {}} onChange={(f, v) => updateAnswer(item.id, f, v)} isMobile={isMobile} />
                    {results[item.id] === 'correct' && <span style={{ color: '#10b981', fontSize: '1.6rem', fontWeight: 'bold' }}>✓</span>}
                    {results[item.id] === 'incorrect' && <span style={{ color: '#ef4444', fontSize: '1.6rem', fontWeight: 'bold' }}>✗</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {explica && EXPLICACIONES[explica] && (
        <ExplicaModal data={EXPLICACIONES[explica]} isMobile={isMobile} onClose={() => setExplica(null)} />
      )}
      {mostrarEnvio && (
        <ModalEnviarProfe stats={stats} isMobile={isMobile} onClose={() => setMostrarEnvio(false)} />
      )}
    </div>
  );
}
