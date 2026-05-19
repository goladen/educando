import { useState, useRef, useCallback, useEffect, forwardRef, useImperativeHandle } from 'react';
import { db } from '../firebase';
import { collection, addDoc, updateDoc, doc, serverTimestamp, query, where, getDocs } from 'firebase/firestore';
import { callGeminiProxy, extractText } from '../geminiProxy';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import html2canvas from 'html2canvas';

// ─── VIDEO URL PARSER ────────────────────────────────────────────────────────
export function parseVideoUrl(url) {
  if (!url || !url.trim()) return null;
  const u = url.trim();
  // YouTube
  const yt = u.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  if (yt) return { type: 'youtube', id: yt[1], embed: `https://www.youtube.com/embed/${yt[1]}?rel=0&modestbranding=1`, thumb: `https://img.youtube.com/vi/${yt[1]}/hqdefault.jpg` };
  // Vimeo
  const vi = u.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if (vi) return { type: 'vimeo', id: vi[1], embed: `https://player.vimeo.com/video/${vi[1]}`, thumb: null };
  // Direct video file
  if (u.match(/\.(mp4|webm|ogg|mov)(\?.*)?$/i)) return { type: 'direct', embed: u, thumb: null };
  return null;
}

// ─── GAME ICONS ───────────────────────────────────────────────────────────────
const TIPO_ICONS = {
  PASAPALABRA: '🔤', CAZABURBUJAS: '🫧', THINKHOOT: '📡', PILIVE: '📡',
  MATHLIVE: '🧮', OLYMPICLIVE: '🏅', APAREJADOS: '🃏', RULETA: '🎡',
  WORDLE: '📝', OMNI: '📚', OMNINTERACTIVE: '📚', VIDEOQUIZZ: '🎬',
  SOLAR_SYSTEM: '🪐', SINTAXIS: '🖊️', ETIQUETAS: '🏷️', QUESTION_SENDER: '📮',
};
const TIPO_LABELS = {
  PASAPALABRA: 'Pasapalabra', CAZABURBUJAS: 'Burbujas/Pikatron', THINKHOOT: 'Pi-Live',
  MATHLIVE: 'MathLive', OLYMPICLIVE: 'Olympic Live', APAREJADOS: 'AparejaDOS',
  RULETA: 'La Ruleta', WORDLE: 'Wordle', OMNI: 'Omninteractive',
  OMNINTERACTIVE: 'Omninteractive', VIDEOQUIZZ: 'VideoQuizz', SOLAR_SYSTEM: 'Sistema Solar',
  SINTAXIS: 'Sintaxis', ETIQUETAS: 'EtiquetaMe', QUESTION_SENDER: 'Q-Sender',
};

// ─── FREE CANVAS CONSTANTS ────────────────────────────────────────────────────
const PALETTE = [
  '#ffffff','#000000','#ef4444','#f97316','#eab308','#22c55e',
  '#06b6d4','#3b82f6','#8b5cf6','#ec4899','#10b981','#f59e0b',
  '#1f2937','#374151','#6b7280','#d1d5db',
];
const FONTS = [
  { label: 'Sans',    value: "'Inter','Segoe UI',sans-serif" },
  { label: 'Serif',   value: "'Georgia',serif" },
  { label: 'Mono',    value: "'Courier New',monospace" },
  { label: 'Display', value: "'Arial Black',Impact,sans-serif" },
  { label: 'Cursiva', value: "'Comic Sans MS',cursive" },
];
const FC_BTN = (bg, color, extra = {}) => ({
  background: bg, color, border: 'none', borderRadius: 8,
  padding: '5px 11px', cursor: 'pointer', fontSize: 11, fontWeight: 700, ...extra,
});

// ─── COLOR PICKER ─────────────────────────────────────────────────────────────
function ColorPicker({ value, onChange, label, allowNull }) {
  return (
    <div style={{ marginBottom: 10 }}>
      {label && <div style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', marginBottom: 5, letterSpacing: 0.5 }}>{label}</div>}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center' }}>
        {allowNull && (
          <div onClick={() => onChange(null)} title="Auto (tema)"
            style={{ width: 20, height: 20, borderRadius: 4, cursor: 'pointer', background: 'linear-gradient(135deg,#374151 50%,#9ca3af 50%)', border: value == null ? '2px solid #fff' : '2px solid #374151', boxSizing: 'border-box' }} />
        )}
        {PALETTE.map(c => (
          <div key={c} onClick={() => onChange(c)} style={{
            width: 20, height: 20, borderRadius: 4, cursor: 'pointer', background: c,
            border: value === c ? '2px solid #fff' : '2px solid transparent',
            boxSizing: 'border-box', boxShadow: c === '#ffffff' ? 'inset 0 0 0 1px #374151' : 'none',
          }} />
        ))}
        <div title="Personalizado" style={{ width: 20, height: 20, borderRadius: 4, background: 'conic-gradient(red,#ff0,green,cyan,blue,magenta,red)', position: 'relative', overflow: 'hidden', cursor: 'pointer', border: '2px solid #374151', boxSizing: 'border-box' }}>
          <input type="color" value={value || '#6c63ff'} onChange={e => onChange(e.target.value)}
            style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', width: '100%', height: '100%' }} />
        </div>
      </div>
    </div>
  );
}

// ─── ELEMENT PROPERTIES PANEL ─────────────────────────────────────────────────
function ElementProperties({ el, updateEl, onDelete, onDuplicate, onBringFwd, onSendBck }) {
  const isText    = el.type === 'text';
  const isShape   = el.type === 'shape';
  const isImage   = el.type === 'image';
  const isYT      = el.type === 'youtube';
  const isWebview = el.type === 'webview';
  const active = (condition) => ({
    background: condition ? '#6c63ff' : '#374151', color: '#fff',
    border: 'none', borderRadius: 5, padding: '5px 0', cursor: 'pointer', fontSize: 12, flex: 1,
  });
  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 1 }}>
          {isText ? '📝 Texto' : isShape ? '⬜ Forma' : isYT ? '▶ YouTube' : isWebview ? '🌐 Web' : '🖼️ Imagen'}
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          <button onClick={onDuplicate} title="Duplicar (Ctrl+D)" style={{ background: '#374151', color: '#9ca3af', border: 'none', borderRadius: 4, padding: '3px 7px', cursor: 'pointer', fontSize: 11 }}>⧉</button>
          <button onClick={onDelete} title="Eliminar (Del)" style={{ background: 'rgba(239,68,68,0.2)', color: '#f87171', border: 'none', borderRadius: 4, padding: '3px 7px', cursor: 'pointer', fontSize: 11 }}>🗑</button>
        </div>
      </div>

      {/* TEXT PROPS */}
      {isText && <>
        <div style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 10, color: '#9ca3af', marginBottom: 3 }}>FUENTE</div>
          <select value={el.fontFamily || FONTS[0].value} onChange={e => updateEl({ fontFamily: e.target.value })}
            style={{ width: '100%', background: '#111827', border: '1px solid #374151', borderRadius: 6, padding: '5px 8px', color: '#fff', fontSize: 11, outline: 'none' }}>
            {FONTS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
          </select>
        </div>
        <div style={{ marginBottom: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
            <div style={{ fontSize: 10, color: '#9ca3af' }}>TAMAÑO</div>
            <div style={{ fontSize: 10, color: '#6b7280' }}>{el.fontSize || 16}px</div>
          </div>
          <input type="range" min={8} max={120} value={el.fontSize || 16} onChange={e => updateEl({ fontSize: +e.target.value })}
            style={{ width: '100%', accentColor: '#6c63ff' }} />
        </div>
        <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
          <button style={active(el.fontWeight === 'bold' || el.fontWeight === '900')} onClick={() => updateEl({ fontWeight: (el.fontWeight === 'bold' || el.fontWeight === '900') ? 'normal' : 'bold' })}><strong>B</strong></button>
          <button style={active(el.fontStyle === 'italic')} onClick={() => updateEl({ fontStyle: el.fontStyle === 'italic' ? 'normal' : 'italic' })}><em>I</em></button>
          <button style={active(el.textDecoration === 'underline')} onClick={() => updateEl({ textDecoration: el.textDecoration === 'underline' ? 'none' : 'underline' })}><u>U</u></button>
        </div>
        <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
          {[['◀',   'left'], ['≡', 'center'], ['▶', 'right']].map(([ico, a]) => (
            <button key={a} style={active((el.textAlign || 'left') === a)} onClick={() => updateEl({ textAlign: a })}>{ico}</button>
          ))}
        </div>
        <ColorPicker label="COLOR TEXTO" value={el.color} onChange={c => updateEl({ color: c })} allowNull />
      </>}

      {/* SHAPE PROPS */}
      {isShape && <>
        <ColorPicker label="COLOR RELLENO" value={el.fill} onChange={c => updateEl({ fill: c })} />
        <ColorPicker label="COLOR BORDE" value={el.stroke === 'none' ? null : el.stroke} onChange={c => updateEl({ stroke: c || 'none' })} allowNull />
        {(el.shapeType === 'rect') && (
          <div style={{ marginBottom: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
              <div style={{ fontSize: 10, color: '#9ca3af' }}>REDONDEO</div>
              <div style={{ fontSize: 10, color: '#6b7280' }}>{el.borderRadius || 0}px</div>
            </div>
            <input type="range" min={0} max={50} value={el.borderRadius || 0} onChange={e => updateEl({ borderRadius: +e.target.value })}
              style={{ width: '100%', accentColor: '#6c63ff' }} />
          </div>
        )}
      </>}

      {/* IMAGE PROPS */}
      {isImage && <>
        <div style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 10, color: '#9ca3af', marginBottom: 4 }}>AJUSTE</div>
          <div style={{ display: 'flex', gap: 4 }}>
            {['cover','contain','fill'].map(fit => (
              <button key={fit} style={active((el.objectFit || 'cover') === fit)} onClick={() => updateEl({ objectFit: fit })}>{fit}</button>
            ))}
          </div>
        </div>
        <div style={{ marginBottom: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
            <div style={{ fontSize: 10, color: '#9ca3af' }}>REDONDEO</div>
            <div style={{ fontSize: 10, color: '#6b7280' }}>{el.borderRadius || 0}px</div>
          </div>
          <input type="range" min={0} max={50} value={el.borderRadius || 0} onChange={e => updateEl({ borderRadius: +e.target.value })}
            style={{ width: '100%', accentColor: '#6c63ff' }} />
        </div>
      </>}

      {/* OPACITY — all */}
      <div style={{ marginBottom: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
          <div style={{ fontSize: 10, color: '#9ca3af' }}>OPACIDAD</div>
          <div style={{ fontSize: 10, color: '#6b7280' }}>{Math.round((el.opacity ?? 1) * 100)}%</div>
        </div>
        <input type="range" min={0.05} max={1} step={0.05} value={el.opacity ?? 1} onChange={e => updateEl({ opacity: +e.target.value })}
          style={{ width: '100%', accentColor: '#6c63ff' }} />
      </div>

      {/* Layer order */}
      <div style={{ display: 'flex', gap: 4 }}>
        <button onClick={onBringFwd} style={{ flex: 1, background: '#374151', color: '#9ca3af', border: 'none', borderRadius: 6, padding: '5px 0', cursor: 'pointer', fontSize: 10, fontWeight: 700 }}>↑ Al frente</button>
        <button onClick={onSendBck} style={{ flex: 1, background: '#374151', color: '#9ca3af', border: 'none', borderRadius: 6, padding: '5px 0', cursor: 'pointer', fontSize: 10, fontWeight: 700 }}>↓ Al fondo</button>
      </div>
    </div>
  );
}

// ─── TEMPLATES ────────────────────────────────────────────────────────────────
const THEMES = {
  dark: {
    label: 'Oscuro',
    bg: 'linear-gradient(135deg, #1a0533 0%, #0d1b4a 50%, #0a0a1a 100%)',
    accent: '#6c63ff',
    text: '#ffffff',
    sub: 'rgba(255,255,255,0.65)',
    card: 'rgba(255,255,255,0.07)',
    cardBorder: 'rgba(255,255,255,0.12)',
    tag: 'rgba(108,99,255,0.25)',
    tagBorder: 'rgba(108,99,255,0.5)',
    tagText: '#a78bfa',
  },
  purple: {
    label: 'Morado',
    bg: 'linear-gradient(135deg, #6c63ff 0%, #a855f7 60%, #ec4899 100%)',
    accent: '#ffffff',
    text: '#ffffff',
    sub: 'rgba(255,255,255,0.8)',
    card: 'rgba(255,255,255,0.2)',
    cardBorder: 'rgba(255,255,255,0.3)',
    tag: 'rgba(255,255,255,0.2)',
    tagBorder: 'rgba(255,255,255,0.4)',
    tagText: '#ffffff',
  },
  light: {
    label: 'Claro',
    bg: '#f0f4ff',
    accent: '#6c63ff',
    text: '#1a1a2e',
    sub: '#555',
    card: '#ffffff',
    cardBorder: '#e8e8ff',
    tag: '#ede9fe',
    tagBorder: '#c4b5fd',
    tagText: '#6c63ff',
  },
  blue: {
    label: 'Azul Noche',
    bg: 'linear-gradient(160deg, #0A0E45 0%, #0d0d2b 100%)',
    accent: '#a78bfa',
    text: '#ffffff',
    sub: 'rgba(255,255,255,0.65)',
    card: 'rgba(255,255,255,0.08)',
    cardBorder: 'rgba(255,255,255,0.12)',
    tag: 'rgba(108,99,255,0.25)',
    tagBorder: 'rgba(108,99,255,0.5)',
    tagText: '#a78bfa',
  },
  green: {
    label: 'Verde',
    bg: 'linear-gradient(135deg, #064e3b 0%, #065f46 100%)',
    accent: '#34d399',
    text: '#ffffff',
    sub: 'rgba(255,255,255,0.75)',
    card: 'rgba(255,255,255,0.1)',
    cardBorder: 'rgba(52,211,153,0.3)',
    tag: 'rgba(52,211,153,0.2)',
    tagBorder: 'rgba(52,211,153,0.5)',
    tagText: '#6ee7b7',
  },
  orange: {
    label: 'Naranja',
    bg: 'linear-gradient(135deg, #7c2d12 0%, #431407 100%)',
    accent: '#fb923c',
    text: '#ffffff',
    sub: 'rgba(255,255,255,0.75)',
    card: 'rgba(255,255,255,0.1)',
    cardBorder: 'rgba(251,146,60,0.3)',
    tag: 'rgba(251,146,60,0.2)',
    tagBorder: 'rgba(251,146,60,0.5)',
    tagText: '#fdba74',
  },
};

// ─── LAYOUTS ──────────────────────────────────────────────────────────────────
const LAYOUTS = [
  { id: 'title', label: 'Título', icon: '🎯' },
  { id: 'content', label: 'Contenido', icon: '📝' },
  { id: 'image-right', label: 'Imagen derecha', icon: '🖼️' },
  { id: 'image-left', label: 'Imagen izquierda', icon: '🖼️' },
  { id: 'two-col', label: 'Dos columnas', icon: '⬛⬛' },
  { id: 'cta', label: 'Llamada a acción', icon: '📢' },
  { id: 'map', label: 'Mapa conceptual', icon: '🗺️' },
  { id: 'game', label: 'Juego / Recurso', icon: '🎮' },
  { id: 'video', label: 'Vídeo', icon: '▶️' },
  { id: 'free', label: 'Libre (arrastrar)', icon: '✋' },
];

const SLIDE_DEFAULTS = {
  title: { heading: 'Título de la diapositiva', subheading: 'Subtítulo o descripción breve', body: '', tags: [], imageBase64: null, mapNodes: [], resourceId: null },
  content: { heading: 'Título', subheading: '', body: '• Punto clave uno\n• Punto clave dos\n• Punto clave tres', tags: [], imageBase64: null, mapNodes: [], resourceId: null },
  'image-right': { heading: 'Título', subheading: '', body: 'Descripción del contenido junto a la imagen.', tags: [], imageBase64: null, mapNodes: [], resourceId: null },
  'image-left': { heading: 'Título', subheading: '', body: 'Descripción del contenido junto a la imagen.', tags: [], imageBase64: null, mapNodes: [], resourceId: null },
  'two-col': { heading: 'Título', subheading: '', body: '• Columna izquierda 1\n• Columna izquierda 2', col2: '• Columna derecha 1\n• Columna derecha 2', tags: [], imageBase64: null, mapNodes: [], resourceId: null },
  cta: { heading: 'Título llamada a acción', subheading: 'Subtítulo o mensaje secundario', body: '', tags: ['Gratis', 'Sin registro', 'Para todos'], imageBase64: null, mapNodes: [], resourceId: null },
  game: { heading: '', subheading: 'Pulsa "Jugar" para comenzar', body: '', tags: [], imageBase64: null, mapNodes: [], resourceId: null, resourceTitle: '', resourceType: '', resourceTipo: '' },
  video: { heading: '', subheading: '', body: '', videoUrl: '', videoCaption: '', tags: [], imageBase64: null, mapNodes: [], resourceId: null },
  map: { heading: 'Mapa Conceptual', subheading: '', body: '', tags: [], imageBase64: null, mapNodes: [{ id: 1, text: 'Concepto central', x: 50, y: 50, isCenter: true }, { id: 2, text: 'Idea 1', x: 20, y: 20 }, { id: 3, text: 'Idea 2', x: 80, y: 20 }, { id: 4, text: 'Idea 3', x: 20, y: 80 }, { id: 5, text: 'Idea 4', x: 80, y: 80 }] },
  free: { elements: [] },
};

// ─── MIGRATE LAYOUT→ELEMENTS (for "Convert to free") ────────────────────────
function migrateToElements(slide) {
  const layout = slide.layout || 'title';
  const els = [];
  let n = 0;
  const mk = (type, x, y, w, h, extra = {}) => ({ id: `el_${++n}`, type, x, y, w, h, ...extra });
  switch (layout) {
    case 'title':
      if (slide.heading)     els.push(mk('text',  5, 18, 90, 24, { text: slide.heading,    textStyle: 'heading', textAlign: 'center' }));
      if (slide.subheading)  els.push(mk('text', 10, 46, 80, 12, { text: slide.subheading, textStyle: 'sub',     textAlign: 'center' }));
      if (slide.imageBase64) els.push(mk('image', 30, 62, 40, 28, { src: slide.imageBase64 }));
      break;
    case 'content':
      if (slide.heading) els.push(mk('text', 5,  4, 90, 14, { text: slide.heading, textStyle: 'heading' }));
      if (slide.body)    els.push(mk('text', 5, 22, 90, 68, { text: slide.body,    textStyle: 'body' }));
      break;
    case 'image-right':
      if (slide.heading)     els.push(mk('text',  4,  4, 52, 15, { text: slide.heading,    textStyle: 'heading' }));
      if (slide.body)        els.push(mk('text',  4, 22, 52, 68, { text: slide.body,        textStyle: 'body'    }));
      if (slide.imageBase64) els.push(mk('image', 58,  4, 38, 88, { src: slide.imageBase64 }));
      break;
    case 'image-left':
      if (slide.imageBase64) els.push(mk('image',  4,  4, 38, 88, { src: slide.imageBase64 }));
      if (slide.heading)     els.push(mk('text',  44,  4, 52, 15, { text: slide.heading,    textStyle: 'heading' }));
      if (slide.body)        els.push(mk('text',  44, 22, 52, 68, { text: slide.body,        textStyle: 'body'    }));
      break;
    case 'two-col':
      if (slide.heading) els.push(mk('text',  4,  4, 92, 14, { text: slide.heading, textStyle: 'heading' }));
      if (slide.body)    els.push(mk('text',  4, 22, 44, 72, { text: slide.body,    textStyle: 'body' }));
      if (slide.col2)    els.push(mk('text', 52, 22, 44, 72, { text: slide.col2,    textStyle: 'body' }));
      break;
    case 'cta':
      if (slide.heading)    els.push(mk('text',  5, 18, 90, 24, { text: slide.heading,    textStyle: 'heading', textAlign: 'center' }));
      if (slide.subheading) els.push(mk('text', 10, 46, 80, 12, { text: slide.subheading, textStyle: 'sub',     textAlign: 'center' }));
      if (slide.body)       els.push(mk('text', 30, 62, 40, 12, { text: slide.body,        textStyle: 'cta',     textAlign: 'center' }));
      break;
    default:
      if (slide.heading) els.push(mk('text', 5,  4, 90, 14, { text: slide.heading, textStyle: 'heading' }));
      if (slide.body)    els.push(mk('text', 5, 22, 90, 68, { text: slide.body,    textStyle: 'body' }));
  }
  return els;
}

function newSlide(layout = 'title', theme = 'dark') {
  const duration = (layout === 'game' || layout === 'video') ? 600000 : 5000;
  return { id: Date.now(), layout, theme, duration, ...JSON.parse(JSON.stringify(SLIDE_DEFAULTS[layout] || SLIDE_DEFAULTS.title)) };
}

// ─── SLIDE PREVIEW (thumbnail) ────────────────────────────────────────────────
function SlideThumb({ slide, isActive, onClick, index, onDelete }) {
  const t = THEMES[slide.theme] || THEMES.dark;
  return (
    <div onClick={onClick} style={{ position: 'relative', cursor: 'pointer', marginBottom: 8 }}>
      <div style={{
        background: t.bg, borderRadius: 8, padding: '8px 10px', height: 72,
        border: isActive ? `2px solid ${t.accent}` : '2px solid transparent',
        overflow: 'hidden', transition: 'border 0.2s',
        display: 'flex', flexDirection: 'column', justifyContent: 'center',
        boxShadow: isActive ? `0 0 0 2px ${t.accent}33` : '0 1px 4px rgba(0,0,0,0.3)',
      }}>
        {slide.layout === 'game'
          ? <>
              <div style={{ fontSize: 14, textAlign: 'center', marginBottom: 2 }}>🎮</div>
              <div style={{ fontSize: 8, fontWeight: 800, color: t.text, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', textAlign: 'center' }}>{slide.resourceTitle || 'Sin juego'}</div>
              <div style={{ fontSize: 6, color: t.accent, marginTop: 2, textTransform: 'uppercase', letterSpacing: 1, textAlign: 'center' }}>{TIPO_LABELS[slide.resourceType] || 'Juego'}</div>
            </>
          : slide.layout === 'video'
          ? (() => {
              const parsed = parseVideoUrl(slide.videoUrl);
              return <>
                {parsed?.thumb
                  ? <div style={{ width: '100%', height: 36, backgroundImage: `url(${parsed.thumb})`, backgroundSize: 'cover', backgroundPosition: 'center', borderRadius: 4, marginBottom: 2, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <span style={{ fontSize: 14, filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.8))' }}>▶</span>
                    </div>
                  : <div style={{ fontSize: 14, textAlign: 'center', marginBottom: 2 }}>▶️</div>
                }
                <div style={{ fontSize: 7, fontWeight: 700, color: t.text, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', textAlign: 'center' }}>{slide.heading || (parsed ? (parsed.type === 'youtube' ? 'YouTube' : parsed.type === 'vimeo' ? 'Vimeo' : 'Vídeo') : 'Sin vídeo')}</div>
              </>;
            })()
          : <>
              <div style={{ fontSize: 9, fontWeight: 800, color: t.text, lineClamp: 1, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{slide.heading || 'Sin título'}</div>
              {slide.subheading && <div style={{ fontSize: 7, color: t.sub, marginTop: 2, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{slide.subheading}</div>}
              <div style={{ fontSize: 6, color: t.accent, marginTop: 4, textTransform: 'uppercase', letterSpacing: 1 }}>{LAYOUTS.find(l => l.id === slide.layout)?.icon} {slide.layout}</div>
            </>
        }
      </div>
      <div style={{ position: 'absolute', top: 2, left: 6, fontSize: 8, color: '#888', fontWeight: 700 }}>{index + 1}</div>
      <button onClick={e => { e.stopPropagation(); onDelete(); }} style={{
        position: 'absolute', top: 2, right: 4, background: 'rgba(239,68,68,0.8)', color: 'white',
        border: 'none', borderRadius: 4, width: 16, height: 16, fontSize: 9, cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1,
      }}>✕</button>
    </div>
  );
}

// ─── RESOURCE PICKER MODAL ────────────────────────────────────────────────────
function ResourcePickerModal({ usuario, onSelect, onClose }) {
  const [recursos, setRecursos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!usuario) return;
    getDocs(query(
      collection(db, 'resources'),
      where('profesorUid', '==', usuario.uid)
    )).then(snap => {
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      docs.sort((a, b) => (a.titulo || '').localeCompare(b.titulo || ''));
      setRecursos(docs);
      setLoading(false);
    }).catch(e => { console.error('Error cargando recursos:', e); setLoading(false); });
  }, [usuario]);

  const filtered = recursos.filter(r =>
    (r.titulo || '').toLowerCase().includes(search.toLowerCase()) ||
    (r.tipoJuego || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 }}>
      <div style={{ background: '#1f2937', borderRadius: 20, padding: 28, width: '90%', maxWidth: 560, maxHeight: '80vh', display: 'flex', flexDirection: 'column', gap: 16, border: '1px solid #374151' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 900, color: '#fff' }}>🎮 Seleccionar juego o recurso</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#9ca3af', fontSize: 20, cursor: 'pointer' }}>✕</button>
        </div>
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Buscar por título o tipo..."
          style={{ background: '#111827', border: '2px solid #374151', borderRadius: 10, padding: '9px 14px', color: '#fff', fontSize: 14, outline: 'none' }}
          autoFocus
        />
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {loading && <div style={{ color: '#9ca3af', textAlign: 'center', padding: 24 }}>⏳ Cargando recursos…</div>}
          {!loading && filtered.length === 0 && <div style={{ color: '#9ca3af', textAlign: 'center', padding: 24 }}>No hay recursos que coincidan</div>}
          {filtered.map(r => {
            const icon = TIPO_ICONS[r.tipoJuego] || '🎮';
            const label = TIPO_LABELS[r.tipoJuego] || r.tipoJuego || '?';
            return (
              <button key={r.id} onClick={() => onSelect(r)} style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px',
                background: '#111827', border: '1px solid #374151', borderRadius: 10,
                cursor: 'pointer', textAlign: 'left', transition: 'border-color 0.15s',
              }}
                onMouseEnter={e => e.currentTarget.style.borderColor = '#6c63ff'}
                onMouseLeave={e => e.currentTarget.style.borderColor = '#374151'}
              >
                <span style={{ fontSize: 22, flexShrink: 0 }}>{icon}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, color: '#fff', fontSize: 14, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{r.titulo || 'Sin título'}</div>
                  <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>{label} · {r.tipo || ''}</div>
                </div>
                <span style={{ fontSize: 11, color: '#6c63ff', fontWeight: 700, flexShrink: 0 }}>Seleccionar →</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── GAME SLIDE PREVIEW (in editor) ──────────────────────────────────────────
function GameSlidePreview({ slide, t, onOpenPicker, onClear }) {
  const icon = TIPO_ICONS[slide.resourceType] || '🎮';
  const label = TIPO_LABELS[slide.resourceType] || 'Juego';

  if (!slide.resourceId) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 14 }}>
        <div style={{ fontSize: 48 }}>🎮</div>
        <div style={{ color: t.text, fontWeight: 700, fontSize: 16 }}>Diapositiva de juego interactivo</div>
        <div style={{ color: t.sub, fontSize: 13, textAlign: 'center', maxWidth: 320 }}>Selecciona uno de tus recursos para que los alumnos puedan jugar directamente desde la presentación.</div>
        <button onClick={onOpenPicker} style={{ background: t.accent, color: '#fff', border: 'none', borderRadius: 12, padding: '10px 24px', cursor: 'pointer', fontWeight: 800, fontSize: 14 }}>
          + Seleccionar recurso
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 16, padding: 24 }}>
      <div style={{ background: t.card, border: `2px solid ${t.cardBorder}`, borderRadius: 20, padding: '24px 32px', textAlign: 'center', maxWidth: 400, width: '100%' }}>
        <div style={{ fontSize: 40, marginBottom: 10 }}>{icon}</div>
        <div style={{ color: t.text, fontWeight: 900, fontSize: 18, marginBottom: 4 }}>{slide.resourceTitle || 'Recurso'}</div>
        <div style={{ color: t.tagText, background: t.tag, border: `1px solid ${t.tagBorder}`, borderRadius: 20, padding: '3px 12px', display: 'inline-block', fontSize: 12, fontWeight: 700, marginBottom: 12 }}>{label}</div>
        <div style={{ color: t.sub, fontSize: 12, marginBottom: 16 }}>Los alumnos verán un botón para jugar en pantalla completa</div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
          <button onClick={onOpenPicker} style={{ background: t.tag, color: t.tagText, border: `1px solid ${t.tagBorder}`, borderRadius: 10, padding: '6px 14px', cursor: 'pointer', fontWeight: 700, fontSize: 12 }}>Cambiar</button>
          <button onClick={onClear} style={{ background: 'rgba(239,68,68,0.2)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 10, padding: '6px 14px', cursor: 'pointer', fontWeight: 700, fontSize: 12 }}>Quitar</button>
        </div>
      </div>
      <div style={{ color: t.sub, fontSize: 11, display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ background: '#10b981', borderRadius: '50%', width: 8, height: 8, display: 'inline-block' }} />
        Vista previa del editor — el juego se activará en la presentación
      </div>
    </div>
  );
}

// ─── 3D SHAPE VIEWER ─────────────────────────────────────────────────────────
const GEO_MAP_3D = {
  prisma:   () => new THREE.BoxGeometry(3, 3, 3),
  pyramid:  () => new THREE.ConeGeometry(2, 3, 4),
  cylinder: () => new THREE.CylinderGeometry(1.5, 1.5, 4, 32),
  cone:     () => new THREE.ConeGeometry(2, 4, 32),
  sphere:   () => new THREE.SphereGeometry(2, 32, 16),
};
const LABEL_3D = { prisma:'Cubo/Prisma', pyramid:'Pirámide', cylinder:'Cilindro', cone:'Cono', sphere:'Esfera' };

function Visor3DModal({ shape, onClose, onInsert }) {
  const containerRef = useRef(null);
  const materialRef  = useRef(null);
  const rendererRef  = useRef(null);
  const sceneRef     = useRef(null);
  const cameraRef    = useRef(null);
  const [colorFig, setColorFig] = useState('#3498db');

  useEffect(() => { if (materialRef.current) materialRef.current.color.set(colorFig); }, [colorFig]);

  useEffect(() => {
    const el = containerRef.current; if (!el) return;
    const W = el.clientWidth || 360, H = 220;
    const scene = new THREE.Scene(); scene.background = new THREE.Color(0x1e293b); sceneRef.current = scene;
    const camera = new THREE.PerspectiveCamera(50, W/H, 0.1, 2000); cameraRef.current = camera;
    const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    renderer.setSize(W, H); renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    el.appendChild(renderer.domElement); rendererRef.current = renderer;
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true; controls.dampingFactor = 0.08;
    scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    const dl = new THREE.DirectionalLight(0xffffff, 0.9); dl.position.set(10, 20, 10); scene.add(dl);
    const dl2 = new THREE.DirectionalLight(0x88aaff, 0.3); dl2.position.set(-10, -5, -10); scene.add(dl2);
    const geo = GEO_MAP_3D[shape]();
    const mat = new THREE.MeshStandardMaterial({ color: colorFig, roughness: 0.4, metalness: 0.05 });
    materialRef.current = mat;
    const mesh = new THREE.Mesh(geo, mat);
    mesh.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo), new THREE.LineBasicMaterial({ color: 0x111111, transparent: true, opacity: 0.3 })));
    scene.add(mesh);
    const box3 = new THREE.Box3().setFromObject(mesh);
    const center = box3.getCenter(new THREE.Vector3());
    const maxDim = Math.max(...box3.getSize(new THREE.Vector3()).toArray());
    const grid = new THREE.GridHelper(maxDim * 4, 10, 0x444444, 0x333333);
    grid.position.y = box3.min.y - 0.01; scene.add(grid);
    const dist = maxDim * 2.5;
    camera.position.set(center.x + dist*0.7, center.y + dist*0.6, center.z + dist*0.7);
    controls.target.copy(center); controls.update();
    let animId;
    const animate = () => { animId = requestAnimationFrame(animate); controls.update(); renderer.render(scene, camera); };
    animate();
    const onResize = () => { const nW = el.clientWidth; renderer.setSize(nW, H); camera.aspect = nW/H; camera.updateProjectionMatrix(); };
    window.addEventListener('resize', onResize);
    return () => { cancelAnimationFrame(animId); window.removeEventListener('resize', onResize); controls.dispose(); renderer.dispose(); if (el.contains(renderer.domElement)) el.removeChild(renderer.domElement); };
  }, [shape]); // eslint-disable-line

  const pegar = () => {
    const r = rendererRef.current, s = sceneRef.current, c = cameraRef.current;
    if (!r || !s || !c) return;
    r.render(s, c);
    onInsert(r.domElement.toDataURL('image/png'));
  };

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:3000 }}>
      <div style={{ background:'#1e293b', borderRadius:16, overflow:'hidden', width:'90%', maxWidth:420, boxShadow:'0 8px 40px rgba(0,0,0,0.6)' }}>
        <div style={{ padding:'10px 14px', background:'#0f172a', color:'#fff', fontWeight:800, fontSize:14, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <span>📦 {LABEL_3D[shape]} · arrastra para rotar</span>
          <button onClick={onClose} style={{ background:'none', border:'none', color:'#f87171', cursor:'pointer', fontSize:18 }}>✕</button>
        </div>
        <div style={{ padding:'8px 12px', background:'#1e293b', display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
          <span style={{ color:'#94a3b8', fontSize:12 }}>Color:</span>
          <input type="color" value={colorFig} onChange={e => setColorFig(e.target.value)} style={{ border:'none', background:'transparent', width:28, height:28, cursor:'pointer', padding:0 }} />
          {['#3498db','#e74c3c','#2ecc71','#f1c40f','#9b59b6','#e67e22','#1abc9c','#ffffff'].map(c => (
            <button key={c} onClick={() => setColorFig(c)} style={{ width:18, height:18, borderRadius:'50%', background:c, border: colorFig===c ? '2px solid #fff' : '2px solid #475569', cursor:'pointer', padding:0, flexShrink:0 }} />
          ))}
        </div>
        <div ref={containerRef} style={{ width:'100%', height:220, cursor:'grab' }} />
        <button onClick={pegar} style={{ width:'100%', padding:10, background:'#2563eb', color:'#fff', border:'none', fontWeight:800, fontSize:13, cursor:'pointer' }}>
          📌 Pegar en diapositiva
        </button>
      </div>
    </div>
  );
}

// ─── MUSIC DRAWING HELPERS (adapted from GestionAula) ────────────────────────
const STAFF_LS = 13;
const drawStaff = (ctx, item) => {
  const ls = item.ls || STAFF_LS;
  ctx.save(); ctx.strokeStyle = '#111'; ctx.lineWidth = 1.5;
  for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.moveTo(item.x, item.y + i*ls); ctx.lineTo(item.x + item.w, item.y + i*ls); ctx.stroke(); }
  ctx.beginPath(); ctx.moveTo(item.x, item.y); ctx.lineTo(item.x, item.y + 4*ls); ctx.stroke();
  const clefChar = item.clef === 'fa' ? '𝄢' : '𝄞';
  const clefSize = item.clef === 'fa' ? ls*3.2 : ls*4.8;
  const clefY    = item.clef === 'fa' ? item.y + ls*1.8 : item.y + ls*3.6;
  ctx.fillStyle = '#111'; ctx.font = `${clefSize}px serif`; ctx.textBaseline = 'alphabetic';
  ctx.fillText(clefChar, item.x + 5, clefY); ctx.restore();
};
const drawNote = (ctx, item) => {
  const ls = item.ls || STAFF_LS;
  const rx = ls*0.65, ry = ls*0.44;
  const { x, y, figura, color: nc = '#111', stemUp = true } = item;
  const sxOff = stemUp ? rx-1 : -rx+1;
  const stemEndY = y + (stemUp ? -ls*3.5 : ls*3.5);
  ctx.save(); ctx.strokeStyle = nc; ctx.fillStyle = nc; ctx.lineWidth = 1.5;
  const head = (filled) => { ctx.beginPath(); ctx.ellipse(x, y, rx, ry, -0.25, 0, Math.PI*2); if (filled) { ctx.fill(); } else { ctx.fillStyle='white'; ctx.fill(); ctx.strokeStyle=nc; ctx.stroke(); ctx.fillStyle=nc; } };
  const stem = () => { ctx.beginPath(); ctx.moveTo(x+sxOff, y); ctx.lineTo(x+sxOff, stemEndY); ctx.strokeStyle=nc; ctx.stroke(); };
  const flag = (n) => { for (let f=0; f<n; f++) { const fy = stemEndY + f*ls*0.8*(stemUp?1:-1); ctx.beginPath(); ctx.moveTo(x+sxOff, fy); if (stemUp) ctx.bezierCurveTo(x+sxOff+ls*1.8, fy+ls*0.8, x+sxOff+ls*1.4, fy+ls*1.7, x+sxOff+ls*0.2, fy+ls*2.2); else ctx.bezierCurveTo(x+sxOff+ls*1.8, fy-ls*0.8, x+sxOff+ls*1.4, fy-ls*1.7, x+sxOff+ls*0.2, fy-ls*2.2); ctx.strokeStyle=nc; ctx.stroke(); } };
  if (figura==='redonda')     { head(false); }
  if (figura==='blanca')      { head(false); stem(); }
  if (figura==='negra')       { head(true);  stem(); }
  if (figura==='corchea')     { head(true);  stem(); flag(1); }
  if (figura==='semicorchea') { head(true);  stem(); flag(2); }
  if (figura==='fusa')        { head(true);  stem(); flag(3); }
  ctx.restore();
};
const drawRest = (ctx, item) => {
  const ls = item.ls || STAFF_LS;
  const { x, y, figura, color: c = '#111' } = item;
  ctx.save(); ctx.strokeStyle=c; ctx.fillStyle=c; ctx.lineWidth=1.5;
  if (figura==='s_redonda') { ctx.fillRect(x-ls, y, ls*2, ls*0.55); }
  else if (figura==='s_blanca') { ctx.fillRect(x-ls, y-ls*0.55, ls*2, ls*0.55); }
  else if (figura==='s_negra') { ctx.beginPath(); ctx.moveTo(x+ls*0.4, y-ls*1.2); ctx.lineTo(x-ls*0.5, y-ls*0.2); ctx.lineTo(x+ls*0.4, y+ls*0.2); ctx.lineTo(x-ls*0.4, y+ls*1.2); ctx.stroke(); }
  else if (figura==='s_corchea') { ctx.beginPath(); ctx.moveTo(x+ls*0.5, y-ls*0.8); ctx.lineTo(x-ls*0.4, y+ls*0.8); ctx.stroke(); ctx.beginPath(); ctx.arc(x+ls*0.5, y-ls*0.5, ls*0.35, 0, Math.PI*2); ctx.fill(); }
  ctx.restore();
};
const drawAccidental = (ctx, item) => {
  const ls = item.ls || STAFF_LS;
  const sym = item.figura==='sharp' ? '♯' : item.figura==='flat' ? '♭' : '♮';
  ctx.save(); ctx.font=`bold ${ls*1.7}px serif`; ctx.fillStyle=item.color||'#111'; ctx.textBaseline='middle'; ctx.textAlign='center'; ctx.fillText(sym, item.x, item.y); ctx.restore();
};

// ─── MUSIC PANEL MODAL ───────────────────────────────────────────────────────
const MUSIC_NOTES = [
  { id:'redonda', sym:'𝅝', label:'Redonda' }, { id:'blanca', sym:'𝅗𝅥', label:'Blanca' },
  { id:'negra', sym:'♩', label:'Negra' }, { id:'corchea', sym:'♪', label:'Corchea' },
  { id:'semicorchea', sym:'♬', label:'Semicorchea' }, { id:'fusa', sym:'♫♫', label:'Fusa' },
];
const MUSIC_RESTS = [
  { id:'s_redonda', sym:'▬', label:'Sil. Redonda' }, { id:'s_blanca', sym:'▭', label:'Sil. Blanca' },
  { id:'s_negra', sym:'𝄽', label:'Sil. Negra' }, { id:'s_corchea', sym:'𝄾', label:'Sil. Corchea' },
];
const MUSIC_ACCS = [
  { id:'sharp', sym:'♯', label:'Sostenido' }, { id:'flat', sym:'♭', label:'Bemol' }, { id:'natural', sym:'♮', label:'Natural' },
];
const CNVS_W = 820, CNVS_H = 200;

function MusicPanel({ onInsert, onClose }) {
  const [items, setItems] = useState([]);
  const [cursorX, setCursorX] = useState(80);
  const [staffY, setStaffY] = useState(80);
  const [hasStaff, setHasStaff] = useState(false);
  const canvasRef = useRef(null);

  const redraw = (its) => {
    const cv = canvasRef.current; if (!cv) return;
    const ctx = cv.getContext('2d');
    ctx.clearRect(0, 0, CNVS_W, CNVS_H);
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, CNVS_W, CNVS_H);
    its.forEach(item => {
      if (item.t === 'staff') drawStaff(ctx, item);
      else if (item.t === 'note') drawNote(ctx, item);
      else if (item.t === 'rest') drawRest(ctx, item);
      else if (item.t === 'acc') drawAccidental(ctx, item);
    });
  };
  useEffect(() => { redraw(items); }, [items]); // eslint-disable-line

  const addStaff = (clef) => {
    const sy = staffY;
    const newItems = [...items, { t:'staff', x:30, y:sy, w:CNVS_W-60, ls:STAFF_LS, clef }];
    setItems(newItems); setHasStaff(true); setCursorX(80);
  };
  const addNote = (figura) => {
    if (!hasStaff) { alert('Primero añade un pentagrama'); return; }
    const noteY = staffY + STAFF_LS * 1.5;
    setItems(prev => { const n = [...prev, { t:'note', figura, x:cursorX, y:noteY, ls:STAFF_LS, color:'#111', stemUp:true }]; return n; });
    setCursorX(c => Math.min(c + 44, CNVS_W - 60));
  };
  const addRest = (figura) => {
    if (!hasStaff) { alert('Primero añade un pentagrama'); return; }
    const restY = staffY + STAFF_LS * 1;
    setItems(prev => [...prev, { t:'rest', figura, x:cursorX, y:restY, ls:STAFF_LS, color:'#111' }]);
    setCursorX(c => Math.min(c + 44, CNVS_W - 60));
  };
  const addAcc = (figura) => {
    if (!hasStaff) { alert('Primero añade un pentagrama'); return; }
    const accY = staffY + STAFF_LS * 1.5;
    setItems(prev => [...prev, { t:'acc', figura, x:cursorX - 20, y:accY, ls:STAFF_LS, color:'#111' }]);
  };
  const undo = () => setItems(prev => { const n = [...prev]; n.pop(); if (n.length === 0) { setHasStaff(false); setCursorX(80); } else if (!n.some(i => i.t === 'staff')) setHasStaff(false); return n; });
  const clear = () => { setItems([]); setHasStaff(false); setCursorX(80); };

  const handleInsert = () => {
    const cv = document.createElement('canvas');
    cv.width = CNVS_W; cv.height = CNVS_H;
    redraw_to(cv, items);
    onInsert(cv.toDataURL('image/png'));
  };
  const redraw_to = (cv, its) => {
    const ctx = cv.getContext('2d');
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, cv.width, cv.height);
    its.forEach(item => {
      if (item.t === 'staff') drawStaff(ctx, item);
      else if (item.t === 'note') drawNote(ctx, item);
      else if (item.t === 'rest') drawRest(ctx, item);
      else if (item.t === 'acc') drawAccidental(ctx, item);
    });
  };

  const MB = (label, onClick, bg = '#374151', color = '#e5e7eb') => (
    <button onClick={onClick} style={{ background:bg, color, border:'none', borderRadius:6, padding:'4px 8px', cursor:'pointer', fontSize:11, fontWeight:700, whiteSpace:'nowrap' }}>{label}</button>
  );

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.75)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:3000 }}>
      <div style={{ background:'#1f2937', borderRadius:16, padding:20, width:'95vw', maxWidth:680, maxHeight:'90vh', overflowY:'auto', border:'1px solid #374151' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
          <h3 style={{ margin:0, color:'#fff', fontSize:16, fontWeight:900 }}>🎵 Pentagrama Musical</h3>
          <button onClick={onClose} style={{ background:'none', border:'none', color:'#9ca3af', fontSize:20, cursor:'pointer' }}>✕</button>
        </div>

        {/* Pentagrama */}
        <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:10 }}>
          <span style={{ fontSize:11, color:'#9ca3af', alignSelf:'center', fontWeight:700 }}>Pentagrama:</span>
          {MB('𝄞 Clave Sol', () => addStaff('sol'), '#1d4ed8', '#fff')}
          {MB('𝄢 Clave Fa',  () => addStaff('fa'),  '#1d4ed8', '#fff')}
          {MB('↩ Deshacer', undo, '#374151', '#9ca3af')}
          {MB('🗑 Limpiar',  clear, 'rgba(239,68,68,0.2)', '#f87171')}
        </div>

        {/* Notes */}
        <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:6 }}>
          <span style={{ fontSize:11, color:'#9ca3af', alignSelf:'center', fontWeight:700 }}>Notas:</span>
          {MUSIC_NOTES.map(n => MB(`${n.sym} ${n.label}`, () => addNote(n.id)))}
        </div>
        {/* Rests */}
        <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:6 }}>
          <span style={{ fontSize:11, color:'#9ca3af', alignSelf:'center', fontWeight:700 }}>Silencios:</span>
          {MUSIC_RESTS.map(r => MB(`${r.sym} ${r.label}`, () => addRest(r.id)))}
        </div>
        {/* Accidentals */}
        <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:12 }}>
          <span style={{ fontSize:11, color:'#9ca3af', alignSelf:'center', fontWeight:700 }}>Accidentales:</span>
          {MUSIC_ACCS.map(a => MB(`${a.sym} ${a.label}`, () => addAcc(a.id)))}
        </div>

        {/* Canvas preview */}
        <div style={{ background:'#fff', borderRadius:8, overflow:'hidden', marginBottom:12 }}>
          <canvas ref={canvasRef} width={CNVS_W} height={CNVS_H} style={{ width:'100%', height:'auto', display:'block' }} />
        </div>

        <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
          <button onClick={onClose} style={{ background:'#374151', color:'#9ca3af', border:'none', borderRadius:10, padding:'9px 20px', cursor:'pointer', fontWeight:700 }}>Cancelar</button>
          <button onClick={handleInsert} disabled={items.length === 0} style={{ background: items.length === 0 ? '#374151' : '#6c63ff', color:'#fff', border:'none', borderRadius:10, padding:'9px 24px', cursor: items.length === 0 ? 'not-allowed' : 'pointer', fontWeight:700 }}>
            📌 Insertar en diapositiva
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── GEO PANEL MODAL ─────────────────────────────────────────────────────────
const ESP_GEOJSON_URL = 'https://raw.githubusercontent.com/codeforamerica/click_that_hood/master/public/data/spain-provinces.geojson';
const ESP_LON_MIN = -9.5, ESP_LON_MAX = 4.6, ESP_LAT_MIN = 35.7, ESP_LAT_MAX = 43.9;

const ESP_RIOS_DATA = [
  { nombre:'Ebro', pts:[[-3.85,42.90],[-1.80,41.70],[0.87,40.73]] },
  { nombre:'Duero', pts:[[-2.50,41.77],[-5.20,41.60],[-8.67,41.13]] },
  { nombre:'Tajo', pts:[[-1.80,40.45],[-4.50,39.90],[-7.20,39.60],[-8.85,38.70]] },
  { nombre:'Guadiana', pts:[[-2.90,38.90],[-5.80,38.70],[-7.00,38.85],[-7.40,37.20]] },
  { nombre:'Guadalquivir', pts:[[-2.77,37.80],[-4.60,37.60],[-6.35,37.00]] },
  { nombre:'Miño', pts:[[-7.50,42.97],[-8.00,41.90],[-8.67,41.88]] },
];
const ESP_MONTANAS_DATA = [
  { nombre:'Pirineos', lon:0.30, lat:42.60 }, { nombre:'Cord. Cantábrica', lon:-5.20, lat:43.30 },
  { nombre:'Sistema Central', lon:-5.00, lat:40.50 }, { nombre:'Sierra Nevada', lon:-3.30, lat:37.05 },
  { nombre:'Sistema Ibérico', lon:-2.00, lat:41.50 }, { nombre:'Sierra Morena', lon:-4.50, lat:38.20 },
];
const ESP_CIUDADES_DATA = [
  { nombre:'Madrid', lon:-3.70, lat:40.42, capital:true }, { nombre:'Barcelona', lon:2.17, lat:41.38 },
  { nombre:'Valencia', lon:-0.38, lat:39.47 }, { nombre:'Sevilla', lon:-5.97, lat:37.39 },
  { nombre:'Bilbao', lon:-2.93, lat:43.26 }, { nombre:'Zaragoza', lon:-0.87, lat:41.65 },
];
const CORDILLERAS_DATA = [
  'Andes','Himalaya','Alpes','Pirineos','Montañas Rocosas','Urales','Atlas','Cárpatos',
  'Sierra Nevada','Cordillera Cantábrica','Sistema Central','Apeninos','Cáucaso','Karakórum',
];
const RIOS_MUNDO_DATA = [
  'Amazonas','Nilo','Yangtsé','Misisipi','Danubio','Rin','Volga','Orinoco',
  'Ganges','Éufrates','Tigris','Mekong','Níger','Zambeze','Congo','Ebro','Tajo','Guadalquivir',
  'Támesis','Sena','Po','Tíber','Misuri','Colorado',
];

const _proyEsp2 = (lon, lat, W, H, pad=40) => {
  const cosLat = Math.cos(39.7 * Math.PI / 180);
  const lonSpan = (ESP_LON_MAX - ESP_LON_MIN) * cosLat;
  const latSpan = ESP_LAT_MAX - ESP_LAT_MIN;
  const useW = W-2*pad, useH = H-2*pad;
  const scale = Math.min(useW/lonSpan, useH/latSpan);
  const ox = pad + (useW - lonSpan*scale)/2;
  const oy = pad + (useH - latSpan*scale)/2;
  return { x: ox + (lon - ESP_LON_MIN)*cosLat*scale, y: oy + (ESP_LAT_MAX - lat)*scale };
};

async function generarMapaEspañaProvincias() {
  const W=900, H=700;
  const cv = document.createElement('canvas'); cv.width=W; cv.height=H;
  const ctx = cv.getContext('2d');
  ctx.fillStyle='#e8f4f8'; ctx.fillRect(0,0,W,H);
  const PALETTE = ['#b3d9ff','#c8e6c9','#fff9c4','#ffccbc','#e1bee7','#f0f4c3','#ffecb3'];
  try {
    const resp = await fetch(ESP_GEOJSON_URL);
    const gj = await resp.json();
    const proj = (lon, lat) => _proyEsp2(lon, lat, W, H);
    gj.features.forEach((feat, fi) => {
      const fill = PALETTE[fi % PALETTE.length];
      ctx.fillStyle = fill; ctx.strokeStyle = '#555'; ctx.lineWidth = 0.8;
      const geom = feat.geometry;
      const polys = geom.type==='Polygon' ? [geom.coordinates] : geom.coordinates;
      polys.forEach(poly => {
        ctx.beginPath();
        poly[0].forEach(([lon, lat], i) => { const {x,y} = proj(lon, lat); if(i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y); });
        ctx.closePath(); ctx.fill(); ctx.stroke();
      });
      const ring = polys[0][0];
      let sLon=0, sLat=0; ring.forEach(([lon, lat]) => { sLon+=lon; sLat+=lat; });
      const {x, y} = proj(sLon/ring.length, sLat/ring.length);
      ctx.fillStyle='#333'; ctx.font='bold 9px Inter,sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle';
      const name = feat.properties?.name || '';
      if (name.length < 12) ctx.fillText(name, x, y);
    });
  } catch(e) { ctx.fillStyle='#333'; ctx.font='14px sans-serif'; ctx.fillText('Error cargando mapa',W/2,H/2); }
  return cv.toDataURL('image/png');
}

async function generarMapaEspañaGeo() {
  const W=900, H=700;
  const cv = document.createElement('canvas'); cv.width=W; cv.height=H;
  const ctx = cv.getContext('2d');
  ctx.fillStyle='#d4e8f0'; ctx.fillRect(0,0,W,H);
  const proj = (lon, lat) => _proyEsp2(lon, lat, W, H);
  // Contorno básico de España
  ctx.fillStyle='#c8e6a0'; ctx.strokeStyle='#666'; ctx.lineWidth=1;
  ctx.beginPath();
  [[-9.3,43.7],[-1.8,43.5],[3.3,42.3],[3.1,41.0],[0.7,40.2],[0.3,37.6],[-1.9,36.7],[-5.4,36.0],[-6.2,36.9],[-9.0,38.8],[-9.2,39.5],[-8.8,42.0],[-9.3,43.7]].forEach(([lon,lat],i) => { const {x,y}=proj(lon,lat); if(i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y); });
  ctx.closePath(); ctx.fill(); ctx.stroke();
  // Ríos
  ctx.strokeStyle='#2196f3'; ctx.lineWidth=2;
  ESP_RIOS_DATA.forEach(rio => {
    ctx.beginPath();
    rio.pts.forEach(([lon,lat],i) => { const {x,y}=proj(lon,lat); if(i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y); });
    ctx.stroke();
    const mid = rio.pts[Math.floor(rio.pts.length/2)];
    const {x,y} = proj(mid[0],mid[1]);
    ctx.fillStyle='#1565c0'; ctx.font='bold 11px Inter,sans-serif'; ctx.textAlign='left'; ctx.textBaseline='bottom';
    ctx.fillText(rio.nombre, x+3, y-2);
  });
  // Montañas
  ESP_MONTANAS_DATA.forEach(m => {
    const {x,y} = proj(m.lon, m.lat);
    ctx.fillStyle='#5d4037'; ctx.font='bold 10px Inter,sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText('⛰ '+m.nombre, x, y);
  });
  // Ciudades
  ESP_CIUDADES_DATA.forEach(c => {
    const {x,y} = proj(c.lon, c.lat);
    ctx.fillStyle=c.capital?'#d32f2f':'#333';
    ctx.beginPath(); ctx.arc(x, y, c.capital?5:3, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle='#333'; ctx.font=`${c.capital?'bold ':''}10px Inter,sans-serif`; ctx.textAlign='left'; ctx.textBaseline='bottom';
    ctx.fillText(c.nombre, x+5, y);
  });
  return cv.toDataURL('image/png');
}

function GeoPanel({ onInsert, onClose }) {
  const [tab, setTab] = useState('pais');
  const [query, setQuery] = useState('');
  const [cargando, setCargando] = useState(false);
  const [paisData, setPaisData] = useState(null);

  const buscarPais = async () => {
    if (!query.trim()) return;
    setCargando(true); setPaisData(null);
    try {
      const r = await fetch(`https://restcountries.com/v3.1/name/${encodeURIComponent(query.trim())}?fields=name,flags,capital,population,area,region`);
      const data = await r.json();
      if (Array.isArray(data) && data.length) setPaisData(data[0]);
      else alert('País no encontrado. Escribe el nombre en inglés.');
    } catch { alert('Error consultando país'); }
    setCargando(false);
  };

  const insertarBandera = () => {
    if (!paisData?.flags?.png) return;
    const img = new Image(); img.crossOrigin='anonymous';
    img.onload = () => {
      const cv = document.createElement('canvas'); cv.width=img.width; cv.height=img.height;
      cv.getContext('2d').drawImage(img, 0, 0);
      try { onInsert(cv.toDataURL('image/png'), 50, 30); }
      catch { onInsert(paisData.flags.png, 50, 30); }
    };
    img.onerror = () => onInsert(paisData.flags.png, 50, 30);
    img.src = paisData.flags.png;
  };

  const insertarMapaPais = async () => {
    if (!paisData?.name?.common) return;
    const q = encodeURIComponent(`${paisData.name.common} map blank`);
    const r = await fetch(`https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrnamespace=6&gsrsearch=${q}&gsrlimit=5&prop=imageinfo&iiprop=url&iiurlwidth=600&format=json&origin=*`);
    const data = await r.json();
    const pages = Object.values(data.query?.pages||{});
    const mapImg = pages.find(p => /map|location/i.test(p.title));
    const url = (mapImg||pages[0])?.imageinfo?.[0]?.thumburl;
    if (url) onInsert(url, 60, 70);
    else alert('No se encontró mapa para este país');
  };

  const insertarInfoPais = () => {
    if (!paisData) return;
    const text = `🌍 ${paisData.name?.common || ''}\n📍 Capital: ${(paisData.capital||[])[0]||'—'}\n👥 Población: ${(paisData.population||0).toLocaleString('es-ES')}\n🗺️ Región: ${paisData.region||''}`;
    onInsert(text, 'text');
  };

  const insertarMapaEspaña = async (tipo) => {
    setCargando(true);
    try {
      const src = tipo === 'provincias' ? await generarMapaEspañaProvincias() : await generarMapaEspañaGeo();
      onInsert(src, 80, 70);
    } catch(e) { alert('Error: '+e.message); }
    setCargando(false);
  };

  const TAB_BTN = (id, label) => (
    <button onClick={() => setTab(id)} style={{ background: tab===id ? '#6c63ff' : '#374151', color:'#fff', border:'none', borderRadius:8, padding:'6px 14px', cursor:'pointer', fontWeight:700, fontSize:12 }}>{label}</button>
  );
  const BTN = (label, onClick, bg='#374151', color='#e5e7eb') => (
    <button onClick={onClick} style={{ background:bg, color, border:'none', borderRadius:8, padding:'5px 12px', cursor:'pointer', fontWeight:700, fontSize:12, whiteSpace:'nowrap' }}>{label}</button>
  );

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.75)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:3000 }}>
      <div style={{ background:'#1f2937', borderRadius:16, padding:20, width:'95vw', maxWidth:640, maxHeight:'90vh', overflowY:'auto', border:'1px solid #374151' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
          <h3 style={{ margin:0, color:'#fff', fontSize:16, fontWeight:900 }}>🌍 Panel de Geografía</h3>
          <button onClick={onClose} style={{ background:'none', border:'none', color:'#9ca3af', fontSize:20, cursor:'pointer' }}>✕</button>
        </div>
        <div style={{ display:'flex', gap:6, marginBottom:14 }}>
          {TAB_BTN('pais','🗺️ País')}
          {TAB_BTN('espana','🇪🇸 España')}
          {TAB_BTN('etiquetas','🏷️ Etiquetas')}
        </div>

        {tab === 'pais' && (
          <div>
            <div style={{ display:'flex', gap:6, marginBottom:10 }}>
              <input value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => e.key==='Enter' && buscarPais()}
                placeholder="Nombre del país en inglés (Spain, France...)"
                style={{ flex:1, background:'#111827', border:'1px solid #374151', borderRadius:8, padding:'8px 12px', color:'#fff', fontSize:13, outline:'none' }} />
              <button onClick={buscarPais} disabled={cargando} style={{ background:'#2563eb', color:'#fff', border:'none', borderRadius:8, padding:'8px 16px', cursor:'pointer', fontWeight:700 }}>
                {cargando ? '…' : '🔍'}
              </button>
            </div>
            {paisData && (
              <div style={{ background:'#111827', borderRadius:10, padding:12, display:'flex', flexDirection:'column', gap:8 }}>
                <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                  {paisData.flags?.png && <img src={paisData.flags.png} alt="" style={{ height:30, borderRadius:3 }} />}
                  <span style={{ color:'#fff', fontWeight:800, fontSize:15 }}>{paisData.name?.common}</span>
                  <span style={{ color:'#6b7280', fontSize:12 }}>{paisData.region}</span>
                </div>
                <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                  {BTN('🚩 Bandera', insertarBandera, '#1d4ed8', '#fff')}
                  {BTN('🗺️ Mapa', insertarMapaPais, '#1d4ed8', '#fff')}
                  {BTN('ℹ️ Info', insertarInfoPais, '#374151', '#e5e7eb')}
                </div>
              </div>
            )}
          </div>
        )}

        {tab === 'espana' && (
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
              {BTN(cargando ? '…' : '🗾 Mapa Provincias', () => insertarMapaEspaña('provincias'), '#92400e', '#fff')}
              {BTN(cargando ? '…' : '🌍 Mapa Geográfico', () => insertarMapaEspaña('geo'), '#065f46', '#fff')}
            </div>
            <div style={{ fontSize:11, color:'#6b7280' }}>Los mapas se generan y se insertan como imagen en la diapositiva.</div>
          </div>
        )}

        {tab === 'etiquetas' && (
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            <div>
              <div style={{ fontSize:11, fontWeight:700, color:'#9ca3af', marginBottom:6 }}>CORDILLERAS</div>
              <div style={{ display:'flex', flexWrap:'wrap', gap:5 }}>
                {CORDILLERAS_DATA.map(c => (
                  <button key={c} onClick={() => onInsert(`⛰️ ${c}`, 'text')}
                    style={{ padding:'3px 10px', borderRadius:16, border:'1px solid #78350f', background:'rgba(120,53,15,0.15)', color:'#fbbf24', cursor:'pointer', fontSize:11, fontWeight:600 }}>
                    ⛰️ {c}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <div style={{ fontSize:11, fontWeight:700, color:'#9ca3af', marginBottom:6 }}>RÍOS</div>
              <div style={{ display:'flex', flexWrap:'wrap', gap:5, maxHeight:120, overflowY:'auto' }}>
                {RIOS_MUNDO_DATA.map(r => (
                  <button key={r} onClick={() => onInsert(`🌊 ${r}`, 'text')}
                    style={{ padding:'3px 10px', borderRadius:16, border:'1px solid #1d4ed8', background:'rgba(29,78,216,0.15)', color:'#60a5fa', cursor:'pointer', fontSize:11, fontWeight:600 }}>
                    🌊 {r}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── MATH EQUATION EDITOR ────────────────────────────────────────────────────
const MATH_KEYS = [
  { cat:'Básico', keys:[
    {l:'a/b', ins:'\\frac{}{} ', cb:4}, {l:'xⁿ', ins:'^{}', cb:1}, {l:'x₂', ins:'_{}', cb:1},
    {l:'√', ins:'\\sqrt{}', cb:1}, {l:'ⁿ√', ins:'\\sqrt[n]{}', cb:3},
    {l:'(  )', ins:'\\left(\\right)', cb:7}, {l:'|x|', ins:'\\left|\\right|', cb:7},
    {l:'±', ins:'\\pm'}, {l:'×', ins:'\\times'}, {l:'÷', ins:'\\div'}, {l:'≠', ins:'\\neq'},
    {l:'≤', ins:'\\leq'}, {l:'≥', ins:'\\geq'}, {l:'∞', ins:'\\infty'},
  ]},
  { cat:'Log/Trig', keys:[
    {l:'log', ins:'\\log'}, {l:'logₙ', ins:'\\log_{}', cb:1}, {l:'ln', ins:'\\ln'},
    {l:'sin', ins:'\\sin'}, {l:'cos', ins:'\\cos'}, {l:'tan', ins:'\\tan'},
    {l:'arcsin', ins:'\\arcsin'}, {l:'arccos', ins:'\\arccos'}, {l:'arctan', ins:'\\arctan'},
    {l:'°', ins:'^{\\circ}'}, {l:'e', ins:'e'}, {l:'π', ins:'\\pi'},
  ]},
  { cat:'Griegas', keys:[
    {l:'α', ins:'\\alpha'}, {l:'β', ins:'\\beta'}, {l:'γ', ins:'\\gamma'}, {l:'δ', ins:'\\delta'},
    {l:'θ', ins:'\\theta'}, {l:'λ', ins:'\\lambda'}, {l:'μ', ins:'\\mu'}, {l:'σ', ins:'\\sigma'},
    {l:'φ', ins:'\\phi'}, {l:'ω', ins:'\\omega'}, {l:'Σ', ins:'\\Sigma'}, {l:'Δ', ins:'\\Delta'},
    {l:'Ω', ins:'\\Omega'}, {l:'Π', ins:'\\Pi'}, {l:'Γ', ins:'\\Gamma'},
  ]},
  { cat:'Integrales', keys:[
    {l:'∫', ins:'\\int'}, {l:'∫ₐᵇ', ins:'\\int_{a}^{b} ', cb:1},
    {l:'∬', ins:'\\iint'}, {l:'∑', ins:'\\sum_{i=1}^{n} ', cb:1},
    {l:'∏', ins:'\\prod_{i=1}^{n} ', cb:1},
    {l:'lim', ins:'\\lim_{x \\to } ', cb:2}, {l:'→', ins:'\\to '},
    {l:'∂', ins:'\\partial'}, {l:'∇', ins:'\\nabla'},
  ]},
  { cat:'Matrices', keys:[
    {l:'2×2', ins:'\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}'},
    {l:'3×3', ins:'\\begin{pmatrix} a & b & c \\\\ d & e & f \\\\ g & h & i \\end{pmatrix}'},
    {l:'[2×2]', ins:'\\begin{bmatrix} a & b \\\\ c & d \\end{bmatrix}'},
    {l:'Sistema', ins:'\\begin{cases} f_1 \\\\ f_2 \\end{cases}'},
    {l:'→v', ins:'\\vec{}'  , cb:1}, {l:'v̄', ins:'\\overline{}', cb:1},
    {l:'‖v‖', ins:'\\|\\|', cb:2}, {l:'·', ins:'\\cdot '},
    {l:'ā', ins:'\\bar{}', cb:1}, {l:'â', ins:'\\hat{}', cb:1},
  ]},
];

function MathEquationModal({ onInsert, onClose }) {
  const [latex, setLatex] = useState('');
  const [catIdx, setCatIdx] = useState(0);
  const [error, setError] = useState('');
  const inputRef = useRef(null);
  const previewRef = useRef(null);
  const hiddenRef = useRef(null);

  useEffect(() => {
    if (!previewRef.current) return;
    try {
      const html = katex.renderToString(latex || '\\text{(vista previa)}', { throwOnError:false, displayMode:true });
      previewRef.current.innerHTML = html;
      setError('');
    } catch(e) {
      previewRef.current.innerHTML = '';
      setError(e.message);
    }
  }, [latex]);

  const insertAt = (snippet, cursorBack = 0) => {
    const el = inputRef.current; if (!el) return;
    const s = el.selectionStart ?? latex.length;
    const e2 = el.selectionEnd ?? s;
    const newVal = latex.slice(0, s) + snippet + latex.slice(e2);
    setLatex(newVal);
    setTimeout(() => {
      const pos = s + snippet.length - (cursorBack || 0);
      el.focus(); el.setSelectionRange(pos, pos);
    }, 0);
  };

  const handleInsert = async () => {
    if (!latex.trim()) return;
    const node = hiddenRef.current; if (!node) return;
    try {
      const html = katex.renderToString(latex, { throwOnError:false, displayMode:true });
      node.innerHTML = html;
      node.style.display = 'block';
      await new Promise(r => setTimeout(r, 80));
      const canvas = await html2canvas(node, { backgroundColor:'#ffffff', scale:3, logging:false, useCORS:false });
      node.style.display = 'none';
      onInsert(canvas.toDataURL('image/png'));
    } catch(e) { alert('Error renderizando: '+e.message); }
  };

  const cat = MATH_KEYS[catIdx];

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.8)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:3000 }}>
      {/* Hidden render node */}
      <div ref={hiddenRef} style={{ position:'fixed', left:-9999, top:-9999, display:'none', background:'#fff', padding:'12px 16px', borderRadius:8, fontSize:20, color:'#111', minWidth:80 }} />

      <div style={{ background:'#1f2937', borderRadius:16, padding:20, width:'95vw', maxWidth:680, maxHeight:'90vh', overflowY:'auto', border:'1px solid #374151' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
          <h3 style={{ margin:0, color:'#fff', fontSize:16, fontWeight:900 }}>∑ Editor de Ecuaciones</h3>
          <button onClick={onClose} style={{ background:'none', border:'none', color:'#9ca3af', fontSize:20, cursor:'pointer' }}>✕</button>
        </div>

        {/* LaTeX input */}
        <textarea ref={inputRef} value={latex} onChange={e => setLatex(e.target.value)}
          placeholder="Escribe LaTeX aquí o usa los botones... ej: \frac{x^2+1}{2}"
          style={{ width:'100%', background:'#111827', border:`2px solid ${error ? '#ef4444' : '#374151'}`, borderRadius:10, padding:'10px 12px', color:'#fff', fontSize:13, fontFamily:'monospace', resize:'vertical', minHeight:60, outline:'none', boxSizing:'border-box' }}
          onKeyDown={e => e.key==='Tab' && (e.preventDefault(), insertAt('  '))}
        />
        {error && <div style={{ fontSize:11, color:'#f87171', marginTop:3 }}>{error.slice(0,80)}</div>}

        {/* Live preview */}
        <div style={{ background:'#fff', borderRadius:10, padding:'12px 16px', margin:'10px 0', minHeight:56, display:'flex', alignItems:'center', justifyContent:'center', overflowX:'auto' }}>
          <div ref={previewRef} style={{ color:'#111', fontSize:18 }} />
        </div>

        {/* Category tabs */}
        <div style={{ display:'flex', gap:4, flexWrap:'wrap', marginBottom:8 }}>
          {MATH_KEYS.map((c, i) => (
            <button key={c.cat} onClick={() => setCatIdx(i)}
              style={{ background: catIdx===i ? '#6c63ff' : '#374151', color:'#fff', border:'none', borderRadius:6, padding:'4px 10px', cursor:'pointer', fontSize:11, fontWeight:700 }}>
              {c.cat}
            </button>
          ))}
        </div>

        {/* Key buttons */}
        <div style={{ display:'flex', flexWrap:'wrap', gap:5, marginBottom:14, background:'#111827', borderRadius:10, padding:10 }}>
          {cat.keys.map((k, i) => (
            <button key={i} onClick={() => insertAt(k.ins + ' ', k.cb)}
              style={{ background:'#1f2937', color:'#e5e7eb', border:'1px solid #374151', borderRadius:6, padding:'6px 10px', cursor:'pointer', fontSize:13, fontWeight:700, fontFamily:'serif', minWidth:44 }}
              title={k.ins}>
              {k.l}
            </button>
          ))}
        </div>

        {/* Common numbers + operators quick row */}
        <div style={{ display:'flex', gap:4, flexWrap:'wrap', marginBottom:14 }}>
          {'0123456789'.split('').map(d => (
            <button key={d} onClick={() => insertAt(d)}
              style={{ background:'#374151', color:'#fff', border:'none', borderRadius:6, padding:'5px 8px', cursor:'pointer', fontSize:13, fontWeight:700, width:34 }}>{d}</button>
          ))}
          {['+','-','=','( )'].map(op => (
            <button key={op} onClick={() => insertAt(op==='( )' ? '\\left(\\right)' : op, op==='( )' ? 7 : 0)}
              style={{ background:'#374151', color:'#fff', border:'none', borderRadius:6, padding:'5px 10px', cursor:'pointer', fontSize:13, fontWeight:700 }}>{op}</button>
          ))}
          <button onClick={() => setLatex('')} style={{ background:'rgba(239,68,68,0.2)', color:'#f87171', border:'none', borderRadius:6, padding:'5px 10px', cursor:'pointer', fontSize:11, fontWeight:700 }}>🗑 Borrar</button>
        </div>

        <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
          <button onClick={onClose} style={{ background:'#374151', color:'#9ca3af', border:'none', borderRadius:10, padding:'9px 20px', cursor:'pointer', fontWeight:700 }}>Cancelar</button>
          <button onClick={handleInsert} disabled={!latex.trim()} style={{ background: latex.trim() ? 'linear-gradient(135deg,#6c63ff,#a855f7)' : '#374151', color:'#fff', border:'none', borderRadius:10, padding:'9px 24px', cursor: latex.trim() ? 'pointer' : 'not-allowed', fontWeight:700, fontSize:14 }}>
            📌 Insertar ecuación
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── FREE CANVAS (pure interaction overlay) ───────────────────────────────────
const FC_HANDLES = ['nw','n','ne','e','se','s','sw','w'];
const FC_HANDLE_POS = {
  nw:{ top:0, left:0, cursor:'nw-resize' },
  n: { top:0, left:'50%', transform:'translateX(-50%)', cursor:'n-resize' },
  ne:{ top:0, right:0, cursor:'ne-resize' },
  e: { top:'50%', right:0, transform:'translateY(-50%)', cursor:'e-resize' },
  se:{ bottom:0, right:0, cursor:'se-resize' },
  s: { bottom:0, left:'50%', transform:'translateX(-50%)', cursor:'s-resize' },
  sw:{ bottom:0, left:0, cursor:'sw-resize' },
  w: { top:'50%', left:0, transform:'translateY(-50%)', cursor:'w-resize' },
};
const FC_STICKERS = ['⭐','🔥','✅','❌','💡','🎯','👍','📌','⚠️','🏆','🌈','🎨'];
const FC_SNAP = [0, 25, 33.33, 50, 66.66, 75, 100];

// ─── IMAGE SEARCH MODAL (Wikimedia Commons) ───────────────────────────────────
function ImgSearchModal({ onAdd, onClose }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  const buscar = async () => {
    if (!query.trim()) return;
    setLoading(true);
    try {
      const res = await fetch(`https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrnamespace=6&gsrsearch=${encodeURIComponent(query)}&gsrlimit=20&prop=imageinfo&iiprop=url&iiurlwidth=300&format=json&origin=*`);
      const data = await res.json();
      const pages = data.query?.pages || {};
      const urls = Object.values(pages)
        .map(p => { const i = p.imageinfo?.[0]; return { thumb: i?.thumburl || i?.url, full: i?.url }; })
        .filter(u => u.full && /\.(jpe?g|png|gif|webp)(\?|$)/i.test(u.full));
      setResults(urls);
    } catch { alert('Error buscando imágenes.'); }
    setLoading(false);
  };

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.8)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:2000 }}>
      <div style={{ background:'#1f2937', borderRadius:20, padding:24, width:'90%', maxWidth:600, maxHeight:'80vh', display:'flex', flexDirection:'column', gap:14, border:'1px solid #374151' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <h3 style={{ margin:0, color:'#fff', fontSize:18, fontWeight:900 }}>🔍 Buscar imagen</h3>
          <button onClick={onClose} style={{ background:'none', border:'none', color:'#9ca3af', fontSize:20, cursor:'pointer' }}>✕</button>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <input value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => e.key==='Enter' && buscar()}
            placeholder="Buscar en Wikimedia Commons..." autoFocus
            style={{ flex:1, background:'#111827', border:'2px solid #374151', borderRadius:10, padding:'9px 14px', color:'#fff', fontSize:14, outline:'none' }} />
          <button onClick={buscar} disabled={loading} style={{ background:'#6c63ff', color:'#fff', border:'none', borderRadius:10, padding:'9px 18px', cursor:'pointer', fontWeight:700, fontSize:14 }}>
            {loading ? '…' : 'Buscar'}
          </button>
        </div>
        {results.length > 0 && (
          <div style={{ flex:1, overflowY:'auto', display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(120px,1fr))', gap:8 }}>
            {results.map((r, i) => (
              <img key={i} src={r.thumb || r.full} alt="" onClick={() => onAdd(r.full)}
                style={{ width:'100%', height:90, objectFit:'cover', borderRadius:8, cursor:'pointer', border:'2px solid transparent', transition:'border-color 0.15s' }}
                onMouseEnter={e => e.currentTarget.style.borderColor='#6c63ff'}
                onMouseLeave={e => e.currentTarget.style.borderColor='transparent'} />
            ))}
          </div>
        )}
        {results.length === 0 && !loading && (
          <div style={{ color:'#6b7280', textAlign:'center', padding:'20px 0', fontSize:13 }}>
            Busca imágenes libres de uso en Wikimedia Commons
          </div>
        )}
      </div>
    </div>
  );
}

// ─── YOUTUBE INPUT MODAL ──────────────────────────────────────────────────────
function YTInputModal({ onAdd, onClose }) {
  const [url, setUrl] = useState('');
  const handle = () => { if (url.trim()) onAdd(url.trim()); };
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.8)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:2000 }}>
      <div style={{ background:'#1f2937', borderRadius:20, padding:28, width:'90%', maxWidth:460, border:'1px solid #374151' }}>
        <h3 style={{ margin:'0 0 16px', color:'#fff', fontSize:18, fontWeight:900 }}>▶ Añadir vídeo YouTube</h3>
        <input value={url} onChange={e => setUrl(e.target.value)} onKeyDown={e => e.key==='Enter' && handle()}
          placeholder="https://www.youtube.com/watch?v=..." autoFocus
          style={{ width:'100%', background:'#111827', border:'2px solid #374151', borderRadius:10, padding:'10px 14px', color:'#fff', fontSize:14, outline:'none', boxSizing:'border-box' }} />
        <div style={{ display:'flex', gap:10, justifyContent:'flex-end', marginTop:16 }}>
          <button onClick={onClose} style={{ background:'#374151', color:'#9ca3af', border:'none', borderRadius:10, padding:'9px 20px', cursor:'pointer', fontWeight:700 }}>Cancelar</button>
          <button onClick={handle} style={{ background:'#ef4444', color:'#fff', border:'none', borderRadius:10, padding:'9px 24px', cursor:'pointer', fontWeight:700 }}>Añadir</button>
        </div>
      </div>
    </div>
  );
}

// ─── WEBVIEW INPUT MODAL ──────────────────────────────────────────────────────
function WebInputModal({ onAdd, onClose }) {
  const [url, setUrl] = useState('https://');
  const handle = () => { if (url.trim() && url.trim() !== 'https://') onAdd(url.trim()); };
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.8)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:2000 }}>
      <div style={{ background:'#1f2937', borderRadius:20, padding:28, width:'90%', maxWidth:460, border:'1px solid #374151' }}>
        <h3 style={{ margin:'0 0 8px', color:'#fff', fontSize:18, fontWeight:900 }}>🌐 Visor web</h3>
        <div style={{ fontSize:12, color:'#6b7280', marginBottom:16 }}>Algunos sitios no permiten mostrarse en iframe (p.ej. Google). Prueba con Wikipedia, Khan Academy, etc.</div>
        <input value={url} onChange={e => setUrl(e.target.value)} onKeyDown={e => e.key==='Enter' && handle()}
          autoFocus
          style={{ width:'100%', background:'#111827', border:'2px solid #374151', borderRadius:10, padding:'10px 14px', color:'#fff', fontSize:14, outline:'none', boxSizing:'border-box' }} />
        <div style={{ display:'flex', gap:10, justifyContent:'flex-end', marginTop:16 }}>
          <button onClick={onClose} style={{ background:'#374151', color:'#9ca3af', border:'none', borderRadius:10, padding:'9px 20px', cursor:'pointer', fontWeight:700 }}>Cancelar</button>
          <button onClick={handle} style={{ background:'#6c63ff', color:'#fff', border:'none', borderRadius:10, padding:'9px 24px', cursor:'pointer', fontWeight:700 }}>Añadir</button>
        </div>
      </div>
    </div>
  );
}

const FreeCanvas = forwardRef(function FreeCanvas({ slide, onChange, onElementSelected }, ref) {
  const t = THEMES[slide.theme] || THEMES.dark;
  const canvasRef = useRef(null);
  const [selectedId, setSelectedId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [guides, setGuides] = useState({ x: null, y: null });
  const dragRef = useRef(null);
  const isMob = window.innerWidth < 640;

  const elements = slide.elements || [];

  useEffect(() => { onElementSelected?.(selectedId); }, [selectedId]); // eslint-disable-line

  const upd = useCallback((newEls) => onChange({ ...slide, elements: newEls }), [slide, onChange]);
  const updEl = useCallback((id, updates) => onChange({
    ...slide, elements: (slide.elements || []).map(e => e.id === id ? { ...e, ...updates } : e),
  }), [slide, onChange]);

  const sel = (id) => { setSelectedId(id); if (id !== editingId) setEditingId(null); };

  useImperativeHandle(ref, () => ({
    addEl: (el) => { upd([...(slide.elements||[]), el]); sel(el.id); },
    selectId: sel,
    setEditing: (id) => setEditingId(id),
    deselectAll: () => { setSelectedId(null); setEditingId(null); },
  }));

  // ── Keyboard ──
  const handleKeyDown = useCallback((e) => {
    if (!selectedId || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT') return;
    const el = elements.find(x => x.id === selectedId); if (!el) return;
    const step = e.shiftKey ? 5 : 1;
    if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault(); upd(elements.filter(x => x.id !== selectedId)); setSelectedId(null); setEditingId(null);
    } else if (e.key === 'Escape') { setSelectedId(null); setEditingId(null);
    } else if (e.key === 'd' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      const newEl = { ...el, id: `el_${Date.now()}`, x: el.x + 3, y: el.y + 3 };
      upd([...elements, newEl]); sel(newEl.id);
    } else if (e.key === 'ArrowLeft')  { e.preventDefault(); updEl(el.id, { x: Math.max(0, el.x - step) }); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); updEl(el.id, { x: Math.min(100 - el.w, el.x + step) }); }
    else if (e.key === 'ArrowUp')    { e.preventDefault(); updEl(el.id, { y: Math.max(0, el.y - step) }); }
    else if (e.key === 'ArrowDown')  { e.preventDefault(); updEl(el.id, { y: Math.min(100 - el.h, el.y + step) }); }
  }, [selectedId, elements, upd, updEl]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // ── Snap ──
  const applySnap = (nx, ny, nw, nh) => {
    let gx = null, gy = null;
    for (const g of FC_SNAP) {
      const T = 2;
      if      (Math.abs(nx - g)          < T) { nx = g;           gx = g; }
      else if (Math.abs(nx + nw - g)     < T) { nx = g - nw;      gx = g; }
      else if (Math.abs(nx + nw/2 - g)   < T) { nx = g - nw/2;    gx = g; }
      if      (Math.abs(ny - g)          < T) { ny = g;           gy = g; }
      else if (Math.abs(ny + nh - g)     < T) { ny = g - nh;      gy = g; }
      else if (Math.abs(ny + nh/2 - g)   < T) { ny = g - nh/2;    gy = g; }
    }
    return { nx, ny, gx, gy };
  };

  // ── Drag/resize handlers ──
  const makeHandlers = (el, mode, corner = null) => ({
    onPointerDown(e) {
      if (mode === 'move' && editingId === el.id) return;
      e.stopPropagation(); e.currentTarget.setPointerCapture(e.pointerId);
      if (mode === 'move') sel(el.id);
      const rect = canvasRef.current.getBoundingClientRect();
      dragRef.current = { mode, corner, id: el.id, startX: e.clientX, startY: e.clientY, startEl: { x: el.x, y: el.y, w: el.w, h: el.h }, rw: rect.width, rh: rect.height };
    },
    onPointerMove(e) {
      const d = dragRef.current;
      if (!d || d.id !== el.id || d.mode !== mode || d.corner !== corner) return;
      const dx = (e.clientX - d.startX) / d.rw * 100;
      const dy = (e.clientY - d.startY) / d.rh * 100;
      const { x: ox, y: oy, w: ow, h: oh } = d.startEl;
      let nx = ox, ny = oy, nw = ow, nh = oh;
      const MW = 5, MH = 4;
      if (mode === 'move') {
        nx = Math.max(0, Math.min(100 - ow, ox + dx));
        ny = Math.max(0, Math.min(100 - oh, oy + dy));
        const s = applySnap(nx, ny, nw, nh);
        nx = s.nx; ny = s.ny; setGuides({ x: s.gx, y: s.gy });
      } else {
        switch (corner) {
          case 'se': nw = Math.max(MW, ow + dx); nh = Math.max(MH, oh + dy); break;
          case 'sw': { const w2=Math.max(MW,ow-dx); nx=ox+ow-w2; nw=w2; nh=Math.max(MH,oh+dy); break; }
          case 'ne': { nw=Math.max(MW,ow+dx); const h2=Math.max(MH,oh-dy); ny=oy+oh-h2; nh=h2; break; }
          case 'nw': { const w3=Math.max(MW,ow-dx); const h3=Math.max(MH,oh-dy); nx=ox+ow-w3; ny=oy+oh-h3; nw=w3; nh=h3; break; }
          case 'n':  { const h4=Math.max(MH,oh-dy); ny=oy+oh-h4; nh=h4; break; }
          case 's':  { nh=Math.max(MH,oh+dy); break; }
          case 'e':  { nw=Math.max(MW,ow+dx); break; }
          case 'w':  { const w4=Math.max(MW,ow-dx); nx=ox+ow-w4; nw=w4; break; }
        }
      }
      onChange({ ...slide, elements: (slide.elements||[]).map(e => e.id===el.id ? {...e,x:nx,y:ny,w:nw,h:nh} : e) });
    },
    onPointerUp() { if (dragRef.current?.id === el.id) { dragRef.current = null; setGuides({ x:null, y:null }); } },
  });

  // ── Text style ──
  const getTextStyle = (el, isTA) => {
    const defColor = el.textStyle==='cta' ? t.accent : el.textStyle==='sub' ? t.sub : t.text;
    const defSize  = el.textStyle==='heading' ? 32 : el.textStyle==='sub' ? 14 : 16;
    const defWt    = el.textStyle==='heading' ? 'bold' : el.textStyle==='sub' ? '600' : 'normal';
    return {
      width:'100%', padding:'4px 6px', boxSizing:'border-box',
      fontFamily: el.fontFamily || "'Inter','Segoe UI',sans-serif",
      fontSize: `${el.fontSize || defSize}px`,
      fontWeight: el.fontWeight || defWt,
      fontStyle: el.fontStyle || 'normal',
      textDecoration: el.textDecoration || 'none',
      textAlign: el.textAlign || 'left',
      color: el.color || defColor,
      lineHeight: el.lineHeight || 1.5,
      letterSpacing: el.textStyle==='sub' ? '0.1em' : 'normal',
      ...(isTA ? { background:'transparent', border:'none', outline:'none', resize:'none', height:'100%', display:'block' }
               : { overflow:'hidden', whiteSpace:'pre-wrap', wordBreak:'break-word' }),
    };
  };

  // ── Render element ──
  const HS = isMob ? 14 : 10;
  const renderElement = (el) => {
    const isSel = el.id === selectedId;
    const isEdit = el.id === editingId;
    const moveH = makeHandlers(el, 'move');
    return (
      <div key={el.id} {...moveH}
        onClick={e => { e.stopPropagation(); sel(el.id); }}
        onDoubleClick={() => el.type === 'text' && setEditingId(el.id)}
        style={{
          position:'absolute', left:`${el.x}%`, top:`${el.y}%`, width:`${el.w}%`, height:`${el.h}%`,
          border: isSel ? '2px solid #6c63ff' : '2px solid transparent',
          borderRadius:4, cursor: isEdit ? 'text' : 'move',
          boxSizing:'border-box', touchAction:'none', pointerEvents:'auto',
          userSelect: isEdit ? 'text' : 'none', overflow:'hidden',
          opacity: el.opacity ?? 1,
          boxShadow: isSel ? '0 0 0 3px rgba(108,99,255,0.22)' : 'none',
          zIndex: isSel ? 5 : 1,
        }}
      >
        {el.type === 'text' && (
          isEdit
            ? <textarea autoFocus value={el.text||''} onChange={ev => updEl(el.id,{text:ev.target.value})}
                onBlur={() => setEditingId(null)} onPointerDown={e=>e.stopPropagation()} style={getTextStyle(el,true)} />
            : <div style={getTextStyle(el,false)}>{el.text||''}</div>
        )}
        {el.type === 'image' && (
          <img src={el.src} alt="" draggable={false} style={{ width:'100%', height:'100%', objectFit:el.objectFit||'cover', display:'block', borderRadius:`${el.borderRadius||0}px` }} />
        )}
        {el.type === 'youtube' && (
          <div style={{ width:'100%', height:'100%', position:'relative', background:'#000', overflow:'hidden' }}>
            {el.thumb && <img src={el.thumb} alt="" draggable={false} style={{width:'100%',height:'100%',objectFit:'cover'}} />}
            <div style={{position:'absolute',inset:0,display:'flex',alignItems:'center',justifyContent:'center'}}>
              <div style={{width:44,height:44,background:'rgba(255,0,0,0.9)',borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',boxShadow:'0 2px 12px rgba(0,0,0,0.6)'}}>
                <span style={{color:'#fff',fontSize:18,marginLeft:4}}>▶</span>
              </div>
            </div>
            <div style={{position:'absolute',inset:0}} />
          </div>
        )}
        {el.type === 'webview' && (
          <div style={{ width:'100%', height:'100%', position:'relative', background:'#0f172a', overflow:'hidden' }}>
            <iframe src={el.src} style={{width:'100%',height:'100%',border:'none'}} title="web" sandbox="allow-scripts allow-same-origin allow-forms" />
            <div style={{position:'absolute',inset:0,display:'flex',alignItems:'center',justifyContent:'center',pointerEvents:'none'}}>
              {isSel && <div style={{background:'rgba(108,99,255,0.5)',borderRadius:8,padding:'4px 12px',fontSize:11,color:'#fff',fontWeight:700}}>🌐 Visor web</div>}
            </div>
            <div style={{position:'absolute',inset:0}} />
          </div>
        )}
        {el.type === 'shape' && el.shapeType !== 'triangle' && el.shapeType !== 'line' && (
          <div style={{ width:'100%', height:'100%', background:el.fill||'#6c63ff', borderRadius: el.shapeType==='circle' ? '50%' : `${el.borderRadius||0}px`, border: el.stroke && el.stroke!=='none' ? `${el.strokeWidth||2}px solid ${el.stroke}` : 'none', boxSizing:'border-box' }} />
        )}
        {el.type === 'shape' && el.shapeType === 'triangle' && (
          <svg viewBox="0 0 100 100" style={{width:'100%',height:'100%'}} preserveAspectRatio="none">
            <polygon points="50,2 98,98 2,98" fill={el.fill||'#6c63ff'} stroke={el.stroke&&el.stroke!=='none'?el.stroke:'none'} strokeWidth={el.strokeWidth||0} />
          </svg>
        )}
        {el.type === 'shape' && el.shapeType === 'line' && (
          <svg viewBox="0 0 100 10" style={{width:'100%',height:'100%'}} preserveAspectRatio="none">
            <line x1="2" y1="5" x2="98" y2="5" stroke={el.fill||t.text} strokeWidth={el.strokeWidth||3} strokeLinecap="round" />
          </svg>
        )}
        {isSel && FC_HANDLES.map(c => {
          const h = makeHandlers(el, 'resize', c);
          return <div key={c} {...h} style={{ position:'absolute', width:HS, height:HS, background:'#fff', border:'2px solid #6c63ff', borderRadius:3, ...FC_HANDLE_POS[c], zIndex:10, touchAction:'none', boxSizing:'border-box', boxShadow:'0 1px 4px rgba(0,0,0,0.4)' }} />;
        })}
      </div>
    );
  };

  return (
    <div ref={canvasRef}
      style={{ position:'absolute', inset:0, overflow:'hidden', touchAction:'none', zIndex:2, pointerEvents:'none' }}
    >
      {selectedId && (
        <div style={{position:'absolute',inset:0,zIndex:0,pointerEvents:'auto'}}
          onPointerDown={() => { setSelectedId(null); setEditingId(null); }} />
      )}
      {guides.x!=null && <div style={{position:'absolute',top:0,bottom:0,left:`${guides.x}%`,width:1,background:'#06b6d4',zIndex:50,pointerEvents:'none',opacity:0.9}} />}
      {guides.y!=null && <div style={{position:'absolute',left:0,right:0,top:`${guides.y}%`,height:1,background:'#06b6d4',zIndex:50,pointerEvents:'none',opacity:0.9}} />}
      {elements.map(renderElement)}
    </div>
  );
});

// ─── SLIDE CANVAS ─────────────────────────────────────────────────────────────
function SlideCanvas({ slide, onChange, usuario, onElementSelected }) {
  const t = THEMES[slide.theme] || THEMES.dark;
  const fileRef = useRef();
  const imageFileRef = useRef();
  const fcRef = useRef(null);
  const [showPicker, setShowPicker] = useState(false);
  const [showStickers, setShowStickers] = useState(false);
  const [showImgSearch, setShowImgSearch] = useState(false);
  const [showYT, setShowYT] = useState(false);
  const [showWeb, setShowWeb] = useState(false);
  const [subject, setSubject] = useState('general');
  const [show3D, setShow3D] = useState(null);
  const [showMusic, setShowMusic] = useState(false);
  const [showGeo, setShowGeo] = useState(false);
  const [showMath, setShowMath] = useState(false);

  const mkId = () => `el_${Date.now()}`;
  const mkText = (extra = {}) => ({
    id: mkId(), type: 'text', x: 15, y: 25, w: 70, h: 20,
    text: 'Texto aquí', textAlign: 'left',
    fontSize: 18, fontWeight: 'normal', fontStyle: 'normal',
    textDecoration: 'none', color: null, lineHeight: 1.5, opacity: 1, ...extra,
  });
  const addHeading = () => {
    const el = mkText({ text: 'Título', textAlign: 'center', fontSize: 38, fontWeight: 'bold', y: 10, h: 22 });
    fcRef.current?.addEl(el); setTimeout(() => fcRef.current?.setEditing(el.id), 0);
  };
  const addText = () => {
    const el = mkText();
    fcRef.current?.addEl(el); setTimeout(() => fcRef.current?.setEditing(el.id), 0);
  };
  const addShape = (shapeType) => {
    const fills = { rect: '#6c63ff', circle: '#a855f7', triangle: '#ec4899', line: t.text };
    const el = {
      id: mkId(), type: 'shape', shapeType,
      x: 25, y: shapeType === 'line' ? 47 : 30,
      w: 40, h: shapeType === 'line' ? 3 : 26,
      fill: fills[shapeType] || '#6c63ff', stroke: 'none', strokeWidth: 2,
      borderRadius: shapeType === 'rect' ? 8 : 0, opacity: 1,
    };
    fcRef.current?.addEl(el);
  };
  const addSticker = (emoji) => {
    const el = mkText({ text: emoji, textAlign: 'center', fontSize: 60, x: 35, y: 30, w: 20, h: 28, lineHeight: 1 });
    fcRef.current?.addEl(el); setShowStickers(false);
  };
  const handleImageFile = (e) => {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const el = { id: mkId(), type: 'image', x: 20, y: 10, w: 60, h: 75, src: ev.target.result, objectFit: 'cover', borderRadius: 0, opacity: 1 };
      fcRef.current?.addEl(el);
    };
    reader.readAsDataURL(file); e.target.value = '';
  };
  const addYT = (url) => {
    const parsed = parseVideoUrl(url);
    if (!parsed || parsed.type !== 'youtube') { alert('URL de YouTube no reconocida'); return; }
    const el = { id: mkId(), type: 'youtube', ytId: parsed.id, thumb: parsed.thumb, embed: parsed.embed, x: 15, y: 10, w: 70, h: 70, opacity: 1 };
    fcRef.current?.addEl(el); setShowYT(false);
  };
  const addWeb = (url) => {
    const el = { id: mkId(), type: 'webview', src: url, x: 5, y: 5, w: 90, h: 85, opacity: 1 };
    fcRef.current?.addEl(el); setShowWeb(false);
  };
  const addFromSearch = (imgUrl) => {
    const el = { id: mkId(), type: 'image', x: 20, y: 10, w: 60, h: 75, src: imgUrl, objectFit: 'cover', borderRadius: 0, opacity: 1 };
    fcRef.current?.addEl(el); setShowImgSearch(false);
  };
  const handleInsert3D = (base64) => {
    const el = { id: mkId(), type: 'image', x: 15, y: 10, w: 55, h: 45, src: base64, objectFit: 'contain', borderRadius: 0, opacity: 1 };
    fcRef.current?.addEl(el); setShow3D(null);
  };
  const handleInsertMusic = (base64) => {
    const el = { id: mkId(), type: 'image', x: 5, y: 25, w: 88, h: 30, src: base64, objectFit: 'contain', borderRadius: 0, opacity: 1 };
    fcRef.current?.addEl(el); setShowMusic(false);
  };
  const handleInsertGeo = (src, wOrType, h) => {
    if (wOrType === 'text') {
      const el = mkText({ text: src, fontSize: 14, fontWeight: 'bold', x: 10, y: 30, w: 50, h: 12 });
      fcRef.current?.addEl(el);
    } else {
      const w = typeof wOrType === 'number' ? wOrType : 75;
      const el = { id: mkId(), type: 'image', x: 5, y: 5, src, w, h: h || 65, objectFit: 'contain', borderRadius: 0, opacity: 1 };
      fcRef.current?.addEl(el);
    }
    setShowGeo(false);
  };
  const handleInsertMath = (base64) => {
    const el = { id: mkId(), type: 'image', x: 20, y: 30, w: 50, h: 25, src: base64, objectFit: 'contain', borderRadius: 4, opacity: 1 };
    fcRef.current?.addEl(el); setShowMath(false);
  };

  const upd = (key, val) => onChange({ ...slide, [key]: val });

  const handleImage = e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => upd('imageBase64', ev.target.result);
    reader.readAsDataURL(file);
  };

  const bodyLines = (slide.body || '').split('\n');
  const col2Lines = (slide.col2 || '').split('\n');

  const ta = (val, key, rows = 3, placeholder = '') => (
    <textarea
      value={val || ''} rows={rows} placeholder={placeholder}
      onChange={e => upd(key, e.target.value)}
      style={{
        width: '100%', background: 'transparent', border: 'none', outline: 'none',
        color: t.text, fontSize: 'inherit', fontFamily: 'inherit', resize: 'none',
        lineHeight: 1.6, padding: 0,
      }}
    />
  );

  const inp = (val, key, style = {}) => (
    <input
      value={val || ''} onChange={e => upd(key, e.target.value)}
      style={{ background: 'transparent', border: 'none', outline: 'none', color: t.text, fontFamily: 'inherit', width: '100%', ...style }}
    />
  );

  const ImageZone = ({ side }) => (
    <div
      onClick={() => fileRef.current.click()}
      style={{
        background: slide.imageBase64 ? `url(${slide.imageBase64}) center/cover` : t.card,
        border: `2px dashed ${slide.imageBase64 ? 'transparent' : t.cardBorder}`,
        borderRadius: 12, cursor: 'pointer', display: 'flex', alignItems: 'center',
        justifyContent: 'center', color: t.sub, fontSize: 13,
        minHeight: side === 'full' ? 160 : '100%', minWidth: side === 'full' ? '100%' : 140,
      }}
    >
      {!slide.imageBase64 && <span>🖼️ Clic para añadir imagen</span>}
    </div>
  );

  const MapNode = ({ node, onUpdate }) => (
    <div style={{
      position: 'absolute', left: `${node.x}%`, top: `${node.y}%`, transform: 'translate(-50%,-50%)',
      background: node.isCenter ? t.accent : t.card,
      border: `2px solid ${node.isCenter ? t.accent : t.cardBorder}`,
      borderRadius: node.isCenter ? 20 : 12,
      padding: node.isCenter ? '8px 16px' : '5px 12px',
      color: node.isCenter ? '#fff' : t.text,
      fontSize: node.isCenter ? 13 : 11, fontWeight: node.isCenter ? 800 : 600,
      cursor: 'pointer', whiteSpace: 'nowrap', zIndex: 2,
    }}>
      <input
        value={node.text} onChange={e => onUpdate({ ...node, text: e.target.value })}
        style={{ background: 'transparent', border: 'none', outline: 'none', color: 'inherit', fontFamily: 'inherit', fontWeight: 'inherit', fontSize: 'inherit', width: Math.max(80, node.text.length * 8) }}
      />
    </div>
  );

  const updateMapNode = (nodeId, updated) => {
    upd('mapNodes', (slide.mapNodes || []).map(n => n.id === nodeId ? updated : n));
  };

  const addMapNode = () => {
    const nodes = slide.mapNodes || [];
    upd('mapNodes', [...nodes, { id: Date.now(), text: 'Nuevo nodo', x: 30 + Math.random() * 40, y: 30 + Math.random() * 40 }]);
  };

  const TagsEditor = () => {
    const [newTag, setNewTag] = useState('');
    return (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
        {(slide.tags || []).map((tag, i) => (
          <span key={i} style={{ background: t.tag, border: `1px solid ${t.tagBorder}`, color: t.tagText, borderRadius: 20, padding: '3px 10px', fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
            {tag}
            <span onClick={() => upd('tags', slide.tags.filter((_, j) => j !== i))} style={{ cursor: 'pointer', opacity: 0.6, fontSize: 10 }}>✕</span>
          </span>
        ))}
        <input
          value={newTag} onChange={e => setNewTag(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && newTag.trim()) { upd('tags', [...(slide.tags || []), newTag.trim()]); setNewTag(''); e.preventDefault(); } }}
          placeholder="+ etiqueta (Enter)"
          style={{ background: t.card, border: `1px solid ${t.cardBorder}`, color: t.text, borderRadius: 20, padding: '3px 10px', fontSize: 12, outline: 'none', width: 130 }}
        />
      </div>
    );
  };

  const commonHeading = () => (
    <div style={{ textAlign: slide.layout === 'title' || slide.layout === 'cta' ? 'center' : 'left' }}>
      <div style={{ fontSize: slide.layout === 'title' || slide.layout === 'cta' ? 'clamp(1.8rem,6vw,3rem)' : 'clamp(1.3rem,4vw,2rem)', fontWeight: 900, lineHeight: 1.2, letterSpacing: slide.layout === 'title' ? -2 : 0, background: slide.layout === 'title' ? `linear-gradient(135deg, ${t.accent}, #ec4899)` : 'none', WebkitBackgroundClip: slide.layout === 'title' ? 'text' : 'unset', WebkitTextFillColor: slide.layout === 'title' ? 'transparent' : t.text, color: t.text }}>
        {inp(slide.heading, 'heading', { fontSize: 'inherit', fontWeight: 900, letterSpacing: 'inherit', WebkitTextFillColor: 'inherit', color: 'inherit' })}
      </div>
      {(slide.layout === 'title' || slide.layout === 'cta') && slide.subheading !== undefined && (
        <div style={{ color: t.sub, fontSize: 'clamp(0.8rem,2vw,1.1rem)', fontWeight: 600, letterSpacing: 3, textTransform: 'uppercase', marginTop: 8 }}>
          {inp(slide.subheading, 'subheading', { color: t.sub, fontSize: 'inherit', letterSpacing: 'inherit' })}
        </div>
      )}
    </div>
  );

  const renderContent = () => {
    switch (slide.layout) {
      case 'title':
        return (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: '20px 32px', height: '100%' }}>
            {commonHeading()}
            {slide.imageBase64 && (
              <div style={{ width: '60%', maxHeight: 160, overflow: 'hidden', borderRadius: 12 }}>
                <img src={slide.imageBase64} alt="" style={{ width: '100%', objectFit: 'cover' }} onClick={() => fileRef.current.click()} />
              </div>
            )}
            {!slide.imageBase64 && (
              <div onClick={() => fileRef.current.click()} style={{ fontSize: 11, color: t.sub, cursor: 'pointer', opacity: 0.5 }}>+ imagen opcional</div>
            )}
            <TagsEditor />
          </div>
        );
      case 'content':
        return (
          <div style={{ padding: '24px 32px', height: '100%', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ fontSize: 'clamp(1.2rem,3.5vw,1.8rem)', fontWeight: 900, color: t.text }}>
              {inp(slide.heading, 'heading', { fontSize: 'inherit', fontWeight: 900, color: t.text })}
            </div>
            <div style={{ flex: 1, color: t.text, fontSize: 15, lineHeight: 1.8, opacity: 0.85 }}>
              {ta(slide.body, 'body', 8, '• Escribe puntos clave...')}
            </div>
            <TagsEditor />
          </div>
        );
      case 'image-right':
        return (
          <div style={{ display: 'flex', gap: 20, padding: '24px 32px', height: '100%', alignItems: 'center' }}>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ fontSize: 'clamp(1.1rem,3vw,1.6rem)', fontWeight: 900, color: t.text }}>
                {inp(slide.heading, 'heading', { fontSize: 'inherit', fontWeight: 900, color: t.text })}
              </div>
              <div style={{ color: t.text, opacity: 0.85, fontSize: 14, lineHeight: 1.7 }}>{ta(slide.body, 'body', 5)}</div>
              <TagsEditor />
            </div>
            <div style={{ width: 220, flexShrink: 0, height: '80%' }}><ImageZone /></div>
          </div>
        );
      case 'image-left':
        return (
          <div style={{ display: 'flex', gap: 20, padding: '24px 32px', height: '100%', alignItems: 'center' }}>
            <div style={{ width: 220, flexShrink: 0, height: '80%' }}><ImageZone /></div>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ fontSize: 'clamp(1.1rem,3vw,1.6rem)', fontWeight: 900, color: t.text }}>
                {inp(slide.heading, 'heading', { fontSize: 'inherit', fontWeight: 900, color: t.text })}
              </div>
              <div style={{ color: t.text, opacity: 0.85, fontSize: 14, lineHeight: 1.7 }}>{ta(slide.body, 'body', 5)}</div>
              <TagsEditor />
            </div>
          </div>
        );
      case 'two-col':
        return (
          <div style={{ padding: '24px 32px', height: '100%', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ fontSize: 'clamp(1.1rem,3vw,1.6rem)', fontWeight: 900, color: t.text }}>
              {inp(slide.heading, 'heading', { fontSize: 'inherit', fontWeight: 900, color: t.text })}
            </div>
            <div style={{ display: 'flex', flex: 1, gap: 16 }}>
              <div style={{ flex: 1, background: t.card, border: `1px solid ${t.cardBorder}`, borderRadius: 12, padding: 12, color: t.text, fontSize: 13, lineHeight: 1.7 }}>
                {ta(slide.body, 'body', 7, '• Columna izquierda...')}
              </div>
              <div style={{ flex: 1, background: t.card, border: `1px solid ${t.cardBorder}`, borderRadius: 12, padding: 12, color: t.text, fontSize: 13, lineHeight: 1.7 }}>
                {ta(slide.col2, 'col2', 7, '• Columna derecha...')}
              </div>
            </div>
          </div>
        );
      case 'cta':
        return (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: '20px 32px', height: '100%' }}>
            <div style={{ fontSize: 'clamp(1.5rem,5vw,2.5rem)', fontWeight: 900, textAlign: 'center', color: t.text, lineHeight: 1.2 }}>
              {inp(slide.heading, 'heading', { fontSize: 'inherit', fontWeight: 900, color: t.text, textAlign: 'center' })}
            </div>
            <div style={{ fontSize: 'clamp(0.9rem,2.5vw,1.3rem)', color: t.sub, fontWeight: 600, textAlign: 'center' }}>
              {inp(slide.subheading, 'subheading', { color: t.sub, fontSize: 'inherit', textAlign: 'center' })}
            </div>
            <div style={{ background: '#fff', color: t.accent !== '#ffffff' ? t.accent : '#6c63ff', fontWeight: 900, borderRadius: 40, padding: '10px 28px', fontSize: '1.1rem', boxShadow: '0 4px 16px rgba(0,0,0,0.2)' }}>
              {inp(slide.body || 'www.pikt.es', 'body', { color: 'inherit', fontWeight: 900, fontSize: 'inherit' })}
            </div>
            <TagsEditor />
          </div>
        );
      case 'map':
        return (
          <div style={{ padding: '12px 24px', height: '100%', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontSize: '1.3rem', fontWeight: 900, color: t.text }}>
              {inp(slide.heading, 'heading', { fontSize: 'inherit', fontWeight: 900, color: t.text })}
            </div>
            <div style={{ flex: 1, position: 'relative', background: t.card, borderRadius: 12, border: `1px solid ${t.cardBorder}` }}>
              {(slide.mapNodes || []).slice(1).map(node => {
                const center = slide.mapNodes[0];
                if (!center) return null;
                return (
                  <svg key={`l-${node.id}`} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 1 }}>
                    <line x1={`${center.x}%`} y1={`${center.y}%`} x2={`${node.x}%`} y2={`${node.y}%`} stroke={t.cardBorder} strokeWidth={2} strokeDasharray="4,4" />
                  </svg>
                );
              })}
              {(slide.mapNodes || []).map(node => (
                <MapNode key={node.id} node={node} onUpdate={u => updateMapNode(node.id, u)} />
              ))}
            </div>
            <button onClick={addMapNode} style={{ alignSelf: 'flex-start', background: t.tag, color: t.tagText, border: `1px solid ${t.tagBorder}`, borderRadius: 20, padding: '4px 12px', fontSize: 11, cursor: 'pointer', fontWeight: 700 }}>
              + Añadir nodo
            </button>
          </div>
        );
      case 'video': {
        const parsed = parseVideoUrl(slide.videoUrl);
        return (
          <div style={{ padding: '16px 24px', height: '100%', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {/* Optional title */}
            <div style={{ fontSize: '1.2rem', fontWeight: 900, color: t.text, flexShrink: 0 }}>
              {inp(slide.heading, 'heading', { fontSize: 'inherit', fontWeight: 900, color: t.text, placeholder: 'Título opcional...' })}
            </div>

            {/* Video area */}
            <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {!parsed ? (
                /* URL paste zone */
                <div style={{ flex: 1, background: t.card, border: `2px dashed ${t.cardBorder}`, borderRadius: 12, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, padding: 16 }}>
                  <div style={{ fontSize: 32 }}>▶️</div>
                  <div style={{ color: t.text, fontWeight: 700, fontSize: 14 }}>Pega aquí la URL del vídeo</div>
                  <div style={{ color: t.sub, fontSize: 11, textAlign: 'center' }}>YouTube · Vimeo · MP4 directo</div>
                  <input
                    value={slide.videoUrl || ''}
                    onChange={e => upd('videoUrl', e.target.value)}
                    placeholder="https://www.youtube.com/watch?v=..."
                    style={{ width: '100%', maxWidth: 360, background: t.card, border: `1px solid ${t.accent}`, borderRadius: 8, padding: '8px 12px', color: t.text, fontSize: 12, outline: 'none', fontFamily: 'inherit' }}
                  />
                </div>
              ) : (
                /* Preview */
                <div style={{ flex: 1, position: 'relative', borderRadius: 12, overflow: 'hidden', background: '#000' }}>
                  {parsed.type === 'youtube' && parsed.thumb && (
                    <div style={{ width: '100%', height: '100%', backgroundImage: `url(${parsed.thumb})`, backgroundSize: 'cover', backgroundPosition: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <div style={{ width: 52, height: 52, background: 'rgba(255,0,0,0.9)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 20px rgba(0,0,0,0.5)' }}>
                        <span style={{ color: '#fff', fontSize: 20, marginLeft: 3 }}>▶</span>
                      </div>
                    </div>
                  )}
                  {parsed.type === 'vimeo' && (
                    <div style={{ width: '100%', height: '100%', background: '#1ab7ea22', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 8 }}>
                      <span style={{ fontSize: 36, color: '#1ab7ea' }}>🎬</span>
                      <span style={{ color: '#1ab7ea', fontWeight: 700 }}>Vimeo · {parsed.id}</span>
                    </div>
                  )}
                  {parsed.type === 'direct' && (
                    <video src={parsed.embed} style={{ width: '100%', height: '100%', objectFit: 'contain' }} controls />
                  )}
                  {/* Change/clear bar */}
                  <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'rgba(0,0,0,0.7)', padding: '6px 10px', display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span style={{ flex: 1, color: 'rgba(255,255,255,0.7)', fontSize: 10, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{slide.videoUrl}</span>
                    <button onClick={() => upd('videoUrl', '')} style={{ background: 'rgba(239,68,68,0.7)', color: '#fff', border: 'none', borderRadius: 6, padding: '3px 8px', fontSize: 10, cursor: 'pointer', flexShrink: 0 }}>Cambiar</button>
                  </div>
                </div>
              )}
            </div>

            {/* Caption */}
            <div style={{ flexShrink: 0 }}>
              {inp(slide.videoCaption, 'videoCaption', { color: t.sub, fontSize: 12, fontStyle: 'italic', placeholder: 'Leyenda del vídeo (opcional)...' })}
            </div>
          </div>
        );
      }
      case 'game':
        return (
          <GameSlidePreview
            slide={slide} t={t}
            onOpenPicker={() => setShowPicker(true)}
            onClear={() => onChange({ ...slide, resourceId: null, resourceTitle: '', resourceType: '', resourceTipo: '', heading: '' })}
          />
        );
      default:
        return null;
    }
  };

  const handleSelectResource = (r) => {
    onChange({
      ...slide,
      resourceId: r.id,
      resourceTitle: r.titulo || '',
      resourceType: r.tipoJuego || '',
      resourceTipo: r.tipo || '',
      heading: r.titulo || '',
    });
    setShowPicker(false);
  };

  const isFree = slide.layout === 'free';

  return (
    <>
      <div style={{ position: 'relative', width: '100%', aspectRatio: '16/9', background: t.bg, borderRadius: 16, overflow: 'hidden', boxShadow: '0 8px 40px rgba(0,0,0,0.4)' }}>
        <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleImage} />
        <input ref={imageFileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleImageFile} />
        {!isFree && <div style={{ position: 'relative', zIndex: 1, height: '100%' }}>{renderContent()}</div>}
        {isFree && (slide.elements || []).length === 0 && (
          <div style={{position:'absolute',inset:0,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:8,pointerEvents:'none',zIndex:1}}>
            <div style={{fontSize:28}}>✋</div>
            <div style={{fontWeight:700,fontSize:13,color:t.text}}>Lienzo libre</div>
            <div style={{fontSize:11,color:t.sub}}>Usa los botones de abajo · Doble clic = editar · Supr = borrar</div>
          </div>
        )}
        <FreeCanvas ref={fcRef} slide={slide} onChange={onChange} onElementSelected={onElementSelected} />
      </div>

      {/* ── Add elements toolbar (all layouts) ── */}
      <div style={{display:'flex',gap:5,justifyContent:'center',flexWrap:'wrap',padding:'8px 4px 2px',position:'relative'}}>
        <button onClick={addHeading} style={FC_BTN('#374151','#e5e7eb')}>🔤 Título</button>
        <button onClick={addText} style={FC_BTN('#374151','#e5e7eb')}>T Texto</button>
        <button onClick={() => imageFileRef.current.click()} style={FC_BTN('#374151','#e5e7eb')}>🖼 Imagen</button>
        <button onClick={() => setShowImgSearch(true)} style={FC_BTN('#374151','#e5e7eb')}>🔍 Buscar</button>
        <button onClick={() => setShowYT(true)} style={FC_BTN('rgba(239,68,68,0.2)','#f87171',{border:'1px solid rgba(239,68,68,0.3)'})}>▶ YouTube</button>
        <button onClick={() => setShowWeb(true)} style={FC_BTN('#374151','#e5e7eb')}>🌐 Web</button>
        <button onClick={() => addShape('rect')} style={FC_BTN('#374151','#e5e7eb')}>▭ Rect</button>
        <button onClick={() => addShape('circle')} style={FC_BTN('#374151','#e5e7eb')}>⬤ Círculo</button>
        <button onClick={() => addShape('triangle')} style={FC_BTN('#374151','#e5e7eb')}>▲ Triáng</button>
        <button onClick={() => addShape('line')} style={FC_BTN('#374151','#e5e7eb')}>— Línea</button>
        <div style={{position:'relative'}}>
          <button onClick={() => setShowStickers(s=>!s)} style={FC_BTN(showStickers ? '#6c63ff' : '#374151','#e5e7eb')}>😀 Sticker</button>
          {showStickers && (
            <div style={{position:'absolute',bottom:'100%',left:'50%',transform:'translateX(-50%)',background:'#1f2937',border:'1px solid #374151',borderRadius:10,padding:8,display:'flex',gap:4,flexWrap:'wrap',width:200,zIndex:100,marginBottom:4,boxShadow:'0 4px 20px rgba(0,0,0,0.5)'}}>
              {FC_STICKERS.map(s => (
                <button key={s} onClick={() => addSticker(s)} style={{background:'transparent',border:'none',fontSize:22,cursor:'pointer',padding:3,borderRadius:4,lineHeight:1}}>{s}</button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Subject toolbar ── */}
      <div style={{display:'flex',gap:5,justifyContent:'center',flexWrap:'wrap',padding:'2px 4px 6px',alignItems:'center'}}>
        {/* Subject selector */}
        <select value={subject} onChange={e=>setSubject(e.target.value)}
          style={{background:'#1f2937',color:'#e5e7eb',border:'1px solid #374151',borderRadius:8,padding:'4px 8px',fontSize:11,fontWeight:700,cursor:'pointer',outline:'none'}}>
          <option value="general">🔬 Ciencias</option>
          <option value="musica">🎵 Música</option>
          <option value="geo">🌍 Geografía</option>
        </select>

        {/* General/Science: 3D shapes */}
        {subject === 'general' && <>
          {[['Cubo','box'],['Prisma','prism'],['Pirámide','pyramid'],['Cilindro','cylinder'],['Cono','cone'],['Esfera','sphere']].map(([label,shape])=>(
            <button key={shape} onClick={()=>setShow3D(shape)}
              style={FC_BTN('rgba(99,102,241,0.15)','#a5b4fc',{border:'1px solid rgba(99,102,241,0.3)'})}>
              {label}
            </button>
          ))}
        </>}

        {/* Music */}
        {subject === 'musica' && (
          <button onClick={()=>setShowMusic(true)} style={FC_BTN('rgba(168,85,247,0.15)','#c084fc',{border:'1px solid rgba(168,85,247,0.3)'})}>
            🎵 Panel Música
          </button>
        )}

        {/* Geography */}
        {subject === 'geo' && (
          <button onClick={()=>setShowGeo(true)} style={FC_BTN('rgba(34,197,94,0.15)','#86efac',{border:'1px solid rgba(34,197,94,0.3)'})}>
            🌍 Panel Geografía
          </button>
        )}

        {/* Math always visible */}
        <button onClick={()=>setShowMath(true)} style={FC_BTN('rgba(251,191,36,0.15)','#fde68a',{border:'1px solid rgba(251,191,36,0.3)'})}>
          ∑ Ecuación
        </button>
      </div>

      {showPicker && <ResourcePickerModal usuario={usuario} onSelect={handleSelectResource} onClose={() => setShowPicker(false)} />}
      {showImgSearch && <ImgSearchModal onAdd={addFromSearch} onClose={() => setShowImgSearch(false)} />}
      {showYT && <YTInputModal onAdd={addYT} onClose={() => setShowYT(false)} />}
      {showWeb && <WebInputModal onAdd={addWeb} onClose={() => setShowWeb(false)} />}
      {show3D && <Visor3DModal shape={show3D} onClose={()=>setShow3D(null)} onInsert={handleInsert3D} />}
      {showMusic && <MusicPanel onInsert={handleInsertMusic} onClose={()=>setShowMusic(false)} />}
      {showGeo && <GeoPanel onInsert={handleInsertGeo} onClose={()=>setShowGeo(false)} />}
      {showMath && <MathEquationModal onInsert={handleInsertMath} onClose={()=>setShowMath(false)} />}
    </>
  );
}

// ─── GEMINI AI GENERATION ─────────────────────────────────────────────────────
async function generateWithGemini(topic, numSlides, theme) {
  const prompt = `Crea una presentación educativa en español sobre el tema: "${topic}".
Genera exactamente ${numSlides} diapositivas en formato JSON.
El array debe tener exactamente ${numSlides} objetos con esta estructura:
[
  {
    "layout": "title" | "content" | "image-right" | "image-left" | "two-col" | "cta" | "map",
    "heading": "Título impactante",
    "subheading": "Subtítulo (solo para layout title y cta)",
    "body": "Texto principal (puntos con •  para content, two-col; URL para cta)",
    "col2": "Segunda columna (solo para two-col)",
    "tags": ["etiqueta1", "etiqueta2"],
    "mapNodes": [
      {"id": 1, "text": "Concepto central", "x": 50, "y": 50, "isCenter": true},
      {"id": 2, "text": "Idea 1", "x": 20, "y": 25},
      {"id": 3, "text": "Idea 2", "x": 80, "y": 25},
      {"id": 4, "text": "Idea 3", "x": 20, "y": 75},
      {"id": 5, "text": "Idea 4", "x": 80, "y": 75}
    ]
  }
]
Reglas:
- La primera diapositiva debe ser de layout "title" con título impactante y subtítulo
- La última diapositiva puede ser "cta" o "title" resumiendo lo aprendido
- Para "content" usa • al inicio de cada línea de body
- Para "two-col" rellena tanto body como col2 con puntos •
- Para "map" rellena mapNodes con el concepto central y 4-6 ideas relacionadas
- Para "image-right" o "image-left" escribe texto descriptivo en body
- Los tags deben ser palabras clave cortas (2-3 palabras máx)
- Usa un tono educativo, claro y motivador
- Responde ÚNICAMENTE con el JSON array, sin markdown ni explicaciones`;

  const data = await callGeminiProxy({
    model: 'gemini-2.0-flash',
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.7, maxOutputTokens: 4000 },
  });

  const raw = extractText(data);
  const jsonMatch = raw.match(/\[[\s\S]*\]/);
  if (!jsonMatch) throw new Error('Gemini no devolvió JSON válido');
  const slides = JSON.parse(jsonMatch[0]);
  return slides.map(s => ({
    id: Date.now() + Math.random(),
    theme,
    duration: 5000,
    heading: s.heading || '',
    subheading: s.subheading || '',
    body: s.body || '',
    col2: s.col2 || '',
    tags: Array.isArray(s.tags) ? s.tags : [],
    imageBase64: null,
    mapNodes: Array.isArray(s.mapNodes) ? s.mapNodes : [],
    layout: s.layout || 'content',
  }));
}

// ─── MAIN EDITOR COMPONENT ────────────────────────────────────────────────────
export default function PresentationEditor({ usuario, presentacionInicial, onClose, onSaved }) {
  const [titulo, setTitulo] = useState(presentacionInicial?.titulo || 'Nueva presentación');
  const [slides, setSlides] = useState(presentacionInicial?.slides || [newSlide('title', 'dark')]);
  const [activeIdx, setActiveIdx] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [presId, setPresId] = useState(presentacionInicial?.id || null);

  // AI
  const [showAI, setShowAI] = useState(false);
  const [aiTopic, setAiTopic] = useState('');
  const [aiSlides, setAiSlides] = useState(6);
  const [aiTheme, setAiTheme] = useState('dark');
  const [generating, setGenerating] = useState(false);
  const [aiError, setAiError] = useState('');

  // Right panel
  const [rightTab, setRightTab] = useState('layout'); // 'layout' | 'theme' | 'settings'
  const [selectedFreeElId, setSelectedFreeElId] = useState(null);

  // Mobile panels
  const [leftOpen,  setLeftOpen]  = useState(false);
  const [rightOpen, setRightOpen] = useState(false);
  const [isMobile,  setIsMobile]  = useState(() => window.innerWidth < 640);
  useEffect(() => {
    const fn = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener('resize', fn);
    return () => window.removeEventListener('resize', fn);
  }, []);

  const activeSlide = slides[activeIdx] || slides[0];

  // Derived: always fresh from current slide state
  const selectedFreeEl = selectedFreeElId
    ? (activeSlide?.elements || []).find(e => e.id === selectedFreeElId) || null
    : null;

  const updateSlide = useCallback((updated) => {
    setSlides(prev => prev.map((s, i) => i === activeIdx ? updated : s));
  }, [activeIdx]);

  const addSlide = (layout = 'content') => {
    const s = newSlide(layout, activeSlide?.theme || 'dark');
    const next = [...slides.slice(0, activeIdx + 1), s, ...slides.slice(activeIdx + 1)];
    setSlides(next);
    setActiveIdx(activeIdx + 1);
  };

  const deleteSlide = (idx) => {
    if (slides.length <= 1) return;
    const next = slides.filter((_, i) => i !== idx);
    setSlides(next);
    setActiveIdx(Math.min(activeIdx, next.length - 1));
  };

  const moveSlide = (from, to) => {
    if (to < 0 || to >= slides.length) return;
    const next = [...slides];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    setSlides(next);
    setActiveIdx(to);
  };

  const handleSave = async () => {
    if (!usuario) return;
    setSaving(true);
    try {
      const data = { titulo, slides, uid: usuario.uid, profesorNombre: usuario.displayName || '', updatedAt: serverTimestamp() };
      if (presId) {
        await updateDoc(doc(db, 'presentations', presId), data);
      } else {
        const ref = await addDoc(collection(db, 'presentations'), { ...data, createdAt: serverTimestamp() });
        setPresId(ref.id);
        if (onSaved) onSaved(ref.id);
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      alert('Error guardando: ' + e.message);
    }
    setSaving(false);
  };

  const handleGenerate = async () => {
    if (!aiTopic.trim()) return;
    setGenerating(true);
    setAiError('');
    try {
      const generated = await generateWithGemini(aiTopic, aiSlides, aiTheme);
      setSlides(generated);
      setActiveIdx(0);
      setShowAI(false);
      setTitulo(aiTopic);
    } catch (e) {
      setAiError('Error generando: ' + e.message);
    }
    setGenerating(false);
  };

  const handlePreview = async () => {
    let id = presId;
    if (!id) {
      setSaving(true);
      try {
        const data = { titulo, slides, uid: usuario.uid, profesorNombre: usuario.displayName || '', updatedAt: serverTimestamp(), createdAt: serverTimestamp() };
        const ref = await addDoc(collection(db, 'presentations'), data);
        id = ref.id;
        setPresId(id);
        if (onSaved) onSaved(id);
      } catch (e) { alert('Error al guardar para previsualizar: ' + e.message); setSaving(false); return; }
      setSaving(false);
    }
    window.open(`/pikt-viewer.html?id=${id}`, '_blank');
  };

  const convertToFree = () => {
    const elements = migrateToElements(activeSlide);
    updateSlide({ ...activeSlide, layout: 'free', elements });
  };

  // Reset free-canvas selection when switching slides
  useEffect(() => { setSelectedFreeElId(null); }, [activeIdx]);

  const updateFreeEl = (updates) => {
    if (!selectedFreeElId || !activeSlide) return;
    const elements = (activeSlide.elements || []).map(e => e.id === selectedFreeElId ? { ...e, ...updates } : e);
    updateSlide({ ...activeSlide, elements });
  };
  const deleteFreeEl = () => {
    if (!selectedFreeElId) return;
    updateSlide({ ...activeSlide, elements: (activeSlide.elements || []).filter(e => e.id !== selectedFreeElId) });
    setSelectedFreeElId(null);
  };
  const duplicateFreeEl = () => {
    if (!selectedFreeEl) return;
    const newEl = { ...selectedFreeEl, id: `el_${Date.now()}`, x: selectedFreeEl.x + 3, y: selectedFreeEl.y + 3 };
    updateSlide({ ...activeSlide, elements: [...(activeSlide.elements || []), newEl] });
    setSelectedFreeElId(newEl.id);
  };
  const bringFwdFreeEl = () => {
    if (!selectedFreeElId) return;
    const els = [...(activeSlide.elements || [])];
    const idx = els.findIndex(e => e.id === selectedFreeElId);
    if (idx < els.length - 1) { [els[idx], els[idx+1]] = [els[idx+1], els[idx]]; updateSlide({ ...activeSlide, elements: els }); }
  };
  const sendBckFreeEl = () => {
    if (!selectedFreeElId) return;
    const els = [...(activeSlide.elements || [])];
    const idx = els.findIndex(e => e.id === selectedFreeElId);
    if (idx > 0) { [els[idx], els[idx-1]] = [els[idx-1], els[idx]]; updateSlide({ ...activeSlide, elements: els }); }
  };

  const theme = THEMES[activeSlide?.theme] || THEMES.dark;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 500, display: 'flex', flexDirection: 'column', background: '#111827', fontFamily: "'Inter', 'Segoe UI', Arial, sans-serif", color: '#fff', overflow: 'hidden' }}>

      {/* TOP BAR */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 20px', background: '#1f2937', borderBottom: '1px solid #374151', flexShrink: 0 }}>
        <button onClick={onClose} style={{ background: '#374151', color: '#9ca3af', border: 'none', borderRadius: 8, padding: '6px 12px', cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>← Volver</button>
        <input
          value={titulo} onChange={e => setTitulo(e.target.value)}
          style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: '#fff', fontSize: 16, fontWeight: 700, minWidth: 0 }}
          placeholder="Título de la presentación"
        />
        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
          <button onClick={() => setShowAI(true)} style={{ background: 'linear-gradient(135deg, #6c63ff, #a855f7)', color: '#fff', border: 'none', borderRadius: 8, padding: '7px 16px', cursor: 'pointer', fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
            🤖 Generar con IA
          </button>
          <button onClick={handlePreview} style={{ background: '#374151', color: '#e5e7eb', border: 'none', borderRadius: 8, padding: '7px 14px', cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>
            👁️ Vista previa
          </button>
          <button onClick={handleSave} disabled={saving} style={{ background: saved ? '#10b981' : '#6c63ff', color: '#fff', border: 'none', borderRadius: 8, padding: '7px 16px', cursor: 'pointer', fontSize: 13, fontWeight: 700, minWidth: 90 }}>
            {saving ? 'Guardando…' : saved ? '✓ Guardado' : '💾 Guardar'}
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden', position: 'relative' }}>

        {/* LEFT: SLIDE LIST */}
        <div style={{
          width: 160, flexShrink: 0,
          ...(isMobile ? {
            position: 'absolute', top: 0, bottom: 0, left: 0, zIndex: 300, width: 200,
            transform: leftOpen ? 'translateX(0)' : 'translateX(-100%)',
            transition: 'transform 0.25s cubic-bezier(0.4,0,0.2,1)',
            boxShadow: leftOpen ? '6px 0 24px rgba(0,0,0,0.6)' : 'none',
          } : {}),
          background: '#111827', borderRight: '1px solid #374151', display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}>
          <div style={{ padding: '10px 10px 6px', fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 1 }}>
            Diapositivas ({slides.length})
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '0 8px 8px' }}>
            {slides.map((s, i) => (
              <SlideThumb key={s.id} slide={s} index={i} isActive={i === activeIdx} onClick={() => setActiveIdx(i)} onDelete={() => deleteSlide(i)} />
            ))}
          </div>
          <div style={{ padding: 8, borderTop: '1px solid #374151' }}>
            <button onClick={() => addSlide('content')} style={{ width: '100%', background: '#6c63ff', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 0', cursor: 'pointer', fontWeight: 700, fontSize: 13 }}>+ Añadir</button>
          </div>
        </div>

        {/* CENTER: CANVAS */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: isMobile ? '8px 10px 16px' : 24, background: '#0f172a', overflow: 'auto', gap: 16 }}>

          {/* Mobile panel toggles */}
          {isMobile && (
            <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', flexShrink: 0 }}>
              <button onClick={() => { setLeftOpen(o => !o); setRightOpen(false); }}
                style={{ background: leftOpen ? '#6c63ff' : '#374151', color: '#fff', border: 'none', borderRadius: 8, padding: '7px 14px', cursor: 'pointer', fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 5 }}>
                🖼️ {leftOpen ? 'Ocultar' : 'Slides'}
              </button>
              <button onClick={() => { setRightOpen(o => !o); setLeftOpen(false); }}
                style={{ background: rightOpen ? '#6c63ff' : '#374151', color: '#fff', border: 'none', borderRadius: 8, padding: '7px 14px', cursor: 'pointer', fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 5 }}>
                {rightOpen ? 'Ocultar' : '⚙️ Opciones'}
              </button>
            </div>
          )}

          <div style={{ width: '100%', maxWidth: 760 }}>
            {activeSlide && <SlideCanvas key={activeSlide.id} slide={activeSlide} onChange={updateSlide} usuario={usuario} onElementSelected={setSelectedFreeElId} />}
          </div>
          {/* Slide controls */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button onClick={() => moveSlide(activeIdx, activeIdx - 1)} disabled={activeIdx === 0} style={{ background: '#1f2937', color: '#9ca3af', border: 'none', borderRadius: 6, padding: '5px 10px', cursor: 'pointer' }}>◀</button>
            <span style={{ fontSize: 12, color: '#6b7280' }}>{activeIdx + 1} / {slides.length}</span>
            <button onClick={() => moveSlide(activeIdx, activeIdx + 1)} disabled={activeIdx === slides.length - 1} style={{ background: '#1f2937', color: '#9ca3af', border: 'none', borderRadius: 6, padding: '5px 10px', cursor: 'pointer' }}>▶</button>
          </div>
        </div>

        {/* RIGHT: PROPERTIES PANEL */}
        <div style={{
          width: 220, flexShrink: 0,
          ...(isMobile ? {
            position: 'absolute', top: 0, bottom: 0, right: 0, zIndex: 300, width: 250,
            transform: rightOpen ? 'translateX(0)' : 'translateX(100%)',
            transition: 'transform 0.25s cubic-bezier(0.4,0,0.2,1)',
            boxShadow: rightOpen ? '-6px 0 24px rgba(0,0,0,0.6)' : 'none',
          } : {}),
          background: '#1f2937', borderLeft: '1px solid #374151', display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}>
          {/* Tabs */}
          <div style={{ display: 'flex', borderBottom: '1px solid #374151' }}>
            {[['layout', '📐'], ['theme', '🎨'], ['settings', '⚙️']].map(([tab, icon]) => (
              <button key={tab} onClick={() => setRightTab(tab)} style={{
                flex: 1, background: rightTab === tab ? '#374151' : 'transparent', color: rightTab === tab ? '#fff' : '#6b7280',
                border: 'none', padding: '9px 0', cursor: 'pointer', fontSize: 11, fontWeight: 700,
              }}>{icon}</button>
            ))}
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: 12 }}>
            {rightTab === 'layout' && (
              <div>
                {selectedFreeEl ? (
                  <>
                    <ElementProperties
                      el={selectedFreeEl}
                      updateEl={updateFreeEl}
                      onDelete={deleteFreeEl}
                      onDuplicate={duplicateFreeEl}
                      onBringFwd={bringFwdFreeEl}
                      onSendBck={sendBckFreeEl}
                    />
                    <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid #374151' }}>
                      <button onClick={() => setSelectedFreeElId(null)} style={{ width: '100%', background: '#374151', color: '#9ca3af', border: 'none', borderRadius: 8, padding: '6px 0', cursor: 'pointer', fontSize: 11, fontWeight: 700 }}>
                        ✕ Deseleccionar
                      </button>
                    </div>
                  </>
                ) : (activeSlide?.layout === 'free' || (activeSlide?.elements||[]).length > 0) ? (
                  <>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 }}>Lienzo libre</div>
                    <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 12, lineHeight: 1.6 }}>
                      Selecciona un elemento para ver sus propiedades aquí.<br/>
                      <span style={{ color: '#4b5563' }}>Doble clic = editar · Supr = borrar · Ctrl+D = duplicar · Flechas = mover</span>
                    </div>
                    <button onClick={() => {
                      if (!window.confirm('¿Convertir a plantilla? Los elementos libres se convertirán a un diseño "Contenido".')) return;
                      const textEls = (activeSlide.elements || []).filter(e => e.type === 'text');
                      updateSlide({ ...activeSlide, layout: 'content', elements: undefined, heading: textEls[0]?.text?.split('\n')[0] || '', body: textEls.slice(1).map(e => e.text).join('\n') || '' });
                    }} style={{ width: '100%', background: '#374151', color: '#9ca3af', border: 'none', borderRadius: 8, padding: '7px 0', cursor: 'pointer', fontSize: 11, fontWeight: 700, marginBottom: 16 }}>
                      ↩ Volver a plantilla
                    </button>
                  </>
                ) : (
                  <>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>Diseño</div>
                    {LAYOUTS.filter(l => l.id !== 'free').map(l => (
                      <button key={l.id} onClick={() => {
                        if (activeSlide?.layout === l.id) return;
                        const hasContent = !!(activeSlide?.heading || activeSlide?.body || activeSlide?.subheading || activeSlide?.imageBase64 || activeSlide?.videoUrl || activeSlide?.resourceId);
                        if (hasContent && !window.confirm(`¿Cambiar a "${l.label}"? Se perderá el contenido escrito en esta diapositiva.`)) return;
                        updateSlide({ ...activeSlide, layout: l.id, ...JSON.parse(JSON.stringify(SLIDE_DEFAULTS[l.id] || {})) });
                      }}
                        style={{ width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', marginBottom: 4, background: activeSlide?.layout === l.id ? '#374151' : 'transparent', border: `1px solid ${activeSlide?.layout === l.id ? '#6c63ff' : '#374151'}`, borderRadius: 8, color: '#e5e7eb', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                        <span>{l.icon}</span><span>{l.label}</span>
                        {activeSlide?.layout === l.id && <span style={{ marginLeft: 'auto', color: '#6c63ff', fontSize: 10 }}>✓</span>}
                      </button>
                    ))}
                    <button onClick={convertToFree} style={{ width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', marginBottom: 4, background: 'transparent', border: '1px solid #374151', borderRadius: 8, color: '#9ca3af', cursor: 'pointer', fontSize: 12, fontWeight: 600, marginTop: 4 }}>
                      <span>✋</span><span>Convertir a libre</span>
                    </button>
                  </>
                )}
                <div style={{ marginTop: 12, fontSize: 11, fontWeight: 700, color: '#9ca3af', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>Añadir diapositiva</div>
                {LAYOUTS.map(l => (
                  <button key={`add-${l.id}`} onClick={() => addSlide(l.id)}
                    style={{ width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', marginBottom: 3, background: 'transparent', border: '1px solid #374151', borderRadius: 8, color: '#9ca3af', cursor: 'pointer', fontSize: 11 }}>
                    <span>{l.icon}</span><span>+ {l.label}</span>
                  </button>
                ))}
              </div>
            )}

            {rightTab === 'theme' && (
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>Tema de color</div>
                {Object.entries(THEMES).map(([key, th]) => (
                  <button key={key} onClick={() => updateSlide({ ...activeSlide, theme: key })}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', marginBottom: 6,
                      background: th.bg, border: `2px solid ${activeSlide?.theme === key ? th.accent : 'transparent'}`,
                      borderRadius: 10, cursor: 'pointer', color: th.text, fontWeight: 700, fontSize: 12,
                    }}>
                    <div style={{ width: 16, height: 16, borderRadius: '50%', background: th.accent, flexShrink: 0 }} />
                    {th.label}
                    {activeSlide?.theme === key && <span style={{ marginLeft: 'auto', fontSize: 10 }}>✓</span>}
                  </button>
                ))}
                <div style={{ marginTop: 12 }}>
                  <button onClick={() => { const t = activeSlide?.theme || 'dark'; setSlides(slides.map(s => ({ ...s, theme: t }))); }}
                    style={{ width: '100%', background: '#374151', color: '#9ca3af', border: 'none', borderRadius: 8, padding: '8px 0', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>
                    Aplicar a todas
                  </button>
                </div>
              </div>
            )}

            {rightTab === 'settings' && (
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>Duración de diapositiva</div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
                  {[3000, 4000, 5000, 7000, 10000].map(d => (
                    <button key={d} onClick={() => updateSlide({ ...activeSlide, duration: d })}
                      style={{ background: activeSlide?.duration === d ? '#6c63ff' : '#374151', color: '#fff', border: 'none', borderRadius: 6, padding: '5px 10px', cursor: 'pointer', fontSize: 11, fontWeight: 700 }}>
                      {d / 1000}s
                    </button>
                  ))}
                </div>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>Acciones</div>
                <button onClick={() => { const s = newSlide(activeSlide?.layout, activeSlide?.theme); const next = [...slides, s]; setSlides(next); setActiveIdx(next.length - 1); }}
                  style={{ width: '100%', background: '#374151', color: '#e5e7eb', border: 'none', borderRadius: 8, padding: '8px 0', cursor: 'pointer', fontSize: 12, fontWeight: 700, marginBottom: 6 }}>
                  + Duplicar diapositiva
                </button>
                <button onClick={() => deleteSlide(activeIdx)} disabled={slides.length <= 1}
                  style={{ width: '100%', background: '#7f1d1d', color: '#fca5a5', border: 'none', borderRadius: 8, padding: '8px 0', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>
                  🗑️ Eliminar
                </button>
              </div>
            )}
          </div>
        </div>
        {/* Mobile backdrop */}
        {isMobile && (leftOpen || rightOpen) && (
          <div onClick={() => { setLeftOpen(false); setRightOpen(false); }}
            style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 200 }}/>
        )}
      </div>

      {/* AI MODAL */}
      {showAI && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#1f2937', borderRadius: 20, padding: 32, width: '90%', maxWidth: 520, border: '1px solid #374151' }}>
            <h2 style={{ margin: '0 0 20px', fontSize: 22, fontWeight: 900, background: 'linear-gradient(135deg, #6c63ff, #a855f7)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              🤖 Generar presentación con IA
            </h2>
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: '#9ca3af', display: 'block', marginBottom: 6 }}>TEMA DE LA PRESENTACIÓN</label>
              <input
                value={aiTopic} onChange={e => setAiTopic(e.target.value)}
                placeholder="Ej: El sistema solar, La Revolución Francesa, Las fracciones..."
                style={{ width: '100%', background: '#111827', border: '2px solid #374151', borderRadius: 10, padding: '10px 14px', color: '#fff', fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
                onKeyDown={e => e.key === 'Enter' && handleGenerate()}
              />
            </div>
            <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#9ca3af', display: 'block', marginBottom: 6 }}>Nº DIAPOSITIVAS</label>
                <select value={aiSlides} onChange={e => setAiSlides(+e.target.value)} style={{ width: '100%', background: '#111827', border: '2px solid #374151', borderRadius: 10, padding: '9px 12px', color: '#fff', fontSize: 14, outline: 'none' }}>
                  {[4, 5, 6, 7, 8, 10].map(n => <option key={n} value={n}>{n} diapositivas</option>)}
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#9ca3af', display: 'block', marginBottom: 6 }}>TEMA DE COLOR</label>
                <select value={aiTheme} onChange={e => setAiTheme(e.target.value)} style={{ width: '100%', background: '#111827', border: '2px solid #374151', borderRadius: 10, padding: '9px 12px', color: '#fff', fontSize: 14, outline: 'none' }}>
                  {Object.entries(THEMES).map(([k, th]) => <option key={k} value={k}>{th.label}</option>)}
                </select>
              </div>
            </div>
            {aiError && <div style={{ background: '#7f1d1d', color: '#fca5a5', borderRadius: 8, padding: '8px 12px', marginBottom: 12, fontSize: 13 }}>{aiError}</div>}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => { setShowAI(false); setAiError(''); }} style={{ background: '#374151', color: '#9ca3af', border: 'none', borderRadius: 10, padding: '10px 20px', cursor: 'pointer', fontWeight: 700 }}>Cancelar</button>
              <button onClick={handleGenerate} disabled={generating || !aiTopic.trim()} style={{ background: generating ? '#374151' : 'linear-gradient(135deg, #6c63ff, #a855f7)', color: '#fff', border: 'none', borderRadius: 10, padding: '10px 24px', cursor: generating ? 'not-allowed' : 'pointer', fontWeight: 700, fontSize: 14, minWidth: 140 }}>
                {generating ? '⏳ Generando…' : '✨ Generar ahora'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
