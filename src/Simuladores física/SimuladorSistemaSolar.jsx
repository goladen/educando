// Simulador del Sistema Solar — pikt.es
// Cuatro vistas 3D (escala real · comparar tamaños · órbitas · galaxia) +
// panel informativo por cuerpo + test de 30 preguntas.
import { useState, useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import mercuryUrl from '../assets/solar/mercury.png';
import venusUrl from '../assets/solar/venus.png';
import earthUrl from '../assets/solar/earth.png';
import marsUrl from '../assets/solar/mars.png';
import jupiterUrl from '../assets/solar/jupiter.png';
import saturnUrl from '../assets/solar/saturn.png';
import uranusUrl from '../assets/solar/uranus.png';
import neptuneUrl from '../assets/solar/neptune.png';
import moonUrl from '../assets/solar/moon.png';
import milkywayUrl from '../assets/solar/milkyway.png';

const TEX = {
  Mercurio: mercuryUrl, Venus: venusUrl, Tierra: earthUrl, Marte: marsUrl,
  Jupiter: jupiterUrl, Saturno: saturnUrl, Urano: uranusUrl, Neptuno: neptuneUrl, Luna: moonUrl
};

const C_LUZ = 299792;          // km/s
const V_NAVE = 58000;          // km/h (nave rápida tipo New Horizons)

// ------------------------------------------------------------------ DATOS
// radioKm, masaKg, masaRel (Tierra=1), gravedad m/s² (relTierra), distSolKm (media),
// distTierraKm (aproximación mínima), rotacionH (día sidéreo, |valor|), orbitaDias (año),
// inclAxial (°), retro (rotación retrógrada), visR/orbR (vista órbitas)
const CUERPOS = [
  {
    id: 'Sol', nombre: 'Sol', tipo: 'estrella', color: '#ffcc33', tex: null,
    radioKm: 696340, masaKg: 1.989e30, masaRel: 333000, gravedad: 274, gravRel: 27.9,
    distSolKm: 0, distTierraKm: 149600000, rotacionH: 609.12, orbitaDias: null,
    inclAxial: 7.25, retro: false, temp: '5.500 °C (superficie) · 15 millones °C (núcleo)', lunas: '—',
    visR: 9, orbR: 0, orbColor: '#ffcc33',
    curiosidad: 'La estrella central del sistema solar. En su interior cabrían más de un millón de Tierras y concentra el 99,8 % de toda la masa del sistema solar. Orbita el centro de la Vía Láctea una vez cada ~225 millones de años.'
  },
  {
    id: 'Mercurio', nombre: 'Mercurio', tipo: 'planeta', color: '#a9a9a9', tex: TEX.Mercurio,
    radioKm: 2439.7, masaKg: 3.285e23, masaRel: 0.055, gravedad: 3.7, gravRel: 0.38,
    distSolKm: 57900000, distTierraKm: 91700000, rotacionH: 1407.6, orbitaDias: 88,
    inclAxial: 0.03, retro: false, temp: '430 °C de día · −180 °C de noche', lunas: 0,
    visR: 1.1, orbR: 16, orbColor: '#b0a08f',
    curiosidad: 'El planeta más pequeño y el más cercano al Sol. No tiene atmósfera, así que sufre temperaturas extremas. Un año dura solo 88 días terrestres, pero un día solar dura 176 días.'
  },
  {
    id: 'Venus', nombre: 'Venus', tipo: 'planeta', color: '#e8c07d', tex: TEX.Venus,
    radioKm: 6051.8, masaKg: 4.867e24, masaRel: 0.815, gravedad: 8.87, gravRel: 0.90,
    distSolKm: 108200000, distTierraKm: 41400000, rotacionH: 5832.5, orbitaDias: 224.7,
    inclAxial: 177.4, retro: true, temp: '465 °C (el más caliente)', lunas: 0,
    visR: 1.7, orbR: 21, orbColor: '#e0b877',
    curiosidad: 'El planeta más caliente del sistema solar por su denso efecto invernadero de CO₂. Gira al revés que los demás y muy despacio: su día dura más que su año. El Sol allí sale por el oeste.'
  },
  {
    id: 'Tierra', nombre: 'Tierra', tipo: 'planeta', color: '#4f94d4', tex: TEX.Tierra,
    radioKm: 6371, masaKg: 5.972e24, masaRel: 1, gravedad: 9.81, gravRel: 1,
    distSolKm: 149600000, distTierraKm: 0, rotacionH: 23.93, orbitaDias: 365.25,
    inclAxial: 23.44, retro: false, temp: '15 °C de media', lunas: 1,
    visR: 1.8, orbR: 27, orbColor: '#4f94d4',
    curiosidad: 'Nuestro hogar y el único planeta conocido con vida. El agua líquida y su atmósfera protectora la hacen única. La inclinación de su eje (23,4°) produce las estaciones.'
  },
  {
    id: 'Luna', nombre: 'Luna', tipo: 'satelite', color: '#cccccc', tex: TEX.Luna,
    radioKm: 1737.4, masaKg: 7.342e22, masaRel: 0.0123, gravedad: 1.62, gravRel: 0.166,
    distSolKm: 149600000, distTierraKm: 384400, rotacionH: 655.7, orbitaDias: 27.3,
    inclAxial: 6.68, retro: false, temp: '127 °C de día · −173 °C de noche', lunas: '—',
    visR: 0.5, orbR: 3.4, orbColor: '#cccccc',
    curiosidad: 'El único satélite natural de la Tierra y el único lugar fuera de ella que ha pisado el ser humano. Su gravedad genera las mareas. Siempre nos muestra la misma cara (rotación síncrona).'
  },
  {
    id: 'Marte', nombre: 'Marte', tipo: 'planeta', color: '#c1440e', tex: TEX.Marte,
    radioKm: 3389.5, masaKg: 6.39e23, masaRel: 0.107, gravedad: 3.71, gravRel: 0.38,
    distSolKm: 227900000, distTierraKm: 78300000, rotacionH: 24.62, orbitaDias: 687,
    inclAxial: 25.19, retro: false, temp: '−63 °C de media', lunas: 2,
    visR: 1.3, orbR: 34, orbColor: '#c1653e',
    curiosidad: 'El planeta rojo, por el óxido de hierro de su suelo. Alberga el volcán más alto del sistema solar, el Monte Olimpo (22 km), y el cañón Valles Marineris. Tiene dos lunas: Fobos y Deimos.'
  },
  {
    id: 'Jupiter', nombre: 'Júpiter', tipo: 'planeta', color: '#d8ca9d', tex: TEX.Jupiter,
    radioKm: 69911, masaKg: 1.898e27, masaRel: 317.8, gravedad: 24.79, gravRel: 2.53,
    distSolKm: 778500000, distTierraKm: 628900000, rotacionH: 9.93, orbitaDias: 4333,
    inclAxial: 3.13, retro: false, temp: '−145 °C (nubes)', lunas: 95,
    visR: 4.6, orbR: 48, orbColor: '#d8ca9d',
    curiosidad: 'El planeta más grande: su masa dobla y media a la de todos los demás juntos. La Gran Mancha Roja es una tormenta más grande que la Tierra activa desde hace más de 350 años. Su día dura menos de 10 horas.'
  },
  {
    id: 'Saturno', nombre: 'Saturno', tipo: 'planeta', color: '#e3d9b0', tex: TEX.Saturno, anillos: true,
    radioKm: 58232, masaKg: 5.683e26, masaRel: 95.2, gravedad: 10.44, gravRel: 1.07,
    distSolKm: 1434000000, distTierraKm: 1284400000, rotacionH: 10.7, orbitaDias: 10759,
    inclAxial: 26.73, retro: false, temp: '−178 °C', lunas: 146,
    visR: 3.9, orbR: 62, orbColor: '#e3d9b0',
    curiosidad: 'Famoso por sus anillos de hielo y roca. Es tan poco denso que flotaría en el agua. Tiene más de 140 lunas conocidas, incluida Titán, la única luna con atmósfera densa.'
  },
  {
    id: 'Urano', nombre: 'Urano', tipo: 'planeta', color: '#9fe6e6', tex: TEX.Urano,
    radioKm: 25362, masaKg: 8.681e25, masaRel: 14.5, gravedad: 8.69, gravRel: 0.89,
    distSolKm: 2871000000, distTierraKm: 2721400000, rotacionH: 17.24, orbitaDias: 30687,
    inclAxial: 97.77, retro: true, temp: '−224 °C (el más frío)', lunas: 28,
    visR: 2.6, orbR: 76, orbColor: '#9fe6e6',
    curiosidad: 'El planeta más frío. Gira “tumbado”, con el eje inclinado 98°, probablemente por un impacto gigante. Por eso sus polos reciben más luz que el ecuador. Fue el primer planeta descubierto con telescopio.'
  },
  {
    id: 'Neptuno', nombre: 'Neptuno', tipo: 'planeta', color: '#3b5bdb', tex: TEX.Neptuno,
    radioKm: 24622, masaKg: 1.024e26, masaRel: 17.1, gravedad: 11.15, gravRel: 1.14,
    distSolKm: 4495000000, distTierraKm: 4345400000, rotacionH: 16.11, orbitaDias: 60190,
    inclAxial: 28.32, retro: false, temp: '−214 °C', lunas: 16,
    visR: 2.5, orbR: 90, orbColor: '#3b5bdb',
    curiosidad: 'El planeta más lejano del Sol. Tiene los vientos más rápidos del sistema solar, de más de 2.100 km/h. Un año dura 165 años terrestres. Se descubrió por cálculos matemáticos antes de verlo.'
  }
];
const PLANETAS_ORBITA = CUERPOS.filter(c => c.tipo === 'planeta');

// ------------------------------------------------------------ formateadores
const nf = (n) => n.toLocaleString('es-ES', { maximumFractionDigits: 0 });
const fmtMasa = (kg) => {
  const e = Math.floor(Math.log10(kg));
  const m = (kg / Math.pow(10, e)).toFixed(2);
  return `${m} × 10${sup(e)} kg`;
};
const sup = (n) => String(n).replace(/-/g, '⁻').replace(/[0-9]/g, d => '⁰¹²³⁴⁵⁶⁷⁸⁹'[d]);
const fmtLuz = (distKm) => {
  if (distKm === 0) return '—';
  const s = distKm / C_LUZ;
  if (s < 60) return `${s.toFixed(1)} s`;
  if (s < 3600) return `${(s / 60).toFixed(1)} min`;
  return `${(s / 3600).toFixed(2)} h`;
};
const fmtDia = (h) => h < 48 ? `${h.toFixed(1)} h` : `${(h / 24).toFixed(1)} días terrestres`;
const fmtAnio = (d) => {
  if (d == null) return '≈ 225 millones de años (órbita galáctica)';
  if (d < 400) return `${d.toFixed(d < 100 ? 0 : 1)} días terrestres`;
  const y = d / 365.25;
  return y < 3 ? `${y.toFixed(2)} años terrestres` : `${y.toFixed(1)} años terrestres`;
};
const fmtViaje = (distKm) => {
  if (distKm === 0) return 'Estás aquí 🌍';
  const horas = distKm / V_NAVE;
  const dias = horas / 24;
  const anios = dias / 365.25;
  if (anios >= 1) return `≈ ${anios.toFixed(anios < 10 ? 1 : 0)} años`;
  if (dias >= 1) return `≈ ${dias.toFixed(0)} días`;
  return `≈ ${horas.toFixed(0)} horas`;
};

// ------------------------------------------------------------------ TEST
const PREGUNTAS = [
  { q: '¿Cuál es el planeta más grande del sistema solar?', opts: ['Saturno', 'Júpiter', 'La Tierra', 'Neptuno'], ok: 1, exp: 'Júpiter: su masa dobla y media a la de todos los demás planetas juntos.' },
  { q: '¿Qué planeta es el más caliente?', opts: ['Mercurio', 'Venus', 'Marte', 'Júpiter'], ok: 1, exp: 'Venus (465 °C) por su efecto invernadero, aunque Mercurio está más cerca del Sol.' },
  { q: '¿Cuánto tarda la luz del Sol en llegar a la Tierra?', opts: ['8 segundos', '8 minutos y medio', '8 horas', 'Un instante'], ok: 1, exp: 'Unos 500 segundos: 150 millones de km ÷ 300.000 km/s.' },
  { q: '¿Qué planeta gira “tumbado”, con el eje inclinado 98°?', opts: ['Urano', 'Neptuno', 'Saturno', 'Venus'], ok: 0, exp: 'Urano gira de lado, probablemente por un impacto gigante.' },
  { q: '¿Cuál es el planeta más cercano al Sol?', opts: ['Venus', 'La Tierra', 'Mercurio', 'Marte'], ok: 2, exp: 'Mercurio, a unos 58 millones de km del Sol.' },
  { q: '¿Qué planeta tiene el famoso sistema de anillos de hielo y roca?', opts: ['Júpiter', 'Urano', 'Saturno', 'Neptuno'], ok: 2, exp: 'Saturno, aunque todos los gigantes gaseosos tienen anillos, los suyos son espectaculares.' },
  { q: 'La Gran Mancha Roja es una tormenta gigante de…', opts: ['Marte', 'Júpiter', 'Neptuno', 'El Sol'], ok: 1, exp: 'Está en Júpiter y lleva activa más de 350 años; cabe más de una Tierra dentro.' },
  { q: '¿Cuál es el planeta más frío del sistema solar?', opts: ['Neptuno', 'Urano', 'Plutón', 'Saturno'], ok: 1, exp: 'Urano, con −224 °C, incluso más frío que Neptuno pese a estar más cerca del Sol.' },
  { q: '¿Cuántos días terrestres dura un año en Mercurio?', opts: ['88 días', '225 días', '365 días', '687 días'], ok: 0, exp: 'Solo 88 días: es el planeta con el año más corto.' },
  { q: '¿Qué planeta es conocido como “el planeta rojo”?', opts: ['Venus', 'Marte', 'Júpiter', 'Mercurio'], ok: 1, exp: 'Marte, por el óxido de hierro (herrumbre) de su superficie.' },
  { q: '¿Qué porcentaje de la masa del sistema solar concentra el Sol?', opts: ['50 %', '75 %', '99,8 %', '90 %'], ok: 2, exp: 'El Sol reúne el 99,8 % de toda la masa del sistema solar.' },
  { q: 'En Venus, un día dura…', opts: ['Menos de una hora', 'Más que su propio año', 'Exactamente 24 h', 'Igual que en la Tierra'], ok: 1, exp: 'Venus rota tan despacio que su día (243 días) supera a su año (225 días).' },
  { q: '¿Cuál es el volcán más alto del sistema solar?', opts: ['El Everest', 'El Monte Olimpo (Marte)', 'El Mauna Kea', 'Un volcán de Venus'], ok: 1, exp: 'El Monte Olimpo, en Marte, con unos 22 km de altura, casi 3 veces el Everest.' },
  { q: '¿Qué luna es la mayor del sistema solar?', opts: ['La Luna', 'Titán', 'Ganímedes', 'Europa'], ok: 2, exp: 'Ganímedes, luna de Júpiter, es mayor incluso que el planeta Mercurio.' },
  { q: '¿Cuánto tarda la luz de la Luna en llegar a la Tierra?', opts: ['0,001 s', '1,3 segundos', '1,3 minutos', '13 segundos'], ok: 1, exp: '384.400 km ÷ 300.000 km/s ≈ 1,28 segundos.' },
  { q: '¿Qué planeta tiene los vientos más rápidos, de más de 2.100 km/h?', opts: ['Júpiter', 'Saturno', 'Neptuno', 'La Tierra'], ok: 2, exp: 'Neptuno tiene los vientos más veloces del sistema solar.' },
  { q: '¿Cuántos planetas tiene el sistema solar?', opts: ['7', '8', '9', '10'], ok: 1, exp: 'Ocho, desde que Plutón se reclasificó como planeta enano en 2006.' },
  { q: 'La Tierra tarda en dar una vuelta al Sol…', opts: ['24 horas', '30 días', '365,25 días', '687 días'], ok: 2, exp: 'Un año: 365,25 días. Ese cuarto de día extra origina los años bisiestos.' },
  { q: '¿Qué produce las estaciones en la Tierra?', opts: ['La distancia al Sol', 'La inclinación de su eje (23,4°)', 'La velocidad de rotación', 'Las manchas solares'], ok: 1, exp: 'La inclinación del eje hace que cada hemisferio reciba más o menos luz según la época.' },
  { q: '¿Cuál es el planeta menos denso, que flotaría en el agua?', opts: ['Júpiter', 'Saturno', 'Urano', 'Neptuno'], ok: 1, exp: 'Saturno: su densidad es menor que la del agua.' },
  { q: '¿Qué planeta descubrieron primero con cálculos matemáticos, antes de verlo?', opts: ['Urano', 'Neptuno', 'Saturno', 'Marte'], ok: 1, exp: 'Neptuno: se predijo su posición por las alteraciones en la órbita de Urano.' },
  { q: '¿Cuánto pesarías en la Luna respecto a la Tierra?', opts: ['La mitad', 'Una sexta parte', 'Lo mismo', 'El doble'], ok: 1, exp: 'La gravedad lunar es 1/6 de la terrestre (1,62 m/s²).' },
  { q: '¿Qué gas hace que Marte se vea rojo?', opts: ['Metano', 'Óxido de hierro (herrumbre)', 'Dióxido de carbono', 'Azufre'], ok: 1, exp: 'El óxido de hierro del polvo marciano le da el tono rojizo.' },
  { q: 'La velocidad de la luz es de aproximadamente…', opts: ['300 km/s', '3.000 km/s', '300.000 km/s', '30.000 km/s'], ok: 2, exp: '299.792 km/s en el vacío.' },
  { q: '¿Qué satélite es el único que ha pisado el ser humano?', opts: ['Titán', 'La Luna', 'Europa', 'Fobos'], ok: 1, exp: 'La Luna, desde las misiones Apolo (1969-1972).' },
  { q: '¿Cuántas lunas conocidas tiene aproximadamente Saturno?', opts: ['1', '15', 'Más de 140', '4'], ok: 2, exp: 'Más de 140 lunas conocidas, el planeta con más satélites.' },
  { q: '¿Qué luna orbita en dirección contraria a su planeta?', opts: ['La Luna', 'Titán', 'Tritón (Neptuno)', 'Ío'], ok: 2, exp: 'Tritón orbita Neptuno al revés; probablemente fue capturada.' },
  { q: 'Un año en Neptuno equivale a…', opts: ['12 años terrestres', '84 años terrestres', '165 años terrestres', '30 años terrestres'], ok: 2, exp: 'Neptuno tarda 165 años terrestres en dar una vuelta al Sol.' },
  { q: '¿A qué velocidad orbita el Sol alrededor del centro de la galaxia?', opts: ['828.000 km/h', '58.000 km/h', '300.000 km/h', '1.000 km/h'], ok: 0, exp: 'Unos 828.000 km/h; aun así tarda ~225 millones de años en una vuelta.' },
  { q: '¿Por qué desde el espacio los planetas parecen “perdidos” en el vacío?', opts: ['Porque son diminutos', 'Porque las distancias son enormes comparadas con sus tamaños', 'Porque no hay luz', 'Porque se mueven muy rápido'], ok: 1, exp: 'A escala real, el sistema solar es sobre todo espacio vacío: por eso las vistas de órbitas exageran las distancias.' }
];

// ------------------------------------------------------------ LEYES DE NEWTON
const LEYES = [
  {
    n: '1ª', color: '#38bdf8', titulo: 'Ley de la inercia',
    enunciado: 'Todo cuerpo permanece en reposo o en movimiento rectilíneo uniforme si no actúa ninguna fuerza neta sobre él.',
    formula: 'ΣF = 0  ⇒  v = constante',
    espacio: 'En el vacío del espacio casi no hay rozamiento. Por eso una sonda como la Voyager sigue viajando sin motores: nada la frena. Un planeta “querría” ir recto, pero la gravedad del Sol lo curva.'
  },
  {
    n: '2ª', color: '#fbbf24', titulo: 'Ley fundamental de la dinámica',
    enunciado: 'La aceleración que adquiere un cuerpo es proporcional a la fuerza neta y de sentido igual, e inversamente proporcional a su masa.',
    formula: 'F = m · a        a = F / m',
    espacio: 'La misma fuerza mueve más fácil una masa pequeña. La gravedad del Sol curva la trayectoria de cada planeta y le da una aceleración hacia el centro: por eso orbita en vez de escapar.'
  },
  {
    n: '3ª', color: '#34d399', titulo: 'Ley de acción y reacción',
    enunciado: 'Si un cuerpo A ejerce una fuerza sobre otro B, B ejerce sobre A una fuerza igual en módulo y dirección pero de sentido contrario.',
    formula: 'F(A→B) = − F(B→A)',
    espacio: 'Un cohete lanza gases hacia atrás (acción) y los gases lo empujan hacia delante (reacción). El Sol atrae a la Tierra… y la Tierra atrae al Sol con la misma fuerza (pero el Sol, con mucha más masa, apenas se mueve).'
  },
  {
    n: 'G', color: '#a78bfa', titulo: 'Gravitación universal',
    enunciado: 'Dos cuerpos se atraen con una fuerza proporcional al producto de sus masas e inversamente proporcional al cuadrado de la distancia que los separa.',
    formula: 'F = G · m₁ · m₂ / r²      G = 6,67 × 10⁻¹¹ N·m²/kg²',
    espacio: 'Es la fuerza que mantiene a los planetas en órbita. Si se duplica la distancia, la fuerza se hace 4 veces menor (r²). Por eso los planetas lejanos sienten un tirón mucho más débil y orbitan más despacio.'
  }
];

// ---------------------------------------- TEST DE CÁLCULO (ESO, progresivo)
// g = 9,8 m/s². Orden fijo: de menos a más complejo. `tema` = fórmula, para filtrar.
const PROBLEMAS = [
  { tema: 'Fuerza y aceleración', nivel: 'Básico', q: 'Sobre un carrito de 2 kg actúa una fuerza neta de 10 N. ¿Qué aceleración adquiere?', opts: ['5 m/s²', '20 m/s²', '2 m/s²', '12 m/s²'], ok: 0, exp: '2ª ley: a = F / m = 10 / 2 = 5 m/s².' },
  { tema: 'Peso y gravedad', nivel: 'Básico', q: '¿Cuál es el peso (fuerza de la gravedad) de una mochila de 5 kg en la Tierra? (g = 9,8 m/s²)', opts: ['49 N', '5 N', '9,8 N', '98 N'], ok: 0, exp: 'Peso: P = m · g = 5 · 9,8 = 49 N.' },
  { tema: 'Fuerza y aceleración', nivel: 'Básico', q: 'Un coche de 1.000 kg acelera a 2 m/s². ¿Qué fuerza neta lo impulsa?', opts: ['2.000 N', '500 N', '1.000 N', '2 N'], ok: 0, exp: '2ª ley: F = m · a = 1.000 · 2 = 2.000 N.' },
  { tema: '3ª ley (acción-reacción)', nivel: 'Básico', q: 'Empujas una pared con una fuerza de 60 N. ¿Con qué fuerza te empuja la pared a ti?', opts: ['60 N en sentido contrario', '0 N, las paredes no empujan', '120 N', 'Depende de tu masa'], ok: 0, exp: '3ª ley (acción-reacción): la pared te devuelve 60 N en sentido contrario.' },
  { tema: 'Fuerza y aceleración', nivel: 'Básico', q: 'Una caja empujada con 24 N adquiere 3 m/s². ¿Cuál es su masa?', opts: ['8 kg', '72 kg', '27 kg', '21 kg'], ok: 0, exp: 'Despejando de F = m · a: m = F / a = 24 / 3 = 8 kg.' },
  { tema: 'Fuerza y aceleración', nivel: 'Básico', q: 'Una fuerza neta de 18 N actúa sobre un cuerpo de 3 kg. ¿Qué aceleración adquiere?', opts: ['6 m/s²', '15 m/s²', '54 m/s²', '3 m/s²'], ok: 0, exp: '2ª ley: a = F / m = 18 / 3 = 6 m/s².' },
  { tema: 'Peso y gravedad', nivel: 'Básico', q: 'La manzana de Newton tiene una masa de 0,2 kg. ¿Cuánto pesa en la Tierra? (g = 9,8 m/s²)', opts: ['1,96 N', '0,2 N', '9,8 N', '19,6 N'], ok: 0, exp: 'P = m · g = 0,2 · 9,8 = 1,96 N.' },
  { tema: 'Peso y gravedad', nivel: 'Medio', q: 'Un astronauta de 70 kg está en la Luna (g = 1,6 m/s²). ¿Cuánto pesa allí?', opts: ['112 N', '686 N', '70 N', '43,75 N'], ok: 0, exp: 'P = m · g = 70 · 1,6 = 112 N. En la Tierra pesaría 686 N: ¡seis veces más!' },
  { tema: 'Fuerza y aceleración', nivel: 'Medio', q: 'Sobre una caja de 4 kg actúan 30 N hacia la derecha y 10 N hacia la izquierda. ¿Qué aceleración tiene?', opts: ['5 m/s² a la derecha', '10 m/s²', '2,5 m/s²', '40 m/s²'], ok: 0, exp: 'Fuerza neta = 30 − 10 = 20 N. a = F / m = 20 / 4 = 5 m/s² hacia la derecha.' },
  { tema: 'Peso y gravedad', nivel: 'Medio', q: 'Un objeto pesa 588 N en la Tierra (g = 9,8 m/s²). ¿Cuál es su masa?', opts: ['60 kg', '588 kg', '5.762 kg', '98 kg'], ok: 0, exp: 'De P = m · g se despeja m = P / g = 588 / 9,8 = 60 kg. La masa no cambia aunque cambie el planeta.' },
  { tema: 'Ley de la gravitación', nivel: 'Medio', q: 'Si trasladas dos planetas al DOBLE de distancia, ¿qué le pasa a la fuerza gravitatoria entre ellos?', opts: ['Se divide entre 4', 'Se divide entre 2', 'Se duplica', 'No cambia'], ok: 0, exp: 'Como F ∝ 1/r², al duplicar r (×2) la fuerza se divide entre 2² = 4.' },
  { tema: 'Fuerza y aceleración', nivel: 'Medio', q: 'Una fuerza neta de 15 N actúa sobre una masa de 3 kg partiendo del reposo durante 4 s. ¿Qué velocidad alcanza?', opts: ['20 m/s', '5 m/s', '45 m/s', '12 m/s'], ok: 0, exp: 'Primero a = F/m = 15/3 = 5 m/s². Luego v = a · t = 5 · 4 = 20 m/s.' },
  { tema: 'Peso y gravedad', nivel: 'Medio', q: 'Un astronauta de 60 kg visita Marte (g = 3,7 m/s²). ¿Cuánto pesa allí?', opts: ['222 N', '588 N', '60 N', '16,2 N'], ok: 0, exp: 'P = m · g = 60 · 3,7 = 222 N.' },
  { tema: 'Fuerza y aceleración', nivel: 'Medio', q: 'Empujas un baúl de 6 kg con 40 N, pero el rozamiento hace 10 N en contra. ¿Qué aceleración tiene?', opts: ['5 m/s²', '6,7 m/s²', '8,3 m/s²', '30 m/s²'], ok: 0, exp: 'Fuerza neta = 40 − 10 = 30 N. a = F / m = 30 / 6 = 5 m/s².' },
  { tema: 'Fuerza y aceleración', nivel: 'Medio', q: 'Un cuerpo de 2 kg parte del reposo con una fuerza neta de 8 N. ¿Qué velocidad lleva a los 5 s?', opts: ['20 m/s', '4 m/s', '40 m/s', '10 m/s'], ok: 0, exp: 'a = F/m = 8/2 = 4 m/s². v = a · t = 4 · 5 = 20 m/s.' },
  { tema: 'Fuerza y aceleración', nivel: 'Avanzado', q: 'Un cohete de 2.000 kg tiene un empuje de 30.000 N hacia arriba. ¿Con qué aceleración despega? (g = 9,8 m/s²)', opts: ['5,2 m/s²', '15 m/s²', '9,8 m/s²', '25 m/s²'], ok: 0, exp: 'Fuerza neta = empuje − peso = 30.000 − (2.000 · 9,8) = 30.000 − 19.600 = 10.400 N. a = 10.400 / 2.000 = 5,2 m/s².' },
  { tema: 'Ley de la gravitación', nivel: 'Avanzado', q: 'Dos masas de 1.000 kg cada una están separadas 2 m. ¿Cuál es la fuerza gravitatoria entre ellas? (G = 6,67 × 10⁻¹¹)', opts: ['1,67 × 10⁻⁵ N', '3,34 × 10⁻⁵ N', '6,67 × 10⁻⁵ N', '1,67 × 10⁻² N'], ok: 0, exp: 'F = G·m₁·m₂/r² = 6,67e-11 · (1000 · 1000) / 2² = 6,67e-11 · 10⁶ / 4 = 1,67 × 10⁻⁵ N. ¡La gravedad entre objetos normales es diminuta!' },
  { tema: 'Peso y gravedad', nivel: 'Avanzado', q: 'En un planeta la gravedad es el triple que en la Tierra. Un cuerpo de 10 kg, ¿cuánto pesa allí? (g_Tierra = 9,8)', opts: ['294 N', '98 N', '30 N', '980 N'], ok: 0, exp: 'g_planeta = 3 · 9,8 = 29,4 m/s². P = m · g = 10 · 29,4 = 294 N. La masa (10 kg) no cambia.' },
  { tema: 'Fuerza y aceleración', nivel: 'Avanzado', q: 'Una fuerza constante da a un cuerpo de 6 kg una aceleración de 4 m/s². Si aplicas la MISMA fuerza a otro de 2 kg, ¿qué aceleración tendrá?', opts: ['12 m/s²', '4 m/s²', '1,33 m/s²', '8 m/s²'], ok: 0, exp: 'La fuerza es F = 6 · 4 = 24 N. Con la misma fuerza: a = F/m = 24 / 2 = 12 m/s². A menos masa, más aceleración.' },
  { tema: '3ª ley (acción-reacción)', nivel: 'Avanzado', q: 'La Tierra atrae a la Luna con una cierta fuerza. ¿Con qué fuerza atrae la Luna a la Tierra?', opts: ['Con la misma fuerza (3ª ley)', 'Con mucha menos, porque tiene menos masa', 'Con el doble', 'Con ninguna'], ok: 0, exp: '3ª ley: las fuerzas gravitatorias son un par acción-reacción, iguales en módulo. La Luna sufre más aceleración solo porque tiene menos masa (a = F/m).' },
  { tema: 'Energía (Ec y Ep)', nivel: 'Avanzado', q: '¿Cuál es la energía cinética de un coche de 1.000 kg que circula a 20 m/s? (Ec = ½·m·v²)', opts: ['200.000 J', '20.000 J', '10.000 J', '2.000.000 J'], ok: 0, exp: 'Ec = ½ · m · v² = 0,5 · 1.000 · 20² = 0,5 · 1.000 · 400 = 200.000 J.' },
  { tema: 'Energía (Ec y Ep)', nivel: 'Avanzado', q: 'Levantas una caja de 2 kg hasta una estantería a 5 m de altura. ¿Cuánta energía potencial gana? (Ep = m·g·h, g = 9,8)', opts: ['98 J', '10 J', '49 J', '980 J'], ok: 0, exp: 'Ep = m · g · h = 2 · 9,8 · 5 = 98 J.' },
  { tema: 'Ley de la gravitación', nivel: 'Avanzado', q: 'Si TRIPLICAS la distancia entre dos cuerpos, ¿qué le pasa a la fuerza gravitatoria entre ellos?', opts: ['Se divide entre 9', 'Se divide entre 3', 'Se divide entre 6', 'Se multiplica por 3'], ok: 0, exp: 'F ∝ 1/r². Al triplicar r (×3), la fuerza se divide entre 3² = 9.' },
  { tema: 'Fuerza y aceleración', nivel: 'Avanzado', q: 'Sobre un objeto actúan dos fuerzas perpendiculares: 3 N y 4 N. ¿Cuál es la fuerza neta?', opts: ['5 N', '7 N', '1 N', '12 N'], ok: 0, exp: 'Al ser perpendiculares se combinan con el teorema de Pitágoras: F = √(3² + 4²) = √25 = 5 N.' },
  { tema: 'Velocidad orbital', nivel: 'Avanzado', q: '¿Por qué los planetas más lejanos del Sol orbitan más despacio?', opts: ['Porque la gravedad del Sol es más débil a esa distancia', 'Porque son más grandes', 'Porque tienen más lunas', 'Porque hace más frío'], ok: 0, exp: 'La velocidad orbital es v = √(G·M/r): a mayor radio r, menor velocidad. Además el Sol tira menos de ellos (1/r²).' },
  { tema: 'Velocidad orbital', nivel: 'Avanzado', q: '¿Qué fórmula da la velocidad de un satélite en órbita circular alrededor de un planeta de masa M?', opts: ['v = √(G·M/r)', 'v = G·M·r', 'v = ½·m·v²', 'v = m·g'], ok: 0, exp: 'La velocidad orbital es v = √(G·M/r): depende de la masa M del planeta y del radio r de la órbita, no de la masa del satélite.' },
  { tema: 'Velocidad orbital', nivel: 'Avanzado', q: 'Para un satélite, el valor de G·M/r es 64.000.000 m²/s². ¿Cuál es su velocidad orbital? (v = √(G·M/r))', opts: ['8.000 m/s', '32.000 m/s', '4.000 m/s', '64.000.000 m/s'], ok: 0, exp: 'v = √(64.000.000) = 8.000 m/s = 8 km/s, parecida a la de la Estación Espacial.' },
  { tema: 'Velocidad orbital', nivel: 'Avanzado', q: 'Dos satélites orbitan la Tierra, uno a baja altura y otro mucho más lejos. ¿Cuál se mueve más rápido?', opts: ['El más cercano a la Tierra', 'El más lejano', 'Van a la misma velocidad', 'El de mayor masa'], ok: 0, exp: 'Como v = √(G·M/r), a MENOR radio r la velocidad es MAYOR. Los satélites bajos van más rápidos (la ISS, a ~400 km, va a ~28.000 km/h).' },
  { tema: 'Velocidad orbital', nivel: 'Avanzado', q: 'La Estación Espacial va a unos 28.000 km/h. ¿Por qué no se cae a la Tierra?', opts: ['Su gran velocidad la hace “caer” rodeando la Tierra sin llegar al suelo', 'Porque en el espacio no hay gravedad', 'Porque sus motores la sostienen siempre', 'Porque flota como un globo'], ok: 0, exp: 'A esa altura la gravedad es casi igual que en el suelo. La ISS cae constantemente, pero su enorme velocidad horizontal hace que la Tierra se “curve” bajo ella: eso es estar en órbita.' }
];
// temas disponibles para filtrar el test de cálculo (en orden de dificultad)
const TEMAS_CALC = ['Fuerza y aceleración', 'Peso y gravedad', '3ª ley (acción-reacción)', 'Ley de la gravitación', 'Energía (Ec y Ep)', 'Velocidad orbital'];

// =====================================================================
//                         ESCENA 3D
// =====================================================================
const Escena = ({ vista, movil, onSelect, ctrlRef }) => {
  const contRef = useRef(null);

  useEffect(() => {
    const cont = contRef.current;
    if (!cont) return;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(cont.clientWidth, cont.clientHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    cont.appendChild(renderer.domElement);
    renderer.domElement.style.display = 'block';

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x03040a);
    const camera = new THREE.PerspectiveCamera(50, cont.clientWidth / cont.clientHeight, 0.01, 200000);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;

    scene.add(new THREE.AmbientLight(0x334155, 0.5));
    const loader = new THREE.TextureLoader();
    const disposables = [];
    const track = (o) => { disposables.push(o); return o; };

    // ---- campo de estrellas ----
    const starGeo = new THREE.BufferGeometry();
    const N = 2200, sp = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      const r = 8000 + Math.random() * 6000, th = Math.random() * 6.283, ph = Math.acos(2 * Math.random() - 1);
      sp[i * 3] = r * Math.sin(ph) * Math.cos(th); sp[i * 3 + 1] = r * Math.cos(ph); sp[i * 3 + 2] = r * Math.sin(ph) * Math.sin(th);
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(sp, 3));
    const stars = new THREE.Points(starGeo, track(new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: false })));
    scene.add(stars); track(starGeo);

    // glow sprite reutilizable
    const glowCanvas = document.createElement('canvas'); glowCanvas.width = glowCanvas.height = 128;
    const gx = glowCanvas.getContext('2d');
    const gr = gx.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, 'rgba(255,240,200,0.9)'); gr.addColorStop(0.3, 'rgba(255,180,80,0.5)');
    gr.addColorStop(1, 'rgba(255,140,0,0)'); gx.fillStyle = gr; gx.fillRect(0, 0, 128, 128);
    const glowTex = track(new THREE.CanvasTexture(glowCanvas));

    const clickables = [];
    const updaters = [];
    let animForward = null;   // {target, campos} para viaje de cámara
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const hazEsfera = (cuerpo, radio, segw = 48) => {
      const geo = track(new THREE.SphereGeometry(radio, segw, Math.max(24, segw / 2)));
      let mat;
      if (cuerpo.tipo === 'estrella') {
        mat = track(new THREE.MeshBasicMaterial({ color: 0xfff2c4 }));
      } else {
        const t = cuerpo.tex ? track(loader.load(cuerpo.tex)) : null;
        if (t) t.colorSpace = THREE.SRGBColorSpace;
        mat = track(new THREE.MeshStandardMaterial({ map: t, color: t ? 0xffffff : new THREE.Color(cuerpo.color), roughness: 1, metalness: 0 }));
      }
      const mesh = new THREE.Mesh(geo, mat);
      mesh.userData.cuerpo = cuerpo;
      mesh.rotation.z = THREE.MathUtils.degToRad(cuerpo.inclAxial > 90 ? cuerpo.inclAxial - 180 : cuerpo.inclAxial);
      return mesh;
    };
    const anilloSaturno = (radio) => {
      const geo = track(new THREE.RingGeometry(radio * 1.35, radio * 2.3, 96));
      // uv radial para degradado
      const pos = geo.attributes.position; const uv = geo.attributes.uv;
      const v3 = new THREE.Vector3();
      for (let i = 0; i < pos.count; i++) { v3.fromBufferAttribute(pos, i); const rr = v3.length(); uv.setXY(i, (rr - radio * 1.35) / (radio * 0.95), 0.5); }
      // textura de anillo (bandas)
      const rc = document.createElement('canvas'); rc.width = 128; rc.height = 4; const rx = rc.getContext('2d');
      for (let i = 0; i < 128; i++) { const a = 0.15 + 0.6 * Math.abs(Math.sin(i * 0.6)) * (i / 128); rx.fillStyle = `rgba(220,205,170,${a.toFixed(3)})`; rx.fillRect(i, 0, 1, 4); }
      const rt = track(new THREE.CanvasTexture(rc));
      const mat = track(new THREE.MeshBasicMaterial({ map: rt, side: THREE.DoubleSide, transparent: true, opacity: 0.9 }));
      const ring = new THREE.Mesh(geo, mat);
      ring.rotation.x = Math.PI / 2.1;
      return ring;
    };

    // ======================================================= VISTA: ÓRBITAS
    if (vista === 'orbitas') {
      const sol = CUERPOS[0];
      const sunLight = new THREE.PointLight(0xffffff, 3, 0, 0); scene.add(sunLight);
      const solMesh = hazEsfera(sol, sol.visR); scene.add(solMesh); clickables.push(solMesh);
      const solGlow = new THREE.Sprite(track(new THREE.SpriteMaterial({ map: glowTex, blending: THREE.AdditiveBlending, depthWrite: false })));
      solGlow.scale.setScalar(sol.visR * 5); scene.add(solGlow);
      updaters.push((dt, sp) => { solMesh.rotation.y += dt * 0.1 * sp; });

      let earthPivot = null;
      PLANETAS_ORBITA.forEach((p) => {
        // órbita
        const pts = []; for (let i = 0; i <= 128; i++) { const a = i / 128 * 6.283; pts.push(new THREE.Vector3(Math.cos(a) * p.orbR, 0, Math.sin(a) * p.orbR)); }
        const line = new THREE.LineLoop(track(new THREE.BufferGeometry().setFromPoints(pts)), track(new THREE.LineBasicMaterial({ color: 0x2a3550, transparent: true, opacity: 0.6 })));
        scene.add(line);
        const pivot = new THREE.Group(); pivot.rotation.y = Math.random() * 6.283; scene.add(pivot);
        const mesh = hazEsfera(p, p.visR); mesh.position.x = p.orbR; pivot.add(mesh); clickables.push(mesh);
        if (p.anillos) mesh.add(anilloSaturno(p.visR));
        const w = (365.25 / p.orbitaDias) * 0.35;   // velocidad orbital (Tierra ~1)
        updaters.push((dt, sp) => { pivot.rotation.y += dt * w * sp; mesh.rotation.y += dt * 0.6 * sp; });
        if (p.id === 'Tierra') earthPivot = mesh;
      });
      // Luna alrededor de la Tierra
      if (earthPivot) {
        const luna = CUERPOS.find(c => c.id === 'Luna');
        const lunaPivot = new THREE.Group(); earthPivot.add(lunaPivot);
        const lm = hazEsfera(luna, luna.visR, 32); lm.position.x = luna.orbR; lunaPivot.add(lm); clickables.push(lm);
        updaters.push((dt, sp) => { lunaPivot.rotation.y += dt * 2.2 * sp; });
      }
      camera.position.set(0, 70, 130); controls.target.set(0, 0, 0);
      controls.minDistance = 12; controls.maxDistance = 400;
    }

    // ================================================== VISTA: COMPARAR TAMAÑOS
    else if (vista === 'comparar') {
      scene.add(new THREE.AmbientLight(0xffffff, 0.9));
      const dir = new THREE.DirectionalLight(0xffffff, 1.1); dir.position.set(30, 40, 60); scene.add(dir);
      const orden = ['Sol', 'Mercurio', 'Venus', 'Tierra', 'Luna', 'Marte', 'Jupiter', 'Saturno', 'Urano', 'Neptuno'];
      const ESC = 0.9 / CUERPOS[0].radioKm * 60;   // Sol → radio visual 54
      let cursor = 0; const centros = [];
      orden.forEach((id) => {
        const c = CUERPOS.find(x => x.id === id);
        const r = Math.max(0.25, c.radioKm * ESC);
        cursor += r;
        const mesh = hazEsfera(c, r, r > 8 ? 64 : 40); mesh.position.set(cursor, 0, 0); scene.add(mesh); clickables.push(mesh);
        if (c.anillos) mesh.add(anilloSaturno(r));
        centros.push(cursor);
        updaters.push((dt) => { mesh.rotation.y += dt * 0.15; });
        cursor += r + Math.max(1.5, r * 0.15);
      });
      const total = cursor;
      camera.position.set(total * 0.32, total * 0.14, total * 0.55);
      controls.target.set(total * 0.32, 0, 0);
      controls.minDistance = 3; controls.maxDistance = total * 2;
    }

    // ================================================== VISTA: ESCALA REAL
    else if (vista === 'escala') {
      // 1 unidad = 1.000.000 km  → Sol radio 0,70 u; Neptuno a 4.495 u
      const K = 1 / 1e6;
      const sol = CUERPOS[0];
      const sunLight = new THREE.PointLight(0xffffff, 4, 0, 0); scene.add(sunLight);
      const solMesh = hazEsfera(sol, sol.radioKm * K, 48); scene.add(solMesh); clickables.push(solMesh);
      const solGlow = new THREE.Sprite(track(new THREE.SpriteMaterial({ map: glowTex, blending: THREE.AdditiveBlending, depthWrite: false })));
      solGlow.scale.setScalar(sol.radioKm * K * 6); scene.add(solGlow);
      PLANETAS_ORBITA.forEach((p) => {
        const d = p.distSolKm * K;
        const mesh = hazEsfera(p, Math.max(p.radioKm * K, 0.002), 32); mesh.position.set(d, 0, 0); scene.add(mesh); clickables.push(mesh);
        if (p.anillos) mesh.add(anilloSaturno(p.radioKm * K));
        // marcador para poder localizarlo desde lejos
        const spr = new THREE.Sprite(track(new THREE.SpriteMaterial({ color: new THREE.Color(p.color), map: glowTex, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.9 })));
        spr.scale.setScalar(2.5); spr.position.copy(mesh.position); scene.add(spr);
        // órbita
        const pts = []; for (let i = 0; i <= 160; i++) { const a = i / 160 * 6.283; pts.push(new THREE.Vector3(Math.cos(a) * d, 0, Math.sin(a) * d)); }
        scene.add(new THREE.LineLoop(track(new THREE.BufferGeometry().setFromPoints(pts)), track(new THREE.LineBasicMaterial({ color: 0x1e2740, transparent: true, opacity: 0.5 }))));
        updaters.push((dt) => { mesh.rotation.y += dt * 0.3; });
      });
      camera.position.set(120, 90, 260); controls.target.set(120, 0, 0);
      controls.minDistance = 0.5; controls.maxDistance = 30000;
      // API viaje: coloca cámara junto a un planeta
      ctrlRef.current.irA = (id) => {
        const c = id === 'Sol' ? { distSolKm: 0, radioKm: sol.radioKm } : CUERPOS.find(x => x.id === id);
        const d = c.distSolKm * K;
        animForward = { from: camera.position.clone(), fromT: controls.target.clone(), to: new THREE.Vector3(d + 5, 4, 11), toT: new THREE.Vector3(d, 0, 0), t: 0 };
      };
    }

    // ================================================== VISTA: GALAXIA
    else if (vista === 'galaxia') {
      scene.background = new THREE.Color(0x02030a);
      // disco espiral de estrellas
      const arms = 4, count = 9000, gpos = new Float32Array(count * 3), gcol = new Float32Array(count * 3);
      const col = new THREE.Color();
      for (let i = 0; i < count; i++) {
        const arm = i % arms; const t = Math.pow(Math.random(), 0.6);
        const radius = 6 + t * 260;
        const ang = t * 6 + arm * (6.283 / arms) + (Math.random() - 0.5) * 0.5;
        const jitter = (Math.random() - 0.5) * (10 + radius * 0.12);
        gpos[i * 3] = Math.cos(ang) * radius + jitter;
        gpos[i * 3 + 1] = (Math.random() - 0.5) * (6 + radius * 0.02);
        gpos[i * 3 + 2] = Math.sin(ang) * radius + jitter * 0.6;
        const c = t < 0.25 ? col.setHSL(0.11, 0.8, 0.75) : col.setHSL(0.6, 0.7, 0.6 - t * 0.2);
        gcol[i * 3] = c.r; gcol[i * 3 + 1] = c.g; gcol[i * 3 + 2] = c.b;
      }
      const gg = track(new THREE.BufferGeometry());
      gg.setAttribute('position', new THREE.BufferAttribute(gpos, 3));
      gg.setAttribute('color', new THREE.BufferAttribute(gcol, 3));
      const galaxy = new THREE.Points(gg, track(new THREE.PointsMaterial({ size: 1.4, sizeAttenuation: true, vertexColors: true, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending })));
      scene.add(galaxy);
      // bulbo central
      const bulge = new THREE.Sprite(track(new THREE.SpriteMaterial({ map: glowTex, color: 0xfff0c0, blending: THREE.AdditiveBlending, depthWrite: false })));
      bulge.scale.setScalar(60); scene.add(bulge);
      // órbita del Sol (~26.000 años luz del centro)
      const Rg = 150; const pts = [];
      for (let i = 0; i <= 200; i++) { const a = i / 200 * 6.283; pts.push(new THREE.Vector3(Math.cos(a) * Rg, 0, Math.sin(a) * Rg)); }
      scene.add(new THREE.LineLoop(track(new THREE.BufferGeometry().setFromPoints(pts)), track(new THREE.LineBasicMaterial({ color: 0x6688ff, transparent: true, opacity: 0.5 }))));
      // marcador del Sol + mini sistema solar (planetas orbitando)
      const solGroup = new THREE.Group();
      const sysLight = new THREE.PointLight(0xffffff, 2.5, 40, 0); solGroup.add(sysLight);
      const solDot = new THREE.Mesh(track(new THREE.SphereGeometry(1.6, 24, 24)), track(new THREE.MeshBasicMaterial({ color: 0xffdd66 })));
      solGroup.add(solDot);
      const solGlow = new THREE.Sprite(track(new THREE.SpriteMaterial({ map: glowTex, blending: THREE.AdditiveBlending, depthWrite: false })));
      solGlow.scale.setScalar(9); solGroup.add(solGlow);
      solDot.userData.cuerpo = CUERPOS[0]; clickables.push(solDot);
      scene.add(solGroup);

      // estela helicoidal (rastro de las últimas posiciones en el mundo)
      const KTR = 150;
      const hazEstela = (color) => {
        const arr = []; const pos = new Float32Array(KTR * 3);
        const g = track(new THREE.BufferGeometry()); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setDrawRange(0, 0);
        const line = new THREE.Line(g, track(new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.55 })));
        scene.add(line);
        return { push: (v) => { arr.push(v.x, v.y, v.z); if (arr.length > KTR * 3) arr.splice(0, 3); pos.set(arr); g.attributes.position.needsUpdate = true; g.setDrawRange(0, arr.length / 3); } };
      };

      // planetas del mini sistema (orbitan en un plano; al avanzar el Sol trazan hélices)
      const miniOrb = [3, 4, 5.1, 6.4, 8.2, 10, 11.6, 13];
      const miniPlanetas = [];
      PLANETAS_ORBITA.forEach((p, i) => {
        const or = miniOrb[i];
        const pts = []; for (let k = 0; k <= 64; k++) { const a = k / 64 * 6.283; pts.push(new THREE.Vector3(Math.cos(a) * or, 0, Math.sin(a) * or)); }
        solGroup.add(new THREE.LineLoop(track(new THREE.BufferGeometry().setFromPoints(pts)), track(new THREE.LineBasicMaterial({ color: 0x35507a, transparent: true, opacity: 0.45 }))));
        const pivot = new THREE.Group(); pivot.rotation.y = Math.random() * 6.283; solGroup.add(pivot);
        const rad = Math.max(0.32, p.visR * 0.14);
        const pm = hazEsfera(p, rad, 20); pm.position.x = or; pivot.add(pm); clickables.push(pm);
        if (p.anillos) pm.add(anilloSaturno(rad));
        const w = (365.25 / p.orbitaDias) * 1.6;    // velocidad orbital (coils visibles)
        miniPlanetas.push({ pivot, pm, w, estela: hazEstela(new THREE.Color(p.color)) });
      });
      // estela del propio Sol (su trayectoria suave por la galaxia)
      const estelaSol = hazEstela(new THREE.Color(0xffdd66));

      const up = new THREE.Vector3(0, 1, 0), tang = new THREE.Vector3(), N = new THREE.Vector3(), tmpV = new THREE.Vector3();
      let ang = 0.6;
      const ANG = 0.045;   // avance del Sol por la galaxia (pitch de la hélice)
      updaters.push((dt, sp) => {
        ang += dt * ANG * sp;
        const cx = Math.cos(ang), sx = Math.sin(ang);
        solGroup.position.set(cx * Rg, 0, sx * Rg);
        // orienta el plano orbital: su normal (Y local) apunta ~hacia la dirección de avance → hélice
        tang.set(-sx, 0, cx);
        N.copy(tang).multiplyScalar(1).addScaledVector(up, 0.6).normalize();
        solGroup.quaternion.setFromUnitVectors(up, N);
        // gira los planetas y actualiza estelas en coordenadas del mundo
        miniPlanetas.forEach(mp => { mp.pivot.rotation.y += dt * mp.w * sp; mp.pm.rotation.y += dt * sp; });
        solGroup.updateMatrixWorld(true);
        miniPlanetas.forEach(mp => { mp.pm.getWorldPosition(tmpV); mp.estela.push(tmpV); });
        estelaSol.push(solGroup.position);
        galaxy.rotation.y += dt * 0.02 * sp;
      });
      camera.position.set(0, 220, 300); controls.target.set(0, 0, 0);
      controls.minDistance = 8; controls.maxDistance = 1500;
    }

    // ---------------------------------------------------- raycasting (click)
    const onClick = (ev) => {
      const rect = renderer.domElement.getBoundingClientRect();
      const cx = (ev.touches ? ev.touches[0].clientX : ev.clientX);
      const cy = (ev.touches ? ev.touches[0].clientY : ev.clientY);
      mouse.x = ((cx - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((cy - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(mouse, camera);
      const hits = raycaster.intersectObjects(clickables, false);
      if (hits.length) onSelect(hits[0].object.userData.cuerpo);
    };
    renderer.domElement.addEventListener('click', onClick);

    // hover cursor
    const onMove = (ev) => {
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(mouse, camera);
      renderer.domElement.style.cursor = raycaster.intersectObjects(clickables, false).length ? 'pointer' : 'grab';
    };
    renderer.domElement.addEventListener('pointermove', onMove);

    // ---------------------------------------------------- bucle
    const clock = new THREE.Clock();
    let raf;
    const animar = () => {
      const dt = Math.min(clock.getDelta(), 0.05);
      const c = ctrlRef.current;
      const sp = c.playing ? c.velocidad : 0;
      updaters.forEach(u => u(dt, sp));
      if (animForward) {
        animForward.t = Math.min(1, animForward.t + dt * 0.8);
        const e = 1 - Math.pow(1 - animForward.t, 3);
        camera.position.lerpVectors(animForward.from, animForward.to, e);
        controls.target.lerpVectors(animForward.fromT, animForward.toT, e);
        if (animForward.t >= 1) animForward = null;
      }
      controls.update();
      renderer.render(scene, camera);
      raf = requestAnimationFrame(animar);
    };
    raf = requestAnimationFrame(animar);

    const onResize = () => { if (!cont.clientWidth) return; camera.aspect = cont.clientWidth / cont.clientHeight; camera.updateProjectionMatrix(); renderer.setSize(cont.clientWidth, cont.clientHeight); };
    const ro = new ResizeObserver(onResize); ro.observe(cont);

    return () => {
      cancelAnimationFrame(raf); ro.disconnect();
      renderer.domElement.removeEventListener('click', onClick);
      renderer.domElement.removeEventListener('pointermove', onMove);
      controls.dispose();
      disposables.forEach(o => { try { o.dispose && o.dispose(); } catch (e) { /* noop */ } });
      scene.traverse(o => { if (o.geometry) o.geometry.dispose(); });
      renderer.dispose();
      if (renderer.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement);
      ctrlRef.current.irA = null;
    };
  }, [vista]);

  return <div ref={contRef} style={{ position: 'absolute', inset: 0 }} />;
};

// =====================================================================
//                            APP
// =====================================================================
const App = () => {
  const [vista, setVista] = useState('orbitas'); // orbitas | comparar | escala | galaxia | test
  const [movil, setMovil] = useState(typeof window !== 'undefined' && window.innerWidth < 820);
  const [sel, setSel] = useState(null);          // cuerpo seleccionado (panel info)
  const [ui, setUi] = useState({ playing: true, velocidad: 1 });
  const [temaCalc, setTemaCalc] = useState('Mix'); // filtro de fórmula en el test de cálculo
  const [fichas, setFichas] = useState(false);      // desplegable de fichas en móvil
  const ctrlRef = useRef({ playing: true, velocidad: 1, irA: null });

  useEffect(() => { const r = () => setMovil(window.innerWidth < 820); window.addEventListener('resize', r); return () => window.removeEventListener('resize', r); }, []);
  const setCtrl = (patch) => { setUi(u => { const n = { ...u, ...patch }; ctrlRef.current.playing = n.playing; ctrlRef.current.velocidad = n.velocidad; return n; }); };

  const sans = '"Segoe UI", system-ui, -apple-system, Arial, sans-serif';
  const mono = 'ui-monospace, Menlo, Consolas, monospace';

  const VISTAS = [
    { id: 'orbitas', t: 'Órbitas', tM: 'Órbitas', emoji: '🪐', sub: 'Movimiento (distancias no a escala)' },
    { id: 'escala', t: 'Escala real', tM: 'Escala', emoji: '📏', sub: 'Tamaños y distancias reales' },
    { id: 'comparar', t: 'Comparar', tM: 'Comparar', emoji: '⚖️', sub: 'Tamaños reales en fila' },
    { id: 'galaxia', t: 'Galaxia', tM: 'Galaxia', emoji: '🌌', sub: 'El Sol orbita la Vía Láctea' },
    { id: 'newton', t: 'Leyes de Newton', tM: 'Newton', emoji: '🍎', sub: 'Las leyes que rigen las órbitas' },
    { id: 'test', t: 'Test', tM: 'Test', emoji: '❓', sub: '30 preguntas de curiosidades' },
    { id: 'calculos', t: 'Cálculos', tM: 'Cálculos', emoji: '🧮', sub: 'Problemas de Newton (ESO)' }
  ];

  const estilos = `
    @keyframes ss-pop { from { transform: translateY(12px) scale(.98); opacity: 0 } to { transform: none; opacity: 1 } }
    .ss-btn:focus-visible, .ss-chip:focus-visible { outline: 3px solid #38bdf8; outline-offset: 2px; }
    .ss-scroll::-webkit-scrollbar { height: 8px; width: 8px; }
    .ss-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,.2); border-radius: 8px; }
  `;

  // ------------------------------------------------------- TEST (quiz)
  const [quiz, setQuiz] = useState('inicio'); // inicio | jugando | fin
  const [ronda, setRonda] = useState([]);
  const [idx, setIdx] = useState(0);
  const [elegida, setElegida] = useState(null);
  const [aciertos, setAciertos] = useState(0);
  const barajar = (a) => { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1));[b[i], b[j]] = [b[j], b[i]]; } return b; };
  const nuevaRonda = (banco = PREGUNTAS, ordenar = true, n = 30) => {
    const fuente = (ordenar ? barajar(banco) : banco.slice()).slice(0, n);
    setRonda(fuente.map(p => { const pares = barajar(p.opts.map((t, i) => ({ t, ok: i === p.ok }))); return { q: p.q, exp: p.exp, nivel: p.nivel, opts: pares.map(x => x.t), ok: pares.findIndex(x => x.ok) }; }));
    setIdx(0); setElegida(null); setAciertos(0); setQuiz('jugando');
  };
  const esCalculo = vista === 'calculos';
  const responder = (i) => { if (elegida !== null) return; setElegida(i); if (i === ronda[idx].ok) setAciertos(a => a + 1); };
  const siguiente = () => { if (idx + 1 >= ronda.length) setQuiz('fin'); else { setIdx(idx + 1); setElegida(null); } };

  // ------------------------------------------------------- estilos comunes
  const panel = { background: 'rgba(10,14,30,.72)', border: '1px solid rgba(255,255,255,.14)', borderRadius: 16, backdropFilter: 'blur(10px)', color: '#f1f5f9' };
  const chip = (activo, color) => ({ background: activo ? color : 'rgba(255,255,255,.08)', color: activo ? '#0b1020' : '#e2e8f0', border: '1px solid rgba(255,255,255,.16)', borderRadius: 10, padding: movil ? '8px 10px' : '9px 13px', fontSize: movil ? 12 : 13, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' });

  // ===================================================================
  //  Barra de vistas superior
  const NavVistas = () => (
    <div className="ss-scroll" style={{ display: 'flex', gap: movil ? 6 : 8, overflowX: 'auto', padding: movil ? '7px 8px' : '10px 14px', flexShrink: 0, justifyContent: movil ? 'flex-start' : 'center', WebkitOverflowScrolling: 'touch' }}>
      {VISTAS.map(v => (
        <button key={v.id} className="ss-btn" onClick={() => { setVista(v.id); setSel(null); setQuiz('inicio'); setFichas(false); }}
          title={v.sub}
          style={{ ...chip(vista === v.id, '#fbbf24'), display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, minWidth: movil ? 62 : 92, padding: movil ? '7px 8px' : '8px 12px', flexShrink: 0 }}>
          <span style={{ fontSize: movil ? 20 : 18 }}>{v.emoji}</span>
          <span style={{ fontSize: movil ? 11 : 13, lineHeight: 1.1 }}>{movil ? v.tM : v.t}</span>
        </button>
      ))}
    </div>
  );

  // ===================================================================
  //  PANTALLA: LEYES DE NEWTON
  if (vista === 'newton') {
    return (
      <div style={{ position: 'fixed', inset: 0, background: 'radial-gradient(120% 90% at 50% 0%, #101a3a 0%, #05070f 65%)', color: '#f1f5f9', fontFamily: sans, display: 'flex', flexDirection: 'column', overflow: 'auto' }}>
        <style>{estilos}</style>
        <NavVistas />
        <div style={{ flexGrow: 1, padding: movil ? 14 : '20px 28px', maxWidth: 900, width: '100%', margin: '0 auto', boxSizing: 'border-box' }}>
          <div style={{ textAlign: 'center', marginBottom: 20 }}>
            <div style={{ fontSize: 52 }}>🍎</div>
            <h1 style={{ fontSize: movil ? 26 : 36, margin: '4px 0 6px' }}>Las leyes de Newton</h1>
            <p style={{ opacity: .8, lineHeight: 1.6, maxWidth: 620, margin: '0 auto' }}>Las mismas leyes que hacen caer una manzana explican por qué los planetas orbitan el Sol. Estas son las reglas del movimiento y de la gravedad.</p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: movil ? '1fr' : '1fr 1fr', gap: 14 }}>
            {LEYES.map((l, i) => (
              <div key={i} style={{ ...panel, padding: movil ? 18 : 22, borderTop: `3px solid ${l.color}`, animation: 'ss-pop .4s', animationDelay: `${i * 60}ms`, animationFillMode: 'backwards' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                  <div style={{ width: 42, height: 42, borderRadius: 12, background: `${l.color}22`, border: `1.5px solid ${l.color}`, color: l.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 17, flexShrink: 0 }}>{l.n}</div>
                  <h2 style={{ fontSize: movil ? 18 : 20, margin: 0 }}>{l.titulo}</h2>
                </div>
                <p style={{ lineHeight: 1.55, opacity: .92, margin: '0 0 12px', fontSize: movil ? 14 : 15 }}>{l.enunciado}</p>
                <div style={{ fontFamily: mono, fontWeight: 700, fontSize: movil ? 15 : 17, textAlign: 'center', padding: '12px', borderRadius: 10, background: 'rgba(255,255,255,.06)', color: l.color, marginBottom: 12 }}>{l.formula}</div>
                <div style={{ fontSize: movil ? 13 : 14, lineHeight: 1.55, padding: '11px 13px', borderRadius: 10, background: `${l.color}14`, border: `1px solid ${l.color}44` }}>
                  🪐 <strong>En el espacio:</strong> {l.espacio}
                </div>
              </div>
            ))}
          </div>
          <div style={{ ...panel, padding: movil ? 18 : 22, marginTop: 14, borderTop: '3px solid #f472b6' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
              <div style={{ width: 42, height: 42, borderRadius: 12, background: '#f472b622', border: '1.5px solid #f472b6', color: '#f472b6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>🛰️</div>
              <h2 style={{ fontSize: movil ? 18 : 20, margin: 0 }}>Velocidad orbital</h2>
            </div>
            <p style={{ lineHeight: 1.55, opacity: .92, margin: '0 0 12px', fontSize: movil ? 14 : 15 }}>Combinando la 2ª ley con la gravitación se obtiene la velocidad que necesita un satélite (o un planeta) para mantenerse en una órbita circular de radio <em>r</em> alrededor de un cuerpo de masa <em>M</em>:</p>
            <div style={{ fontFamily: mono, fontWeight: 700, fontSize: movil ? 16 : 18, textAlign: 'center', padding: 12, borderRadius: 10, background: 'rgba(255,255,255,.06)', color: '#f472b6', marginBottom: 12 }}>v = √( G · M / r )</div>
            <div style={{ fontSize: movil ? 13 : 14, lineHeight: 1.55, padding: '11px 13px', borderRadius: 10, background: '#f472b614', border: '1px solid #f472b644' }}>
              🪐 <strong>Consecuencia:</strong> cuanto más lejos está la órbita (mayor <em>r</em>), menor es la velocidad. Por eso Mercurio corre a 47 km/s y Neptuno solo a 5 km/s, y los satélites bajos van más rápidos que los altos. No depende de la masa del satélite.
            </div>
          </div>
          <div style={{ ...panel, padding: movil ? 18 : 22, marginTop: 14, textAlign: 'center' }}>
            <p style={{ margin: '0 0 14px', opacity: .88, lineHeight: 1.6 }}>¿Lo has entendido? Pon a prueba tus cálculos con problemas de dificultad creciente. Puedes practicar una sola fórmula o mezclarlas.</p>
            <button className="ss-btn" onClick={() => { setVista('calculos'); setQuiz('inicio'); }} style={{ ...chip(true, '#a78bfa'), fontSize: 16, padding: '13px 26px' }}>🧮 Ir a los cálculos</button>
          </div>
        </div>
      </div>
    );
  }

  // ===================================================================
  //  TEST screen (trivia del sistema solar  ·  cálculos de Newton)
  if (vista === 'test' || vista === 'calculos') {
    const p = ronda[idx];
    const filtrados = temaCalc === 'Mix' ? PROBLEMAS : PROBLEMAS.filter(x => x.tema === temaCalc);
    const empezar = () => esCalculo ? nuevaRonda(filtrados, false, filtrados.length) : nuevaRonda(PREGUNTAS, true, 30);
    const acento = esCalculo ? '#a78bfa' : '#fbbf24';
    const nivelColor = (nv) => nv === 'Básico' ? '#34d399' : nv === 'Medio' ? '#fbbf24' : '#f87171';
    const pct = ronda.length ? aciertos / ronda.length : 0;
    const mensajeFin = esCalculo
      ? (pct >= 0.9 ? '¡Dominas las leyes de Newton! 🎯' : pct >= 0.7 ? 'Muy bien, controlas las fórmulas.' : pct >= 0.5 ? 'Vas bien: repasa los despejes (a = F/m, m = P/g).' : 'Repasa la pantalla de Leyes de Newton y vuelve a intentarlo.')
      : (pct >= 0.9 ? '¡Eres una eminencia del cosmos! 🚀' : pct >= 0.7 ? 'Gran dominio del sistema solar.' : pct >= 0.5 ? 'Bien, repasa las simulaciones y repite.' : 'Explora las vistas y vuelve a intentarlo.');
    return (
      <div style={{ position: 'fixed', inset: 0, background: 'radial-gradient(120% 90% at 50% 0%, #101a3a 0%, #05070f 65%)', color: '#f1f5f9', fontFamily: sans, display: 'flex', flexDirection: 'column', overflow: 'auto' }}>
        <style>{estilos}</style>
        <NavVistas />
        <div style={{ flexGrow: 1, display: 'flex', justifyContent: 'center', alignItems: 'flex-start', padding: movil ? 14 : 28 }}>
          {quiz === 'inicio' && (
            <div style={{ ...panel, padding: movil ? 24 : 40, maxWidth: 640, width: '100%', textAlign: 'center', animation: 'ss-pop .4s' }}>
              <div style={{ fontSize: 60 }}>{esCalculo ? '🧮' : '🌌'}</div>
              <h1 style={{ fontSize: movil ? 26 : 36, margin: '6px 0 10px' }}>{esCalculo ? 'Cálculos de las leyes de Newton' : 'Test del Sistema Solar'}</h1>
              <p style={{ opacity: .82, lineHeight: 1.6, marginBottom: 26 }}>{esCalculo
                ? `${PROBLEMAS.length} problemas para ESO ordenados de menos a más difícil: 2ª ley (F = m·a), peso, gravitación, energía y velocidad orbital. Elige una fórmula concreta o mézclalas. Tras cada respuesta verás la solución paso a paso.`
                : '30 preguntas sobre planetas, distancias y curiosidades. Muchas respuestas están en las simulaciones. Se barajan preguntas y opciones.'}</p>
              {esCalculo && <p style={{ fontSize: 13, opacity: .6, marginBottom: 16 }}>💡 Repasa antes la pestaña <strong>🍎 Leyes de Newton</strong>. Usa g = 9,8 m/s².</p>}
              {esCalculo && (
                <div style={{ marginBottom: 22 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', opacity: .6, marginBottom: 10 }}>Elige la fórmula a practicar</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
                    {['Mix', ...TEMAS_CALC].map(t => {
                      const n = t === 'Mix' ? PROBLEMAS.length : PROBLEMAS.filter(x => x.tema === t).length;
                      const activo = temaCalc === t;
                      return (
                        <button key={t} className="ss-btn" onClick={() => setTemaCalc(t)}
                          style={{ ...chip(activo, acento), fontSize: 13, padding: '8px 13px', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                          {t === 'Mix' ? '🎲 Mix (todas)' : t}
                          <span style={{ fontFamily: mono, fontSize: 11, opacity: activo ? .7 : .5, fontWeight: 800 }}>{n}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
              <button className="ss-btn" onClick={empezar} style={{ ...chip(true, acento), fontSize: 17, padding: '14px 30px' }}>{esCalculo ? (temaCalc === 'Mix' ? 'Empezar (todas)' : `Practicar: ${temaCalc}`) : 'Empezar el test'}</button>
            </div>
          )}
          {quiz === 'jugando' && p && (
            <div style={{ maxWidth: 720, width: '100%' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                <span style={{ fontFamily: mono, fontWeight: 700, opacity: .8 }}>{idx + 1} / {ronda.length}</span>
                <div style={{ flexGrow: 1, height: 6, borderRadius: 999, background: 'rgba(255,255,255,.15)' }}>
                  <div style={{ width: `${(idx + (elegida !== null ? 1 : 0)) / ronda.length * 100}%`, height: '100%', borderRadius: 999, background: acento, transition: 'width .3s' }} />
                </div>
                <span style={{ fontFamily: mono, fontWeight: 700 }}>{aciertos} ✓</span>
              </div>
              <div style={{ ...panel, padding: movil ? 20 : 30 }}>
                {p.nivel && (
                  <span style={{ display: 'inline-block', fontSize: 11, fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase', color: nivelColor(p.nivel), border: `1px solid ${nivelColor(p.nivel)}`, padding: '3px 10px', borderRadius: 999, marginBottom: 12 }}>{p.nivel}</span>
                )}
                <h2 style={{ fontSize: movil ? 19 : 23, lineHeight: 1.4, margin: '2px 0 22px' }}>{p.q}</h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {p.opts.map((o, i) => {
                    const rev = elegida !== null, correcta = i === p.ok, fallada = rev && i === elegida && !correcta;
                    return (
                      <button key={i} className="ss-btn" onClick={() => responder(i)} disabled={rev}
                        style={{ textAlign: 'left', padding: '14px 16px', borderRadius: 12, cursor: rev ? 'default' : 'pointer', fontSize: movil ? 15 : 16, fontWeight: 600, color: '#f8fafc', display: 'flex', gap: 12, alignItems: 'center',
                          background: rev && correcta ? 'rgba(52,211,153,.22)' : fallada ? 'rgba(248,113,113,.20)' : 'rgba(255,255,255,.06)',
                          border: `1px solid ${rev && correcta ? '#34d399' : fallada ? '#f87171' : 'rgba(255,255,255,.16)'}` }}>
                        <span style={{ fontFamily: mono, fontWeight: 800, opacity: .7, minWidth: 18 }}>{'ABCD'[i]}</span>
                        <span style={{ flexGrow: 1 }}>{o}</span>
                        {rev && correcta && <span>✓</span>}{fallada && <span>✕</span>}
                      </button>
                    );
                  })}
                </div>
                {elegida !== null && (
                  <div style={{ marginTop: 20 }}>
                    <div style={{ padding: '14px 16px', borderRadius: 12, lineHeight: 1.55, background: 'rgba(56,189,248,.10)', border: '1px solid rgba(56,189,248,.35)' }}>
                      <strong style={{ color: elegida === p.ok ? '#34d399' : '#f87171' }}>{elegida === p.ok ? '¡Correcto! ' : 'No es esa. '}</strong>{p.exp}
                    </div>
                    <button className="ss-btn" onClick={siguiente} style={{ ...chip(true, acento), marginTop: 16, width: movil ? '100%' : 'auto' }}>{idx + 1 >= ronda.length ? 'Ver resultado' : 'Siguiente'}</button>
                  </div>
                )}
              </div>
            </div>
          )}
          {quiz === 'fin' && (
            <div style={{ ...panel, padding: movil ? 26 : 40, maxWidth: 560, width: '100%', textAlign: 'center', animation: 'ss-pop .4s' }}>
              <div style={{ opacity: .6, letterSpacing: '.14em', fontWeight: 700, fontSize: 12 }}>RESULTADO</div>
              <div style={{ fontFamily: mono, fontSize: movil ? 60 : 84, fontWeight: 800, margin: '8px 0' }}>{aciertos}<span style={{ fontSize: '.42em', opacity: .6 }}>/{ronda.length}</span></div>
              <p style={{ fontSize: 18, opacity: .85, marginBottom: 24 }}>{mensajeFin}</p>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap', flexDirection: movil ? 'column' : 'row' }}>
                <button className="ss-btn" onClick={empezar} style={{ ...chip(true, acento), width: movil ? '100%' : 'auto', padding: '12px 18px' }}>{esCalculo ? 'Repetir cálculos' : 'Repetir test'}</button>
                {esCalculo && <button className="ss-btn" onClick={() => { setVista('newton'); setQuiz('inicio'); }} style={{ ...chip(false), width: movil ? '100%' : 'auto', padding: '12px 18px' }}>Repasar las leyes</button>}
                <button className="ss-btn" onClick={() => { setVista('orbitas'); setQuiz('inicio'); }} style={{ ...chip(false), width: movil ? '100%' : 'auto', padding: '12px 18px' }}>Volver a las vistas</button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ===================================================================
  //  Vistas 3D
  const vistaActual = VISTAS.find(v => v.id === vista);
  const mostrarControles = vista === 'orbitas' || vista === 'galaxia';
  return (
    <div style={{ position: 'fixed', inset: 0, background: '#03040a', color: '#f1f5f9', fontFamily: sans, display: 'flex', flexDirection: 'column' }}>
      <style>{estilos}</style>
      <NavVistas />
      <div style={{ position: 'relative', flexGrow: 1, minHeight: 0 }}>
        <Escena vista={vista} movil={movil} onSelect={setSel} ctrlRef={ctrlRef} />

        {/* título de la vista */}
        <div style={{ position: 'absolute', top: 10, left: 12, ...panel, padding: movil ? '7px 11px' : '9px 14px', maxWidth: movil ? 190 : 260, pointerEvents: 'none' }}>
          <div style={{ fontWeight: 800, fontSize: movil ? 14 : 16 }}>{vistaActual.emoji} {vistaActual.t}</div>
          <div style={{ fontSize: movil ? 11 : 12, opacity: .72 }}>{vistaActual.sub}</div>
          <div style={{ fontSize: movil ? 10 : 11, opacity: .5, marginTop: 3 }}>👆 Toca un astro para ver su ficha</div>
        </div>

        {/* selector rápido de cuerpos — columna en escritorio, desplegable en móvil */}
        {movil ? (
          <div style={{ position: 'absolute', top: 10, right: 10, zIndex: 8, textAlign: 'right' }}>
            <button className="ss-btn" onClick={() => setFichas(f => !f)} style={{ ...chip(fichas, '#6366f1'), fontSize: 12, padding: '8px 12px' }}>🪐 Fichas {fichas ? '▴' : '▾'}</button>
            {fichas && (
              <div className="ss-scroll" style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'flex-end', maxWidth: '74vw', maxHeight: '52vh', overflowY: 'auto', background: 'rgba(10,14,30,.92)', border: '1px solid rgba(255,255,255,.14)', borderRadius: 12, padding: 8, backdropFilter: 'blur(10px)' }}>
                {CUERPOS.map(c => (
                  <button key={c.id} onClick={() => { setSel(c); setFichas(false); }}
                    style={{ ...chip(false), padding: '7px 11px', fontSize: 12, borderLeft: `3px solid ${c.color}` }}>{c.nombre}</button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="ss-scroll" style={{ position: 'absolute', top: 10, right: 12, display: 'flex', flexDirection: 'column', gap: 5, maxHeight: '46%', overflowY: 'auto', alignItems: 'flex-end' }}>
            {CUERPOS.map(c => (
              <button key={c.id} className="ss-chip" onClick={() => setSel(c)}
                style={{ ...chip(false), padding: '5px 9px', fontSize: 11, borderLeft: `3px solid ${c.color}` }}>{c.nombre}</button>
            ))}
          </div>
        )}

        {/* escala real: botones "viajar a" */}
        {vista === 'escala' && (
          <div className="ss-scroll" style={{ position: 'absolute', bottom: 14, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 6, ...panel, padding: 8, maxWidth: '94%', overflowX: 'auto' }}>
            <span style={{ alignSelf: 'center', fontSize: 11, opacity: .6, padding: '0 4px', whiteSpace: 'nowrap' }}>Viajar a:</span>
            {['Sol', ...PLANETAS_ORBITA.map(p => p.id)].map(id => (
              <button key={id} className="ss-btn" onClick={() => ctrlRef.current.irA && ctrlRef.current.irA(id)} style={chip(false)}>{CUERPOS.find(c => c.id === id).nombre}</button>
            ))}
          </div>
        )}

        {/* controles play/velocidad */}
        {mostrarControles && (
          <div style={{ position: 'absolute', bottom: 12, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: movil ? 6 : 8, alignItems: 'center', ...panel, padding: movil ? '7px 9px' : '10px 14px', flexWrap: 'nowrap', justifyContent: 'center', maxWidth: '96%' }}>
            <button className="ss-btn" onClick={() => setCtrl({ playing: !ui.playing })} style={{ ...chip(ui.playing, '#10b981'), padding: movil ? '8px 10px' : undefined, whiteSpace: 'nowrap' }}>{ui.playing ? '⏸' : '▶'}{movil ? '' : (ui.playing ? ' Pausar' : ' Reproducir')}</button>
            {!movil && <span style={{ fontSize: 12, opacity: .7, fontWeight: 700 }}>Velocidad</span>}
            {[0.25, 1, 3, 8].map(v => (<button key={v} className="ss-btn" onClick={() => setCtrl({ velocidad: v })} style={{ ...chip(ui.velocidad === v, '#fbbf24'), minWidth: movil ? 34 : 42, padding: movil ? '8px 6px' : undefined, fontSize: movil ? 12 : 13 }}>×{v}</button>))}
          </div>
        )}

        {vista === 'galaxia' && (
          <div style={{ position: 'absolute', bottom: movil ? 66 : 78, left: '50%', transform: 'translateX(-50%)', ...panel, padding: movil ? '7px 11px' : '8px 12px', fontSize: movil ? 10.5 : 12, lineHeight: 1.4, textAlign: 'center', maxWidth: '94%', pointerEvents: 'none' }}>
            {movil
              ? 'El Sol avanza mientras los planetas lo orbitan: trazan una hélice. 🔍 Acércate para verlo.'
              : 'El Sol viaja a ~828.000 km/h alrededor de la galaxia. Como avanza mientras los planetas lo orbitan, estos trazan una hélice (helicoide). 🔍 Acércate para verlo.'}
          </div>
        )}
      </div>

      {/* PANEL INFORMATIVO */}
      {sel && (
        <div onClick={() => setSel(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)', zIndex: 50, display: 'flex', alignItems: movil ? 'flex-end' : 'center', justifyContent: 'center', padding: movil ? 0 : 20 }}>
          <div onClick={e => e.stopPropagation()} className="ss-scroll" style={{ ...panel, width: movil ? '100%' : 460, maxWidth: '100%', maxHeight: movil ? '82vh' : '88vh', overflowY: 'auto', borderRadius: movil ? '18px 18px 0 0' : 18, animation: 'ss-pop .3s' }}>
            <div style={{ padding: '18px 20px', borderBottom: '1px solid rgba(255,255,255,.12)', display: 'flex', alignItems: 'center', gap: 14, position: 'sticky', top: 0, background: 'rgba(10,14,30,.9)', backdropFilter: 'blur(10px)' }}>
              <div style={{ width: 46, height: 46, borderRadius: '50%', background: `radial-gradient(circle at 35% 30%, ${sel.color}, #000)`, flexShrink: 0, boxShadow: `0 0 18px ${sel.color}88` }} />
              <div style={{ flexGrow: 1 }}>
                <div style={{ fontSize: 22, fontWeight: 800 }}>{sel.nombre}</div>
                <div style={{ fontSize: 12, opacity: .6, textTransform: 'capitalize' }}>{sel.tipo}</div>
              </div>
              <button className="ss-btn" onClick={() => setSel(null)} style={{ ...chip(false), padding: '6px 10px' }}>✕</button>
            </div>
            <div style={{ padding: '4px 20px 20px' }}>
              {[
                ['Radio', `${nf(sel.radioKm)} km`],
                ['Masa', `${fmtMasa(sel.masaKg)}  ·  ×${sel.masaRel >= 1 ? nf(sel.masaRel) : sel.masaRel} Tierra`],
                ['Gravedad', `${sel.gravedad} m/s²  ·  ×${sel.gravRel} Tierra`],
                ['Distancia al Sol', sel.distSolKm === 0 ? '— (es el centro)' : `${nf(sel.distSolKm)} km`],
                ['↳ en tiempo-luz', fmtLuz(sel.distSolKm)],
                ['Duración del día', fmtDia(sel.rotacionH) + (sel.retro ? ' (retrógrado ↺)' : '')],
                ['Duración del año', fmtAnio(sel.orbitaDias)],
                ['Viaje desde la Tierra*', fmtViaje(sel.distTierraKm)],
                ['Temperatura', sel.temp],
                ['Lunas', String(sel.lunas)]
              ].map((f, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 14, padding: '9px 0', borderTop: i ? '1px solid rgba(255,255,255,.08)' : 'none', fontSize: movil ? 13 : 14 }}>
                  <span style={{ opacity: .6, flexShrink: 0 }}>{f[0]}</span>
                  <span style={{ fontFamily: mono, fontWeight: 700, textAlign: 'right' }}>{f[1]}</span>
                </div>
              ))}
              <div style={{ marginTop: 16, padding: '14px 16px', borderRadius: 12, background: 'rgba(56,189,248,.10)', border: '1px solid rgba(56,189,248,.30)', lineHeight: 1.55, fontSize: movil ? 13.5 : 14.5 }}>
                💡 {sel.curiosidad}
              </div>
              <div style={{ marginTop: 12, fontSize: 11, opacity: .45, lineHeight: 1.5 }}>
                *Tiempo aproximado a {nf(V_NAVE)} km/h (velocidad de una nave rápida tipo New Horizons), usando la distancia mínima a la Tierra.
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
