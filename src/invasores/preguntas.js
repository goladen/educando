// Banco de preguntas común a las dos variantes.
//
// Formato interno de una pregunta:
//   { id, enunciado, Enunciado?, ap?, tema?, emoji?, instruccion?, etiqueta?,
//     respuesta: 'numero' | 'opciones' | 'texto',
//     correcta: string,              // texto canónico de la respuesta correcta
//     opciones?: string[],           // incluye la correcta, ya barajadas (variante 2 y teclado A-D)
//     orig? }                        // pregunta normalizada del recurso (para esRespuestaCorrecta)
//
// Fuentes: cálculo rápido (generado), Math World (mandos/preguntasMates.js), bancos propios
// de otras materias y recursos del profesor (utils/normalizarPreguntas.js).
import { preguntasDeRecurso, esRespuestaCorrecta, limpiar, barajar } from '../utils/normalizarPreguntas';

let contador = 0;
const nuevoId = () => `p${++contador}`;
const rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1));

// ── Números ────────────────────────────────────────────────────────────────
const normNum = (s) => String(s ?? '').trim().replace(/\s/g, '').replace(/−/g, '-').replace(',', '.');
export const esNumerica = (s) => /^-?\d+([.,]\d+)?$/.test(normNum(s));
export const fmtNum = (n) => (n < 0 ? `−${String(-n).replace('.', ',')}` : String(n).replace('.', ','));

/** Tres distractores numéricos verosímiles (cerca, ±10, cifras cambiadas). */
export function distractoresNumericos(valor, cuantos = 3) {
  const v = Number(normNum(valor));
  const entero = Number.isInteger(v);
  const paso = entero ? 1 : 0.1;
  const cand = new Set();
  const add = (x) => {
    const r = entero ? Math.round(x) : Math.round(x * 100) / 100;
    if (r !== v && (v < 0 || r >= 0)) cand.add(r);
  };
  [1, -1, 2, -2, 10, -10, 5, -5].forEach((d) => add(v + d * paso));
  if (entero && Math.abs(v) >= 10) {
    const s = String(Math.abs(v));
    const rev = Number(s.split('').reverse().join('')) * Math.sign(v);
    add(rev);
  }
  if (entero && v !== 0) add(v * 2);
  const lista = barajar([...cand]).slice(0, cuantos);
  while (lista.length < cuantos) lista.push(v + (lista.length + 3) * paso);
  return lista.map(fmtNum);
}

// ── Corrección ─────────────────────────────────────────────────────────────
export function comprobar(pregunta, dada) {
  if (!pregunta) return false;
  const d = String(dada ?? '').trim();
  if (!d) return false;
  if (esNumerica(pregunta.correcta) && esNumerica(d)) {
    return Math.abs(Number(normNum(d)) - Number(normNum(pregunta.correcta))) < 1e-9;
  }
  if (pregunta.orig) return esRespuestaCorrecta(pregunta.orig, d);
  return limpiar(d) === limpiar(pregunta.correcta);
}

// ── Cálculo rápido ────────────────────────────────────────────────────────
export const OPERACIONES_RAPIDAS = [
  { id: 'suma', nombre: 'Sumas', emoji: '➕' },
  { id: 'resta', nombre: 'Restas', emoji: '➖' },
  { id: 'mult', nombre: 'Tablas', emoji: '✖️' },
  { id: 'div', nombre: 'Divisiones', emoji: '➗' },
  { id: 'enteros', nombre: 'Enteros (±)', emoji: '🌡️' },
];

const par = (n) => (n < 0 ? `(${fmtNum(n)})` : fmtNum(n));

function operacionRapida(op, nivel) {
  let a, b, r, s;
  switch (op) {
    case 'suma': {
      const [lo, hi] = [[1, 10], [10, 99], [100, 999]][nivel - 1];
      a = rnd(lo, hi); b = rnd(lo, hi); r = a + b; s = '+';
      break;
    }
    case 'resta': {
      const hi = [20, 100, 1000][nivel - 1];
      a = rnd(2, hi); b = rnd(1, a); r = a - b; s = '−';
      break;
    }
    case 'mult': {
      const [ta, tb] = [[[1, 5], [1, 10]], [[2, 10], [2, 10]], [[11, 20], [2, 12]]][nivel - 1];
      a = rnd(...ta); b = rnd(...tb);
      if (Math.random() < 0.5) [a, b] = [b, a];
      r = a * b; s = '×';
      break;
    }
    case 'div': {
      const [tb, tq] = [[[2, 5], [1, 10]], [[2, 10], [2, 12]], [[3, 20], [2, 25]]][nivel - 1];
      b = rnd(...tb); r = rnd(...tq); a = b * r; s = '÷';
      break;
    }
    default: { // enteros
      const hi = [10, 20, 50][nivel - 1];
      a = rnd(-hi, hi); b = rnd(-hi, hi);
      if (Math.random() < 0.5) { r = a + b; s = '+'; } else { r = a - b; s = '−'; }
      return { enunciado: `${fmtNum(a)} ${s} ${par(b)} = ?`, r };
    }
  }
  return { enunciado: `${a} ${s} ${b} = ?`, r };
}

export function generarRapidas({ operaciones, nivel }, n) {
  const ops = operaciones?.length ? operaciones : ['suma'];
  return Array.from({ length: n }, () => {
    const { enunciado, r } = operacionRapida(ops[rnd(0, ops.length - 1)], nivel);
    const correcta = fmtNum(r);
    return {
      id: nuevoId(), enunciado, respuesta: 'numero', correcta,
      opciones: barajar([correcta, ...distractoresNumericos(r)]), tema: 'Cálculo', emoji: '🧠',
    };
  });
}

// ── Math World (preguntasMates) ───────────────────────────────────────────
export function desdeMates(lista) {
  return (lista || []).map((p) => {
    const base = {
      id: nuevoId(), Enunciado: p.Enunciado, ap: p.ap,
      // Texto plano para el informe (el enunciado visual lo pinta el componente Enunciado)
      enunciado: p.texto || [p.tema, p.instruccion, p.etiqueta].filter(Boolean).join(' · '),
      tema: p.tema, emoji: p.emoji, instruccion: p.instruccion, etiqueta: p.etiqueta,
    };
    if (p.valor !== undefined) {
      const correcta = fmtNum(p.valor) + '';
      return { ...base, respuesta: 'numero', correcta, unidad: p.unidad || '', opciones: barajar([correcta, ...distractoresNumericos(p.valor)]) };
    }
    const correcta = p.opciones[p.correcta];
    return { ...base, respuesta: 'opciones', correcta, opciones: p.opciones };
  });
}

// ── Recursos del profesor ────────────────────────────────────────────────
/** Hojas del recurso con nombre (las vacías se mantienen para no descolocar los índices). */
export function hojasDeRecurso(recurso) {
  if (!Array.isArray(recurso?.hojas) || !recurso.hojas.length) return [];
  return recurso.hojas.map((h, i) => ({
    indice: i,
    nombre: String(h?.nombreHoja || '').trim() || `Hoja ${i + 1}`,
  }));
}

/** `hojas` = índices elegidos (null / vacío = todas). */
export function desdeRecurso(recurso, hojas = null) {
  const elegido = Array.isArray(hojas) && hojas.length && Array.isArray(recurso?.hojas)
    ? { ...recurso, hojas: recurso.hojas.filter((_, i) => hojas.includes(i)) }
    : recurso;
  return preguntasDeRecurso(elegido).map((q) => {
    if (q.tipo === 'ORDENAR') return null;
    const enunciado = q.tipo === 'RELLENAR'
      ? `${q.enunciado}: ${q.bloques[0]} ____ ${q.bloques[2]}`.trim()
      : q.enunciado;
    const base = { id: nuevoId(), enunciado, correcta: q.correcta, orig: q, tema: recurso?.titulo || '' };
    if (q.tipo === 'MULTIPLE') {
      return { ...base, respuesta: esNumerica(q.correcta) ? 'numero' : 'opciones', opciones: q.opciones };
    }
    // Respuesta corta / rellenar: si es un número se le pueden inventar distractores
    if (esNumerica(q.correcta)) {
      return { ...base, respuesta: 'numero', opciones: barajar([q.correcta, ...distractoresNumericos(q.correcta)]) };
    }
    return { ...base, respuesta: 'texto' };
  }).filter(Boolean);
}

// ── Bancos propios (sin recurso) ─────────────────────────────────────────
export const BANCOS = {
  INGLES: {
    nombre: 'Inglés', emoji: '🇬🇧',
    preguntas: [
      ['¿Cómo se dice «perro» en inglés?', 'dog', ['cat', 'frog', 'duck']],
      ['¿Cómo se dice «manzana» en inglés?', 'apple', ['orange', 'pear', 'grape']],
      ['¿Cómo se dice «rojo» en inglés?', 'red', ['blue', 'green', 'yellow']],
      ['¿Cómo se dice «casa» en inglés?', 'house', ['horse', 'mouse', 'hose']],
      ['¿Cómo se dice «libro» en inglés?', 'book', ['look', 'pen', 'desk']],
      ['¿Cómo se dice «cocina» (habitación)?', 'kitchen', ['chicken', 'bedroom', 'garden']],
      ['«Miércoles» en inglés', 'Wednesday', ['Tuesday', 'Thursday', 'Monday']],
      ['Past simple of «go»', 'went', ['goed', 'gone', 'going']],
      ['Past simple of «eat»', 'ate', ['eated', 'eaten', 'eats']],
      ['Past participle of «write»', 'written', ['wrote', 'writed', 'writing']],
      ['Plural of «child»', 'children', ['childs', 'childes', 'childen']],
      ['Plural of «mouse»', 'mice', ['mouses', 'mices', 'meese']],
      ['Opposite of «hot»', 'cold', ['warm', 'big', 'wet']],
      ['Opposite of «tall»', 'short', ['small', 'long', 'thin']],
      ['She ___ a student.', 'is', ['are', 'am', 'be']],
      ['They ___ football every day.', 'play', ['plays', 'playing', 'played']],
    ],
  },
  GEOGRAFIA: {
    nombre: 'Geografía', emoji: '🌍',
    preguntas: [
      ['Capital de Francia', 'París', ['Lyon', 'Marsella', 'Bruselas']],
      ['Capital de Italia', 'Roma', ['Milán', 'Venecia', 'Turín']],
      ['Capital de Portugal', 'Lisboa', ['Oporto', 'Faro', 'Coímbra']],
      ['Capital de Alemania', 'Berlín', ['Múnich', 'Hamburgo', 'Viena']],
      ['Capital de Japón', 'Tokio', ['Osaka', 'Kioto', 'Seúl']],
      ['Capital de Aragón', 'Zaragoza', ['Huesca', 'Teruel', 'Calatayud']],
      ['Río más largo de la península ibérica', 'Tajo', ['Ebro', 'Duero', 'Guadalquivir']],
      ['Río que pasa por Zaragoza', 'Ebro', ['Tajo', 'Duero', 'Júcar']],
      ['Pico más alto de España', 'Teide', ['Mulhacén', 'Aneto', 'Veleta']],
      ['Cordillera entre España y Francia', 'Pirineos', ['Alpes', 'Andes', 'Urales']],
      ['Océano más grande', 'Pacífico', ['Atlántico', 'Índico', 'Ártico']],
      ['Continente más poblado', 'Asia', ['África', 'Europa', 'América']],
      ['País más extenso del mundo', 'Rusia', ['Canadá', 'China', 'Brasil']],
      ['Desierto cálido más grande', 'Sáhara', ['Gobi', 'Atacama', 'Kalahari']],
      ['Comunidades autónomas de España', '17', ['15', '19', '12']],
    ],
  },
  BIOLOGIA: {
    nombre: 'Biología', emoji: '🧬',
    preguntas: [
      ['Órgano que bombea la sangre', 'Corazón', ['Pulmón', 'Hígado', 'Riñón']],
      ['Proceso con el que las plantas fabrican su alimento', 'Fotosíntesis', ['Respiración', 'Digestión', 'Fermentación']],
      ['Unidad básica de los seres vivos', 'Célula', ['Átomo', 'Tejido', 'Órgano']],
      ['Huesos del cuerpo humano adulto', '206', ['106', '306', '186']],
      ['La ballena es un…', 'Mamífero', ['Pez', 'Anfibio', 'Reptil']],
      ['Las ranas son…', 'Anfibios', ['Reptiles', 'Peces', 'Mamíferos']],
      ['Molécula que guarda la información genética', 'ADN', ['ATP', 'Glucosa', 'Almidón']],
      ['Orgánulo donde se hace la fotosíntesis', 'Cloroplasto', ['Mitocondria', 'Núcleo', 'Ribosoma']],
      ['Orgánulo de la respiración celular', 'Mitocondria', ['Cloroplasto', 'Vacuola', 'Ribosoma']],
      ['Gas que absorben las plantas para la fotosíntesis', 'Dióxido de carbono', ['Oxígeno', 'Nitrógeno', 'Helio']],
      ['Hueso más largo del cuerpo', 'Fémur', ['Tibia', 'Húmero', 'Radio']],
      ['Invertebrado con 8 patas', 'Araña', ['Hormiga', 'Mosca', 'Escarabajo']],
      ['Órgano más grande del cuerpo', 'Piel', ['Hígado', 'Cerebro', 'Intestino']],
      ['Células que transportan el oxígeno', 'Glóbulos rojos', ['Glóbulos blancos', 'Plaquetas', 'Neuronas']],
      ['Vertebrado con plumas que pone huevos', 'Ave', ['Mamífero', 'Reptil', 'Anfibio']],
    ],
  },
  CIENCIAS: {
    nombre: 'Física y Química', emoji: '⚗️',
    preguntas: [
      ['Símbolo químico del sodio', 'Na', ['So', 'Sd', 'Sn']],
      ['Símbolo químico del hierro', 'Fe', ['Hi', 'Fr', 'He']],
      ['Fórmula del agua', 'H₂O', ['CO₂', 'O₂', 'H₂O₂']],
      ['Temperatura de ebullición del agua al nivel del mar (ºC)', '100', ['90', '80', '120']],
      ['Unidad de fuerza en el SI', 'Newton', ['Julio', 'Vatio', 'Pascal']],
      ['Unidad de energía en el SI', 'Julio', ['Newton', 'Vatio', 'Voltio']],
      ['Estado del agua a −10 ºC', 'Sólido', ['Líquido', 'Gaseoso', 'Plasma']],
      ['Paso de líquido a gas', 'Evaporación', ['Fusión', 'Solidificación', 'Condensación']],
      ['Partícula con carga negativa', 'Electrón', ['Protón', 'Neutrón', 'Fotón']],
      ['Gas más abundante en el aire', 'Nitrógeno', ['Oxígeno', 'Dióxido de carbono', 'Argón']],
      ['Metal líquido a temperatura ambiente', 'Mercurio', ['Hierro', 'Plomo', 'Aluminio']],
      ['Planeta más cercano al Sol', 'Mercurio', ['Venus', 'Marte', 'Tierra']],
      ['Planeta más grande del sistema solar', 'Júpiter', ['Saturno', 'Neptuno', 'Urano']],
      ['Satélite natural de la Tierra', 'Luna', ['Fobos', 'Titán', 'Europa']],
      ['Velocidad de la luz (km/s, aprox.)', '300 000', ['3000', '30 000', '3 000 000']],
    ],
  },
};

export function desdeBanco(clave) {
  const b = BANCOS[clave];
  if (!b) return [];
  return b.preguntas.map(([enunciado, ok, mal]) => ({
    id: nuevoId(), enunciado, correcta: ok, tema: b.nombre, emoji: b.emoji,
    respuesta: /^\d+$/.test(ok) ? 'numero' : 'opciones',
    opciones: barajar([ok, ...mal]),
  }));
}

// ── Compatibilidad con cada variante ────────────────────────────────────
/** Variante 2 necesita al menos 2 opciones; la 1 acepta todo. */
export function jugables(preguntas, varianteId) {
  if (varianteId === 'FILTRO') return preguntas.filter((p) => (p.opciones?.length || 0) >= 2);
  return preguntas;
}

/** Entero que se puede marcar en un mando micro:bit (−999 … 9999), o null. */
export const numeroDeMando = (txt) => {
  const s = normNum(txt);
  if (!/^-?\d{1,4}$/.test(s)) return null;
  const n = Number(s);
  return n >= -999 && n <= 9999 ? n : null;
};

/**
 * Filtro extra con mandos en la variante 1: con letras hacen falta opciones (A-D); con número,
 * un resultado entero que se pueda marcar en el mando.
 */
export function jugablesConMandos(preguntas, varianteId, respuesta) {
  if (varianteId !== 'DISPARA') return preguntas;
  if (respuesta === 'numero') return preguntas.filter((p) => numeroDeMando(p.correcta) !== null);
  return preguntas.filter((p) => (p.opciones?.length || 0) >= 2);
}

/**
 * Cómo se responde en la variante 1: teclado numérico, botones A-D o teclado de letras.
 * `mandos` = 'letras' | 'numero' | null: con mandos en letras, siempre botones A-D (los mismos que el mando).
 */
export function modoTeclado(pregunta, escribir, mandos = null) {
  if (!pregunta) return 'numerico';
  if (mandos === 'letras' && pregunta.opciones?.length) return 'opciones';
  if (pregunta.respuesta === 'numero') return 'numerico';
  if (pregunta.respuesta === 'texto') return 'letras';
  return escribir ? 'letras' : 'opciones';
}

/** Mazo común: una secuencia que crece sola (todos los jugadores ven las mismas preguntas). */
export function crearMazo(base, generar) {
  const cartas = [...base];
  return {
    get(i) {
      while (i >= cartas.length) {
        const extra = generar ? generar() : barajar(base).map((p) => ({ ...p, id: nuevoId() }));
        if (!extra.length) break;
        cartas.push(...extra);
      }
      return cartas.length ? cartas[i % cartas.length] : null;
    },
    get tamano() { return base.length; },
  };
}
