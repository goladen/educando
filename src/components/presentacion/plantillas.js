// Diseños de diapositiva, estilos de texto prediseñados, líneas, emojis y degradados
// para el editor de presentaciones (todo en el lienzo libre de 960×540).
import { nid, PX_X, PX_Y } from './render';
import { esClaro, sobreColor } from './temas';

export const DEGRADADOS = [
  { from: '#6c63ff', to: '#ec4899', angle: 135 },
  { from: '#0ea5e9', to: '#22c55e', angle: 135 },
  { from: '#f97316', to: '#facc15', angle: 135 },
  { from: '#ff7e5f', to: '#feb47b', angle: 135 },
  { from: '#1e3a8a', to: '#0ea5e9', angle: 160 },
  { from: '#0f172a', to: '#334155', angle: 160 },
  { from: '#a855f7', to: '#3b82f6', angle: 90 },
  { from: '#10b981', to: '#064e3b', angle: 160 },
  { from: '#fde68a', to: '#fca5a5', angle: 135 },
  { from: '#e0e7ff', to: '#fdf2f8', angle: 135 },
  { from: '#111827', to: '#7c3aed', angle: 200 },
  { from: '#f43f5e', to: '#8b5cf6', angle: 45 },
];

export const EMOJIS = {
  Clase: ['📚', '✏️', '📝', '📖', '🎒', '🏫', '👩‍🏫', '👨‍🏫', '🧑‍🎓', '📐', '📏', '🖍️', '🗂️', '📌', '📎', '🔖', '💡', '🧠', '🎓', '⏰'],
  Ciencia: ['🔬', '🧪', '🧫', '🧬', '⚗️', '🔭', '🪐', '🌍', '🌙', '☀️', '⚡', '🔥', '💧', '🧲', '🦠', '🌡️', '🌋', '🌱', '🚀', '🛰️'],
  Mates: ['➕', '➖', '✖️', '➗', '🟰', '💯', '🔢', '📊', '📈', '📉', '🧮', 'π', '∞', '√', '%', '🎲', '🧩', '⏱️', '💰', '📐'],
  Naturaleza: ['🌳', '🌲', '🌵', '🌸', '🌻', '🍀', '🍁', '🐶', '🐱', '🦁', '🐘', '🐬', '🦋', '🐝', '🐢', '🦉', '🌈', '⛰️', '🌊', '❄️'],
  Personas: ['😀', '😃', '😍', '🤔', '😮', '😎', '🥳', '😴', '🤯', '👍', '👏', '🙌', '✋', '👀', '💪', '🤝', '🗣️', '👥', '❤️', '⭐'],
  Símbolos: ['✅', '❌', '⚠️', '❓', '❗', '💬', '🏆', '🥇', '🎯', '🔔', '🔑', '🔒', '🎉', '🎵', '🌟', '✨', '💎', '🏁', '🚩', '📍'],
  Flechas: ['⬆️', '⬇️', '⬅️', '➡️', '↗️', '↘️', '↙️', '↖️', '↔️', '↕️', '🔄', '🔁', '↩️', '↪️', '⤴️', '⤵️', '🔜', '🔙', '▶️', '⏩'],
};

// ─── TEXTOS PREDISEÑADOS ──────────────────────────────────────────────────────
// make(t) devuelve las propiedades (sin id); el panel los centra en la diapositiva
export const TEXTOS_PRESET = [
  { label: 'Añadir un título', make: () => ({ text: 'Añadir un título', fontSize: 52, fontWeight: '900', textAlign: 'center', fontFamily: "'Poppins',sans-serif", w: 80, h: 20, lineHeight: 1.15 }) },
  { label: 'Añadir un subtítulo', make: () => ({ text: 'Añadir un subtítulo', fontSize: 30, fontWeight: '700', textAlign: 'center', fontFamily: "'Poppins',sans-serif", w: 70, h: 13, lineHeight: 1.2 }) },
  { label: 'Texto de párrafo', make: () => ({ text: 'Escribe aquí un párrafo con la explicación.', fontSize: 20, w: 60, h: 18 }) },
  { label: 'Título degradado', make: () => ({ text: 'Título degradado', fontSize: 60, fontWeight: '900', textAlign: 'center', fontFamily: "'Montserrat',sans-serif", gradient: { from: '#6c63ff', to: '#ec4899', angle: 90 }, w: 84, h: 20, lineHeight: 1.1 }) },
  { label: 'Neón', make: () => ({ text: 'NEÓN', fontSize: 64, textAlign: 'center', fontFamily: "'Righteous',sans-serif", color: '#e0f2fe', shadow: 'brillo', shadowColor: '#22d3ee', w: 50, h: 22, lineHeight: 1.1 }) },
  { label: 'Contorno', make: () => ({ text: 'CONTORNO', fontSize: 80, textAlign: 'center', fontFamily: "'Bebas Neue',sans-serif", color: '#fde047', textStrokeW: 3, textStrokeColor: '#111827', letterSpacing: 0.05, w: 60, h: 24, lineHeight: 1 }) },
  { label: 'Sombra sólida', make: () => ({ text: '¡Atención!', fontSize: 56, fontWeight: '900', textAlign: 'center', fontFamily: "'Fredoka',sans-serif", color: '#ffffff', shadow: 'solida', shadowColor: '#ef4444', w: 60, h: 20, lineHeight: 1.1 }) },
  { label: 'Etiqueta', make: t => ({ text: 'ETIQUETA', fontSize: 16, fontWeight: '800', textAlign: 'center', letterSpacing: 0.15, bgColor: t.accent, color: sobreColor(t.accent), bgRadius: 20, w: 22, h: 8, vAlign: 'middle', lineHeight: 1.2 }) },
  { label: 'Manuscrito', make: () => ({ text: 'Nota a mano', fontSize: 44, textAlign: 'center', fontFamily: "'Caveat',cursive", w: 50, h: 16, lineHeight: 1.2 }) },
  { label: 'Pizarra con tiza', make: () => ({ text: 'Hoy aprendemos…', fontSize: 40, textAlign: 'center', fontFamily: "'Patrick Hand',cursive", color: '#f8fafc', shadow: 'suave', shadowColor: 'rgba(255,255,255,0.35)', w: 60, h: 16, lineHeight: 1.2 }) },
  { label: 'Lista con viñetas', make: () => ({ text: 'Primer punto\nSegundo punto\nTercer punto', fontSize: 24, lista: 'bullet', w: 50, h: 30 }) },
  { label: 'Lista numerada', make: () => ({ text: 'Primer paso\nSegundo paso\nTercer paso', fontSize: 24, lista: 'number', w: 50, h: 30 }) },
  { label: 'Lista de objetivos', make: () => ({ text: 'Comprender…\nAplicar…\nExplicar…', fontSize: 24, lista: 'check', listaColor: '#22c55e', w: 50, h: 30 }) },
  { label: 'Cita', make: t => ({ text: '“Escribe aquí una cita inspiradora.”\n— Autor', fontSize: 30, fontStyle: 'italic', textAlign: 'center', fontFamily: "'Playfair Display',serif", color: t.text, w: 70, h: 24, lineHeight: 1.35 }) },
];

export const LINEAS_PRESET = [
  { label: 'Línea', icon: '—', props: {} },
  { label: 'Flecha', icon: '→', props: { lineEnd: 'arrow' } },
  { label: 'Doble flecha', icon: '↔', props: { lineEnd: 'both' } },
  { label: 'Discontinua', icon: '- -', props: { strokeDash: 'dashed' } },
  { label: 'Punteada', icon: '···', props: { strokeDash: 'dotted' } },
];

// ─── DISEÑOS DE DIAPOSITIVA ───────────────────────────────────────────────────
const T = (x, y, w, h, text, extra = {}) => ({ id: nid(), type: 'text', x, y, w, h, text, ...extra });
const S = (shapeType, x, y, w, h, extra = {}) => ({ id: nid(), type: 'shape', shapeType, x, y, w, h, fill: '#6c63ff', stroke: 'none', strokeWidth: 2, borderRadius: 0, ...extra });

// Línea que une dos puntos (en %), girada para que no se deforme
export function conector(x1, y1, x2, y2, extra = {}) {
  const X1 = x1 * PX_X, Y1 = y1 * PX_Y, X2 = x2 * PX_X, Y2 = y2 * PX_Y;
  const L = Math.hypot(X2 - X1, Y2 - Y1);
  const ang = Math.atan2(Y2 - Y1, X2 - X1) * 180 / Math.PI;
  const hpx = 10;
  const cx = (X1 + X2) / 2, cy = (Y1 + Y2) / 2;
  return S('line', (cx - L / 2) / PX_X, (cy - hpx / 2) / PX_Y, L / PX_X, hpx / PX_Y, { strokeWidth: 3, rotation: Math.round(ang * 10) / 10, ...extra });
}

const titulo = (t, texto, extra = {}) => T(6, 5, 88, 14, texto, { fontSize: 40, fontWeight: '900', fontFamily: "'Poppins',sans-serif", textAlign: 'center', lineHeight: 1.15, anim: { tipo: 'down', dur: 0.6 }, ...extra });
const tituloGrande = (t) => (esClaro(t.accent)
  ? { color: t.text }
  : { gradient: { from: t.accent, to: '#ec4899', angle: 90 } });

export const PLANTILLAS = [
  {
    id: 'portada', nombre: 'Portada',
    crear: t => [
      S('circle', -6, -14, 26, 46, { fill: t.accent, opacity: 0.18 }),
      S('circle', 82, 68, 26, 46, { fill: t.tagText, opacity: 0.18 }),
      T(6, 28, 88, 24, 'Título de la presentación', { fontSize: 60, fontWeight: '900', textAlign: 'center', fontFamily: "'Poppins',sans-serif", lineHeight: 1.1, vAlign: 'middle', ...tituloGrande(t), anim: { tipo: 'up', dur: 0.8 } }),
      T(15, 56, 70, 9, 'SUBTÍTULO · NOMBRE DEL PROFESOR', { fontSize: 18, fontWeight: '600', textAlign: 'center', color: t.sub, letterSpacing: 0.2, anim: { tipo: 'fade', delay: 0.4 } }),
      S('line', 40, 68, 20, 2, { fill: t.accent, strokeWidth: 4, anim: { tipo: 'zoom', delay: 0.6 } }),
    ],
  },
  {
    id: 'portadaFoto', nombre: 'Portada con foto',
    crear: () => [
      // El marco lleva el filtro oscuro: la foto que se suelte en él sale ya oscurecida
      S('rect', 0, 0, 100, 100, { fill: '#1e293b', marco: true, filters: { brillo: 55 }, text: '🖼️ Arrastra aquí una foto (o doble clic)', fontSize: 20, color: 'rgba(255,255,255,0.7)', vAlign: 'bottom' }),
      T(8, 32, 84, 24, 'Título sobre la foto', { fontSize: 64, fontWeight: '900', textAlign: 'center', color: '#ffffff', fontFamily: "'Montserrat',sans-serif", shadow: 'fuerte', lineHeight: 1.1, vAlign: 'middle', anim: { tipo: 'blur', dur: 1 } }),
      T(20, 60, 60, 9, 'Subtítulo', { fontSize: 22, textAlign: 'center', color: 'rgba(255,255,255,0.85)', anim: { tipo: 'fade', delay: 0.6 } }),
    ],
  },
  {
    id: 'lateral', nombre: 'Título lateral',
    crear: t => [
      S('rect', 0, 0, 40, 100, { fill: t.accent }),
      T(5, 26, 32, 36, 'Tema de hoy', { fontSize: 50, fontWeight: '900', color: sobreColor(t.accent), fontFamily: "'Montserrat',sans-serif", lineHeight: 1.1, vAlign: 'middle', anim: { tipo: 'right' } }),
      T(5, 72, 10, 18, '📚', { fontSize: 56, lineHeight: 1, anim: { tipo: 'pop', delay: 0.5 } }),
      T(46, 16, 48, 68, 'Escribe aquí una breve introducción al tema.\n\nPuedes arrastrar una imagen desde tu ordenador al lienzo.', { fontSize: 22, color: t.text, lineHeight: 1.6, vAlign: 'middle', anim: { tipo: 'fade', delay: 0.3 } }),
    ],
  },
  {
    id: 'imagenTexto', nombre: 'Imagen y texto',
    crear: t => [
      T(6, 12, 42, 22, 'Título con imagen', { fontSize: 42, fontWeight: '900', fontFamily: "'Poppins',sans-serif", lineHeight: 1.15, anim: { tipo: 'right' } }),
      T(6, 38, 42, 52, 'Explica aquí lo que se ve en la imagen. Usa frases cortas y claras.', { fontSize: 21, color: t.sub, lineHeight: 1.6, anim: { tipo: 'right', delay: 0.2 } }),
      S('rect', 52, 8, 42, 84, { fill: t.card, stroke: t.cardBorder, strokeWidth: 2, strokeDash: 'dashed', borderRadius: 18, marco: true, text: '🖼️\nArrastra aquí una imagen\n(o doble clic)', fontSize: 18, fontWeight: '600', color: t.sub, anim: { tipo: 'zoom', delay: 0.3 } }),
    ],
  },
  {
    id: 'indice', nombre: 'Índice',
    crear: t => {
      const on = sobreColor(t.accent);
      const items = ['Introducción', 'Conceptos clave', 'Ejemplos', 'Actividad final'];
      return [
        titulo(t, 'Índice', { textAlign: 'left' }),
        ...items.flatMap((txt, i) => {
          const y = 25 + i * 17.5;
          const a = { tipo: 'right', delay: 0.15 * i };
          return [
            S('circle', 8, y, 6.4, 11.4, { fill: t.accent, text: `${i + 1}`, fontSize: 24, fontWeight: '900', color: on, anim: a }),
            T(17, y + 0.7, 70, 10, txt, { fontSize: 26, fontWeight: '600', vAlign: 'middle', anim: a }),
          ];
        }),
      ];
    },
  },
  {
    id: 'tarjetas', nombre: 'Tres tarjetas',
    crear: t => {
      const emo = ['💡', '🔬', '🎯'];
      return [
        titulo(t, 'Tres ideas clave'),
        ...emo.flatMap((e, i) => {
          const x = 6 + i * 30.5;
          const a = { tipo: 'up', delay: 0.2 * i };
          return [
            S('rect', x, 25, 27.5, 68, { fill: t.card, stroke: t.cardBorder, strokeWidth: 2, borderRadius: 18, shadow: 'suave', anim: a }),
            T(x, 29, 27.5, 17, e, { fontSize: 56, textAlign: 'center', lineHeight: 1, anim: { tipo: 'pop', delay: 0.2 * i + 0.25 } }),
            T(x + 2, 49, 23.5, 10, `Idea ${i + 1}`, { fontSize: 25, fontWeight: '800', textAlign: 'center', anim: a }),
            T(x + 2, 60, 23.5, 28, 'Explica la idea en una o dos frases cortas.', { fontSize: 17, textAlign: 'center', color: t.sub, anim: a }),
          ];
        }),
      ];
    },
  },
  {
    id: 'comparacion', nombre: 'Comparación',
    crear: t => [
      titulo(t, 'Comparamos'),
      S('rect', 6, 22, 42, 12, { fill: '#16a34a', borderRadius: 14, text: '✅ Ventajas', fontSize: 24, fontWeight: '800', color: '#ffffff', anim: { tipo: 'right' } }),
      S('rect', 52, 22, 42, 12, { fill: '#dc2626', borderRadius: 14, text: '❌ Inconvenientes', fontSize: 24, fontWeight: '800', color: '#ffffff', anim: { tipo: 'left' } }),
      S('rect', 6, 37, 42, 56, { fill: t.card, stroke: t.cardBorder, strokeWidth: 2, borderRadius: 14, anim: { tipo: 'right', delay: 0.15 } }),
      S('rect', 52, 37, 42, 56, { fill: t.card, stroke: t.cardBorder, strokeWidth: 2, borderRadius: 14, anim: { tipo: 'left', delay: 0.15 } }),
      T(9, 41, 36, 48, 'Primera ventaja\nSegunda ventaja\nTercera ventaja', { fontSize: 21, lista: 'check', listaColor: '#22c55e', lineHeight: 1.8, anim: { tipo: 'right', delay: 0.15 } }),
      T(55, 41, 36, 48, 'Primer inconveniente\nSegundo inconveniente\nTercer inconveniente', { fontSize: 21, lista: 'bullet', listaColor: '#ef4444', lineHeight: 1.8, anim: { tipo: 'left', delay: 0.15 } }),
    ],
  },
  {
    id: 'linea', nombre: 'Línea del tiempo',
    crear: t => {
      const anos = ['1492', '1789', '1914', '1969'];
      return [
        titulo(t, 'Línea del tiempo'),
        S('line', 6, 50, 88, 3, { fill: t.accent, strokeWidth: 5, anim: { tipo: 'zoom', dur: 0.8 } }),
        ...anos.flatMap((a, i) => {
          const cx = 15 + i * 23.3;
          const an = { tipo: 'up', delay: 0.3 + 0.25 * i };
          return [
            T(cx - 10, 33, 20, 11, a, { fontSize: 28, fontWeight: '900', textAlign: 'center', color: t.accent, anim: an }),
            S('circle', cx - 1.8, 48.3, 3.6, 6.4, { fill: t.accent, stroke: t.text, strokeWidth: 3, anim: { tipo: 'pop', delay: 0.3 + 0.25 * i } }),
            T(cx - 10.5, 59, 21, 26, 'Acontecimiento importante', { fontSize: 16, textAlign: 'center', color: t.sub, anim: an }),
          ];
        }),
      ];
    },
  },
  {
    id: 'pasos', nombre: 'Proceso en pasos',
    crear: t => {
      const cols = ['#6366f1', '#8b5cf6', '#a855f7', '#d946ef'];
      return [
        titulo(t, '¿Cómo se hace?'),
        ...cols.flatMap((c, i) => {
          const x = 4 + i * 23;
          const a = { tipo: 'right', delay: 0.2 * i };
          return [
            S('chevron', x, 32, 24, 30, { fill: c, text: `Paso ${i + 1}`, fontSize: 22, fontWeight: '800', color: '#ffffff', anim: a }),
            T(x + 2, 67, 20, 24, 'Describe brevemente este paso', { fontSize: 16, textAlign: 'center', color: t.sub, anim: a }),
          ];
        }),
      ];
    },
  },
  {
    id: 'mapa', nombre: 'Mapa mental',
    crear: t => {
      const nodos = [[17, 32], [83, 32], [17, 82], [83, 82]];
      return [
        titulo(t, 'Mapa mental', { y: 3, h: 12, fontSize: 34 }),
        ...nodos.map(([x, y], i) => conector(50, 58, x, y, { fill: t.accent, strokeDash: 'dashed', anim: { tipo: 'fade', delay: 0.3 + 0.15 * i } })),
        S('circle', 38, 36.7, 24, 42.6, { fill: t.accent, text: 'Tema central', fontSize: 26, fontWeight: '900', color: sobreColor(t.accent), shadow: 'brillo', shadowColor: t.accent, anim: { tipo: 'pop' } }),
        ...nodos.map(([x, y], i) => S('rect', x - 12, y - 7, 24, 14, { fill: t.card, stroke: t.accent, strokeWidth: 2, borderRadius: 30, text: `Idea ${i + 1}`, fontSize: 20, fontWeight: '700', color: t.text, anim: { tipo: 'zoom', delay: 0.4 + 0.15 * i } })),
      ];
    },
  },
  {
    id: 'definicion', nombre: 'Definición',
    crear: t => [
      T(6, 8, 22, 8, 'DEFINICIÓN', { bgColor: t.accent, color: sobreColor(t.accent), fontSize: 14, fontWeight: '800', letterSpacing: 0.15, textAlign: 'center', bgRadius: 20, vAlign: 'middle', lineHeight: 1.2, anim: { tipo: 'fade' } }),
      T(6, 19, 88, 16, 'Fotosíntesis', { fontSize: 56, fontWeight: '900', fontFamily: "'Poppins',sans-serif", lineHeight: 1.1, anim: { tipo: 'up', delay: 0.15 } }),
      S('rect', 6, 40, 88, 28, { fill: t.card, stroke: t.accent, strokeWidth: 3, borderRadius: 16, text: 'Proceso por el que las plantas transforman la luz del sol en energía química.', fontSize: 25, fontWeight: '500', color: t.text, textAlign: 'left', anim: { tipo: 'up', delay: 0.3 } }),
      T(6, 74, 88, 18, '💡 Ejemplo: escribe aquí un ejemplo cercano a tus alumnos.', { fontSize: 21, color: t.sub, anim: { tipo: 'fade', delay: 0.5 } }),
    ],
  },
  {
    id: 'objetivos', nombre: 'Objetivos',
    crear: t => [
      titulo(t, 'Objetivos de la sesión', { x: 6, w: 60, textAlign: 'left' }),
      T(6, 26, 56, 64, 'Comprender…\nAplicar…\nExplicar…', { lista: 'check', listaColor: '#22c55e', fontSize: 28, lineHeight: 1.8, anim: { tipo: 'right', delay: 0.2 } }),
      T(64, 20, 32, 64, '🎯', { fontSize: 190, textAlign: 'center', vAlign: 'middle', lineHeight: 1, anim: { tipo: 'zoom', delay: 0.3, bucle: 'pulse' } }),
    ],
  },
  {
    id: 'dato', nombre: 'Dato destacado',
    crear: t => [
      S('circle', 12, 9, 38, 67.5, { fill: t.accent, opacity: 0.15 }),
      T(4, 14, 54, 56, '75%', { fontSize: 150, fontWeight: '900', fontFamily: "'Montserrat',sans-serif", textAlign: 'center', vAlign: 'middle', lineHeight: 1, ...tituloGrande(t), anim: { tipo: 'pop' } }),
      T(58, 24, 37, 46, 'del agua del planeta está en los océanos.\n\nCambia este texto por el dato que quieras destacar.', { fontSize: 24, vAlign: 'middle', lineHeight: 1.5, anim: { tipo: 'left', delay: 0.4 } }),
    ],
  },
  {
    id: 'cita', nombre: 'Cita',
    crear: t => [
      T(5, 2, 20, 36, '“', { fontSize: 210, fontFamily: "'Playfair Display',serif", color: t.accent, lineHeight: 1, anim: { tipo: 'fade' } }),
      T(12, 28, 76, 38, 'La educación es el arma más poderosa que puedes usar para cambiar el mundo.', { fontSize: 36, fontFamily: "'Playfair Display',serif", fontStyle: 'italic', textAlign: 'center', vAlign: 'middle', lineHeight: 1.3, anim: { tipo: 'fade', dur: 1.2 } }),
      T(30, 70, 40, 8, '— Nelson Mandela', { fontSize: 22, fontWeight: '700', textAlign: 'center', color: t.accent, anim: { tipo: 'up', delay: 0.7 } }),
    ],
  },
  {
    id: 'pregunta', nombre: 'Pregunta a la clase',
    crear: t => [
      S('bubble', 18, 8, 64, 62, { fill: t.accent, text: '¿Qué crees que pasaría si…?', fontSize: 38, fontWeight: '800', color: sobreColor(t.accent), shadow: 'fuerte', anim: { tipo: 'pop' } }),
      T(6, 62, 15, 28, '🤔', { fontSize: 96, textAlign: 'center', lineHeight: 1, anim: { tipo: 'up', delay: 0.4, bucle: 'float' } }),
      T(26, 80, 66, 10, 'Piensa 30 segundos y coméntalo con tu compañero', { fontSize: 19, color: t.sub, textAlign: 'center', anim: { tipo: 'fade', delay: 0.8 } }),
    ],
  },
  {
    id: 'cierre', nombre: 'Cierre',
    crear: t => [
      T(6, 22, 88, 30, '¡Gracias!', { fontSize: 100, textAlign: 'center', fontFamily: "'Pacifico',cursive", lineHeight: 1.2, vAlign: 'middle', ...tituloGrande(t), anim: { tipo: 'pop', dur: 0.9 } }),
      T(15, 57, 70, 10, '¿Preguntas?', { fontSize: 30, color: t.sub, textAlign: 'center', anim: { tipo: 'fade', delay: 0.6 } }),
      T(25, 71, 50, 17, '🎉 👏 🙌', { fontSize: 50, textAlign: 'center', lineHeight: 1, anim: { tipo: 'up', delay: 0.9, bucle: 'pulse' } }),
    ],
  },
];
