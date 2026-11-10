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
// Cada diseño: crear(t, d) → elementos. `d` es el contenido (lo rellena la IA o se
// usan textos de ejemplo). Los textos largos reducen su letra para caber en la caja.
const T = (x, y, w, h, text, extra = {}) => {
  const { fit, ...resto } = extra;
  const el = { id: nid(), type: 'text', x, y, w, h, text, ...resto };
  if (fit) el.fontSize = encajarLetra(el);
  return el;
};
const S = (shapeType, x, y, w, h, extra = {}) => {
  const { fit, ...resto } = extra;
  const el = { id: nid(), type: 'shape', shapeType, x, y, w, h, fill: '#6c63ff', stroke: 'none', strokeWidth: 2, borderRadius: 0, ...resto };
  if (fit && el.text) el.fontSize = encajarLetra(el, 0.8);
  return el;
};

// Tamaño de letra (px) con el que el texto cabe aproximadamente en su caja
function encajarLetra(el, margen = 0.92) {
  const base = el.fontSize || 20;
  const wpx = el.w * PX_X * margen - 14 - (el.lista ? base * 1.2 : 0);
  const hpx = el.h * PX_Y * margen - 8;
  const lh = el.lineHeight || 1.4;
  const ancho = /Bebas|Oswald|Amatic/.test(el.fontFamily || '') ? 0.42 : /Poppins|Montserrat|Fredoka|Righteous/.test(el.fontFamily || '') ? 0.6 : 0.54;
  const lineas = (fs) => String(el.text || '').split('\n')
    .reduce((n, p) => n + Math.max(1, Math.ceil([...p].length * ancho * fs / Math.max(40, wpx))), 0);
  let fs = base;
  while (fs > 12 && lineas(fs) * fs * lh > hpx) fs -= 1;
  return fs;
}

// Línea que une dos puntos (en %), girada para que no se deforme
export function conector(x1, y1, x2, y2, extra = {}) {
  const X1 = x1 * PX_X, Y1 = y1 * PX_Y, X2 = x2 * PX_X, Y2 = y2 * PX_Y;
  const L = Math.hypot(X2 - X1, Y2 - Y1);
  const ang = Math.atan2(Y2 - Y1, X2 - X1) * 180 / Math.PI;
  const hpx = 10;
  const cx = (X1 + X2) / 2, cy = (Y1 + Y2) / 2;
  return S('line', (cx - L / 2) / PX_X, (cy - hpx / 2) / PX_Y, L / PX_X, hpx / PX_Y, { strokeWidth: 3, rotation: Math.round(ang * 10) / 10, ...extra });
}

// Ayudantes para leer el contenido que llegue (de la IA o vacío)
const tx = (v, def) => (v == null || String(v).trim() === '' ? def : String(v).trim());
const lista = (v, def, min = 1, max = 8) => {
  let a = Array.isArray(v) ? v : typeof v === 'string' ? v.split('\n') : [];
  a = a.map(x => (typeof x === 'object' && x ? x : String(x).replace(/^\s*[•\-*·]\s*/, '').trim())).filter(x => (typeof x === 'object' ? true : x));
  if (a.length < min) a = def;
  return a.slice(0, max);
};
const obj = (v) => (v && typeof v === 'object' ? v : { texto: v });

const titulo = (t, texto, extra = {}) => T(6, 5, 88, 14, texto, { fontSize: 40, fontWeight: '900', fontFamily: "'Poppins',sans-serif", textAlign: 'center', lineHeight: 1.15, anim: { tipo: 'down', dur: 0.6 }, fit: true, ...extra });
const tituloGrande = (t) => (esClaro(t.accent)
  ? { color: t.text }
  : { gradient: { from: t.accent, to: '#ec4899', angle: 90 } });

export const PLANTILLAS = [
  {
    id: 'portada', nombre: 'Portada',
    crear: (t, d = {}) => [
      S('circle', -6, -14, 26, 46, { fill: t.accent, opacity: 0.18 }),
      S('circle', 82, 68, 26, 46, { fill: t.tagText, opacity: 0.18 }),
      T(6, 28, 88, 24, tx(d.titulo, 'Título de la presentación'), { fontSize: 60, fontWeight: '900', textAlign: 'center', fontFamily: "'Poppins',sans-serif", lineHeight: 1.1, vAlign: 'middle', ...tituloGrande(t), anim: { tipo: 'up', dur: 0.8 }, fit: true }),
      T(15, 56, 70, 9, tx(d.subtitulo, 'SUBTÍTULO · NOMBRE DEL PROFESOR'), { fontSize: 18, fontWeight: '600', textAlign: 'center', color: t.sub, letterSpacing: 0.2, uppercase: true, anim: { tipo: 'fade', delay: 0.4 }, fit: true }),
      S('line', 40, 68, 20, 2, { fill: t.accent, strokeWidth: 4, anim: { tipo: 'zoom', delay: 0.6 } }),
    ],
  },
  {
    id: 'portadaFoto', nombre: 'Portada con foto',
    crear: (t, d = {}) => [
      // El marco lleva el filtro oscuro: la foto que se suelte en él sale ya oscurecida
      S('rect', 0, 0, 100, 100, { fill: '#1e293b', marco: true, filters: { brillo: 55 }, text: '🖼️ Arrastra aquí una foto (o doble clic)', fontSize: 20, color: 'rgba(255,255,255,0.7)', vAlign: 'bottom' }),
      T(8, 32, 84, 24, tx(d.titulo, 'Título sobre la foto'), { fontSize: 64, fontWeight: '900', textAlign: 'center', color: '#ffffff', fontFamily: "'Montserrat',sans-serif", shadow: 'fuerte', lineHeight: 1.1, vAlign: 'middle', anim: { tipo: 'blur', dur: 1 }, fit: true }),
      T(20, 60, 60, 9, tx(d.subtitulo, 'Subtítulo'), { fontSize: 22, textAlign: 'center', color: 'rgba(255,255,255,0.85)', anim: { tipo: 'fade', delay: 0.6 }, fit: true }),
    ],
  },
  {
    id: 'lateral', nombre: 'Título lateral',
    crear: (t, d = {}) => [
      S('rect', 0, 0, 40, 100, { fill: t.accent }),
      T(5, 22, 32, 44, tx(d.titulo, 'Tema de hoy'), { fontSize: 50, fontWeight: '900', color: sobreColor(t.accent), fontFamily: "'Montserrat',sans-serif", lineHeight: 1.1, vAlign: 'middle', anim: { tipo: 'right' }, fit: true }),
      T(5, 72, 12, 18, tx(d.emoji, '📚'), { fontSize: 56, lineHeight: 1, anim: { tipo: 'pop', delay: 0.5 } }),
      T(46, 12, 48, 76, tx(d.texto, 'Escribe aquí una breve introducción al tema.\n\nPuedes arrastrar una imagen desde tu ordenador al lienzo.'), { fontSize: 24, color: t.text, lineHeight: 1.55, vAlign: 'middle', anim: { tipo: 'fade', delay: 0.3 }, fit: true }),
    ],
  },
  {
    id: 'imagenTexto', nombre: 'Imagen y texto',
    crear: (t, d = {}) => [
      T(6, 10, 42, 24, tx(d.titulo, 'Título con imagen'), { fontSize: 42, fontWeight: '900', fontFamily: "'Poppins',sans-serif", lineHeight: 1.15, vAlign: 'bottom', anim: { tipo: 'right' }, fit: true }),
      T(6, 38, 42, 54, tx(d.texto, 'Explica aquí lo que se ve en la imagen. Usa frases cortas y claras.'), { fontSize: 22, color: t.sub, lineHeight: 1.55, anim: { tipo: 'right', delay: 0.2 }, fit: true }),
      S('rect', 52, 8, 42, 84, { fill: t.card, stroke: t.cardBorder, strokeWidth: 2, strokeDash: 'dashed', borderRadius: 18, marco: true, text: `🖼️\n${tx(d.imagen, 'Arrastra aquí una imagen')}\n(o doble clic)`, fontSize: 18, fontWeight: '600', color: t.sub, anim: { tipo: 'zoom', delay: 0.3 }, fit: true }),
    ],
  },
  {
    id: 'indice', nombre: 'Índice',
    crear: (t, d = {}) => {
      const on = sobreColor(t.accent);
      const items = lista(d.puntos, ['Introducción', 'Conceptos clave', 'Ejemplos', 'Actividad final'], 2, 6);
      const paso = Math.min(17.5, 68 / items.length);
      const hc = Math.min(11.4, paso - 2.5), wc = hc * PX_Y / PX_X;
      return [
        titulo(t, tx(d.titulo, 'Índice'), { textAlign: 'left' }),
        ...items.flatMap((txt, i) => {
          const y = 24 + i * paso;
          const a = { tipo: 'right', delay: 0.15 * i };
          return [
            S('circle', 8, y, wc, hc, { fill: t.accent, text: `${i + 1}`, fontSize: Math.round(hc * 2.1), fontWeight: '900', color: on, anim: a }),
            T(10 + wc, y, 82 - wc, hc, String(txt), { fontSize: 26, fontWeight: '600', vAlign: 'middle', lineHeight: 1.2, anim: a, fit: true }),
          ];
        }),
      ];
    },
  },
  {
    id: 'tarjetas', nombre: 'Tarjetas',
    crear: (t, d = {}) => {
      const def = [{ emoji: '💡', titulo: 'Idea 1' }, { emoji: '🔬', titulo: 'Idea 2' }, { emoji: '🎯', titulo: 'Idea 3' }];
      const tj = lista(d.tarjetas, def, 2, 4).map(obj);
      const n = tj.length, w = (88 - 3 * (n - 1)) / n;
      return [
        titulo(t, tx(d.titulo, 'Ideas clave')),
        ...tj.flatMap((c, i) => {
          const x = 6 + i * (w + 3);
          const a = { tipo: 'up', delay: 0.2 * i };
          return [
            S('rect', x, 25, w, 68, { fill: t.card, stroke: t.cardBorder, strokeWidth: 2, borderRadius: 18, shadow: 'suave', anim: a }),
            T(x, 28, w, 17, tx(c.emoji, ['💡', '🔬', '🎯', '⭐'][i]), { fontSize: 56, textAlign: 'center', lineHeight: 1, anim: { tipo: 'pop', delay: 0.2 * i + 0.25 } }),
            T(x + 1.5, 46, w - 3, 13, tx(c.titulo, `Idea ${i + 1}`), { fontSize: 25, fontWeight: '800', textAlign: 'center', vAlign: 'middle', lineHeight: 1.15, anim: a, fit: true }),
            T(x + 1.5, 60, w - 3, 30, tx(c.texto, 'Explica la idea en una o dos frases cortas.'), { fontSize: 18, textAlign: 'center', color: t.sub, lineHeight: 1.4, anim: a, fit: true }),
          ];
        }),
      ];
    },
  },
  {
    id: 'comparacion', nombre: 'Comparación',
    crear: (t, d = {}) => {
      const iz = obj(d.izquierda || {}), de = obj(d.derecha || {});
      const pi = lista(iz.puntos, ['Primera ventaja', 'Segunda ventaja', 'Tercera ventaja'], 1, 6).join('\n');
      const pd = lista(de.puntos, ['Primer inconveniente', 'Segundo inconveniente', 'Tercer inconveniente'], 1, 6).join('\n');
      return [
        titulo(t, tx(d.titulo, 'Comparamos')),
        S('rect', 6, 22, 42, 12, { fill: '#16a34a', borderRadius: 14, text: tx(iz.titulo, '✅ Ventajas'), fontSize: 24, fontWeight: '800', color: '#ffffff', anim: { tipo: 'right' }, fit: true }),
        S('rect', 52, 22, 42, 12, { fill: '#dc2626', borderRadius: 14, text: tx(de.titulo, '❌ Inconvenientes'), fontSize: 24, fontWeight: '800', color: '#ffffff', anim: { tipo: 'left' }, fit: true }),
        S('rect', 6, 37, 42, 56, { fill: t.card, stroke: t.cardBorder, strokeWidth: 2, borderRadius: 14, anim: { tipo: 'right', delay: 0.15 } }),
        S('rect', 52, 37, 42, 56, { fill: t.card, stroke: t.cardBorder, strokeWidth: 2, borderRadius: 14, anim: { tipo: 'left', delay: 0.15 } }),
        T(9, 40, 36, 50, pi, { fontSize: 22, lista: 'check', listaColor: '#22c55e', lineHeight: 1.6, anim: { tipo: 'right', delay: 0.15 }, fit: true }),
        T(55, 40, 36, 50, pd, { fontSize: 22, lista: 'bullet', listaColor: '#ef4444', lineHeight: 1.6, anim: { tipo: 'left', delay: 0.15 }, fit: true }),
      ];
    },
  },
  {
    id: 'linea', nombre: 'Línea del tiempo',
    crear: (t, d = {}) => {
      const def = [{ fecha: '1492' }, { fecha: '1789' }, { fecha: '1914' }, { fecha: '1969' }];
      const hitos = lista(d.hitos, def, 2, 6).map(h => (typeof h === 'object' ? h : { fecha: h }));
      const n = hitos.length, wl = Math.min(21, 88 / n - 1);
      return [
        titulo(t, tx(d.titulo, 'Línea del tiempo')),
        S('line', 6, 50, 88, 3, { fill: t.accent, strokeWidth: 5, anim: { tipo: 'zoom', dur: 0.8 } }),
        ...hitos.flatMap((h, i) => {
          const cx = 6 + 88 * (i + 0.5) / n;
          const an = { tipo: 'up', delay: 0.3 + 0.25 * i };
          return [
            T(cx - wl / 2, 33, wl, 12, tx(h.fecha, '—'), { fontSize: 28, fontWeight: '900', textAlign: 'center', vAlign: 'bottom', color: t.accent, lineHeight: 1.1, anim: an, fit: true }),
            S('circle', cx - 1.8, 48.3, 3.6, 6.4, { fill: t.accent, stroke: t.text, strokeWidth: 3, anim: { tipo: 'pop', delay: 0.3 + 0.25 * i } }),
            T(cx - wl / 2, 59, wl, 33, tx(h.texto, 'Acontecimiento importante'), { fontSize: 17, textAlign: 'center', color: t.sub, lineHeight: 1.35, anim: an, fit: true }),
          ];
        }),
      ];
    },
  },
  {
    id: 'pasos', nombre: 'Proceso en pasos',
    crear: (t, d = {}) => {
      const cols = ['#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899'];
      const ps = lista(d.pasos, [{}, {}, {}, {}], 2, 5).map(obj);
      const n = ps.length, paso = 92 / n;
      return [
        titulo(t, tx(d.titulo, '¿Cómo se hace?')),
        ...ps.flatMap((p, i) => {
          const x = 4 + i * paso;
          const a = { tipo: 'right', delay: 0.2 * i };
          return [
            S('chevron', x, 30, paso + 1, 30, { fill: cols[i % cols.length], text: tx(p.titulo, `Paso ${i + 1}`), fontSize: 22, fontWeight: '800', color: '#ffffff', anim: a, fit: true }),
            T(x + 1, 64, paso - 1, 30, tx(p.texto, 'Describe brevemente este paso'), { fontSize: 17, textAlign: 'center', color: t.sub, lineHeight: 1.35, anim: a, fit: true }),
          ];
        }),
      ];
    },
  },
  {
    id: 'mapa', nombre: 'Mapa mental',
    crear: (t, d = {}) => {
      const ideas = lista(d.ideas, ['Idea 1', 'Idea 2', 'Idea 3', 'Idea 4'], 2, 6).map(x => (typeof x === 'object' ? tx(x.texto || x.titulo, 'Idea') : x));
      const n = ideas.length;
      const pos = ideas.map((_, i) => {
        const a = -Math.PI / 2 + (i + 0.5) * 2 * Math.PI / n;
        return [50 + 33 * Math.cos(a), 58 + 25 * Math.sin(a)];
      });
      return [
        titulo(t, tx(d.titulo, 'Mapa mental'), { y: 3, h: 12, fontSize: 34 }),
        ...pos.map(([x, y], i) => conector(50, 58, x, y, { fill: t.accent, strokeDash: 'dashed', anim: { tipo: 'fade', delay: 0.3 + 0.15 * i } })),
        S('circle', 38, 36.7, 24, 42.6, { fill: t.accent, text: tx(d.centro, 'Tema central'), fontSize: 26, fontWeight: '900', color: sobreColor(t.accent), shadow: 'brillo', shadowColor: t.accent, anim: { tipo: 'pop' }, fit: true }),
        ...pos.map(([x, y], i) => S('rect', x - 12, y - 7, 24, 14, { fill: t.card, stroke: t.accent, strokeWidth: 2, borderRadius: 30, text: ideas[i], fontSize: 20, fontWeight: '700', color: t.text, anim: { tipo: 'zoom', delay: 0.4 + 0.15 * i }, fit: true })),
      ];
    },
  },
  {
    id: 'definicion', nombre: 'Definición',
    crear: (t, d = {}) => [
      T(6, 8, 22, 8, tx(d.etiqueta, 'DEFINICIÓN'), { bgColor: t.accent, color: sobreColor(t.accent), fontSize: 14, fontWeight: '800', letterSpacing: 0.15, uppercase: true, textAlign: 'center', bgRadius: 20, vAlign: 'middle', lineHeight: 1.2, anim: { tipo: 'fade' } }),
      T(6, 18, 88, 18, tx(d.termino, 'Fotosíntesis'), { fontSize: 56, fontWeight: '900', fontFamily: "'Poppins',sans-serif", lineHeight: 1.1, vAlign: 'middle', anim: { tipo: 'up', delay: 0.15 }, fit: true }),
      S('rect', 6, 40, 88, 30, { fill: t.card, stroke: t.accent, strokeWidth: 3, borderRadius: 16, text: tx(d.definicion, 'Proceso por el que las plantas transforman la luz del sol en energía química.'), fontSize: 25, fontWeight: '500', color: t.text, textAlign: 'left', anim: { tipo: 'up', delay: 0.3 }, fit: true }),
      T(6, 74, 88, 20, `💡 ${tx(d.ejemplo, 'Ejemplo: escribe aquí un ejemplo cercano a tus alumnos.')}`, { fontSize: 21, color: t.sub, lineHeight: 1.4, anim: { tipo: 'fade', delay: 0.5 }, fit: true }),
    ],
  },
  {
    id: 'objetivos', nombre: 'Objetivos',
    crear: (t, d = {}) => [
      titulo(t, tx(d.titulo, 'Objetivos de la sesión'), { x: 6, w: 60, textAlign: 'left' }),
      T(6, 24, 58, 68, lista(d.puntos, ['Comprender…', 'Aplicar…', 'Explicar…'], 1, 7).join('\n'), { lista: 'check', listaColor: '#22c55e', fontSize: 28, lineHeight: 1.6, anim: { tipo: 'right', delay: 0.2 }, fit: true }),
      T(66, 20, 30, 64, tx(d.emoji, '🎯'), { fontSize: 170, textAlign: 'center', vAlign: 'middle', lineHeight: 1, anim: { tipo: 'zoom', delay: 0.3, bucle: 'pulse' } }),
    ],
  },
  {
    id: 'dato', nombre: 'Dato destacado',
    crear: (t, d = {}) => {
      const dato = tx(d.dato, '75%');
      return [
        S('circle', 12, 9, 38, 67.5, { fill: t.accent, opacity: 0.15 }),
        T(4, 14, 54, 56, dato, { fontSize: Math.round(Math.max(56, Math.min(150, 600 / Math.max(4, [...dato].length)))), fontWeight: '900', fontFamily: "'Montserrat',sans-serif", textAlign: 'center', vAlign: 'middle', lineHeight: 1, ...tituloGrande(t), anim: { tipo: 'pop' } }),
        T(58, 18, 37, 60, tx(d.texto, 'del agua del planeta está en los océanos.\n\nCambia este texto por el dato que quieras destacar.'), { fontSize: 26, vAlign: 'middle', lineHeight: 1.45, anim: { tipo: 'left', delay: 0.4 }, fit: true }),
      ];
    },
  },
  {
    id: 'cita', nombre: 'Cita',
    crear: (t, d = {}) => [
      T(5, 2, 20, 36, '“', { fontSize: 210, fontFamily: "'Playfair Display',serif", color: t.accent, lineHeight: 1, anim: { tipo: 'fade' } }),
      T(12, 26, 76, 42, tx(d.cita, 'La educación es el arma más poderosa que puedes usar para cambiar el mundo.'), { fontSize: 36, fontFamily: "'Playfair Display',serif", fontStyle: 'italic', textAlign: 'center', vAlign: 'middle', lineHeight: 1.3, anim: { tipo: 'fade', dur: 1.2 }, fit: true }),
      T(20, 71, 60, 9, `— ${tx(d.autor, 'Nelson Mandela').replace(/^[—-]\s*/, '')}`, { fontSize: 22, fontWeight: '700', textAlign: 'center', color: t.accent, anim: { tipo: 'up', delay: 0.7 }, fit: true }),
    ],
  },
  {
    id: 'pregunta', nombre: 'Pregunta a la clase',
    crear: (t, d = {}) => [
      S('bubble', 18, 8, 64, 62, { fill: t.accent, text: tx(d.pregunta, '¿Qué crees que pasaría si…?'), fontSize: 38, fontWeight: '800', color: sobreColor(t.accent), shadow: 'fuerte', anim: { tipo: 'pop' }, fit: true }),
      T(6, 62, 15, 28, tx(d.emoji, '🤔'), { fontSize: 96, textAlign: 'center', lineHeight: 1, anim: { tipo: 'up', delay: 0.4, bucle: 'float' } }),
      T(24, 78, 70, 14, tx(d.pista, 'Piensa 30 segundos y coméntalo con tu compañero'), { fontSize: 19, color: t.sub, textAlign: 'center', vAlign: 'middle', anim: { tipo: 'fade', delay: 0.8 }, fit: true }),
    ],
  },
  {
    id: 'cierre', nombre: 'Cierre',
    crear: (t, d = {}) => [
      T(6, 20, 88, 32, tx(d.titulo, '¡Gracias!'), { fontSize: 100, textAlign: 'center', fontFamily: "'Pacifico',cursive", lineHeight: 1.2, vAlign: 'middle', ...tituloGrande(t), anim: { tipo: 'pop', dur: 0.9 }, fit: true }),
      T(12, 55, 76, 14, tx(d.subtitulo, '¿Preguntas?'), { fontSize: 30, color: t.sub, textAlign: 'center', vAlign: 'middle', lineHeight: 1.3, anim: { tipo: 'fade', delay: 0.6 }, fit: true }),
      T(25, 72, 50, 17, tx(d.emojis, '🎉 👏 🙌'), { fontSize: 50, textAlign: 'center', lineHeight: 1, anim: { tipo: 'up', delay: 0.9, bucle: 'pulse' } }),
    ],
  },
];

export const PLANTILLAS_POR_ID = Object.fromEntries(PLANTILLAS.map(p => [p.id, p]));

// Qué campos rellena la IA en cada diseño (se usa para escribir el prompt)
export const DISENOS_IA = [
  ['portada', 'primera diapositiva', '"titulo", "subtitulo"'],
  ['portadaFoto', 'portada sobre una foto a pantalla completa (la foto la pone el profesor)', '"titulo", "subtitulo"'],
  ['lateral', 'introducción: título en una franja de color y un párrafo', '"titulo", "texto" (2-4 frases), "emoji"'],
  ['imagenTexto', 'explicar algo que se ve en una imagen (la añade el profesor)', '"titulo", "texto", "imagen" (qué imagen poner, ej. "Foto de un volcán")'],
  ['indice', 'índice o agenda', '"titulo", "puntos": [2-6 textos cortos]'],
  ['tarjetas', '2-4 ideas clave en tarjetas', '"titulo", "tarjetas": [{"emoji","titulo","texto"}] (2-4)'],
  ['comparacion', 'comparar dos cosas / ventajas e inconvenientes', '"titulo", "izquierda": {"titulo","puntos":[...]}, "derecha": {"titulo","puntos":[...]}'],
  ['linea', 'línea del tiempo o evolución', '"titulo", "hitos": [{"fecha","texto"}] (2-6)'],
  ['pasos', 'proceso o procedimiento', '"titulo", "pasos": [{"titulo","texto"}] (2-5)'],
  ['mapa', 'mapa mental / conceptos relacionados', '"titulo", "centro", "ideas": [2-6 textos muy cortos]'],
  ['definicion', 'definir un concepto', '"termino", "definicion", "ejemplo", "etiqueta" (opcional, ej. "CONCEPTO")'],
  ['objetivos', 'objetivos de la sesión o lista de puntos', '"titulo", "puntos": [1-7], "emoji"'],
  ['dato', 'un número o dato llamativo', '"dato" (muy corto, ej. "75%", "1492", "3×10⁸"), "texto"'],
  ['cita', 'una cita célebre', '"cita", "autor"'],
  ['pregunta', 'pregunta para hacer pensar a la clase', '"pregunta", "pista", "emoji"'],
  ['cierre', 'última diapositiva', '"titulo", "subtitulo", "emojis"'],
];
