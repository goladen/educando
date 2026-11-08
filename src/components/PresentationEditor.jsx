import { useState, useRef, useCallback, useEffect } from 'react';
import { db } from '../firebase';
import { collection, addDoc, updateDoc, doc, serverTimestamp, query, where, getDocs } from 'firebase/firestore';
import { callGeminiProxy, extractText } from '../geminiProxy';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import { THEMES } from './presentacion/temas';
import {
  BASE_W, BASE_H, PX_X, PX_Y, nid, cargarFuentes, ElementoContenido, estiloCaja, fondoCss,
  estiloEntrada, estiloBucle, duracionEntradas, KEYFRAMES_CSS, SuperficieEstatica, TRANSICIONES,
} from './presentacion/render';
import PanelPropiedades, { CLAVES_ESTILO, ordenarEls } from './presentacion/PanelPropiedades';
import { PanelElementos, PanelPlantillas, PanelCapas } from './presentacion/paneles';
import { PLANTILLAS } from './presentacion/plantillas';
import { ColorPicker, CampoDegradado, Deslizador } from './presentacion/ui';
import { useHistorial, comprimirImagen, proporcionImagen, clonarDiapositiva } from './presentacion/utilidades';

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

// ─── BOTONES DE LA BARRA DE AÑADIR ───────────────────────────────────────────
// (temas en ./presentacion/temas.js; dibujo de elementos en ./presentacion/render.jsx)
const FC_BTN = (bg, color, extra = {}) => ({
  background: bg, color, border: 'none', borderRadius: 8,
  padding: '5px 11px', cursor: 'pointer', fontSize: 11, fontWeight: 700, ...extra,
});

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
function SlideThumb({ slide, isActive, onClick, index, onDelete, onDuplicate, onMoveUp, onMoveDown, total, onDropThumb, ancho = 140 }) {
  const t = THEMES[slide.theme] || THEMES.dark;
  const [sobre, setSobre] = useState(false);
  const libre = slide.layout === 'free';
  const miniBtn = (bg) => ({ background: bg, color: 'white', border: 'none', borderRadius: 4, width: 16, height: 16, fontSize: 9, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1, padding: 0 });
  return (
    <div onClick={onClick} draggable
      onDragStart={e => { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/x-pk-slide', String(index)); }}
      onDragOver={e => { if ([...e.dataTransfer.types].includes('text/x-pk-slide')) { e.preventDefault(); setSobre(true); } }}
      onDragLeave={() => setSobre(false)}
      onDrop={e => { const de = e.dataTransfer.getData('text/x-pk-slide'); setSobre(false); if (de !== '') { e.preventDefault(); onDropThumb?.(+de, index); } }}
      style={{ position: 'relative', cursor: 'pointer', marginBottom: 8, paddingTop: 3, borderTop: sobre ? '3px solid #6c63ff' : '3px solid transparent' }}>
      <div style={{
        borderRadius: 8, overflow: 'hidden', width: ancho, aspectRatio: '16/9',
        boxShadow: isActive ? `0 0 0 2px #6c63ff, 0 0 0 4px rgba(108,99,255,0.3)` : '0 1px 4px rgba(0,0,0,0.3)',
        transition: 'box-shadow 0.2s', ...(libre ? {} : fondoCss(slide, t)),
      }}>
        {libre
          ? <SuperficieEstatica slide={slide} t={t} ancho={ancho} />
          : <div style={{ padding: '8px 10px', height: '100%', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', justifyContent: 'center', overflow: 'hidden' }}>
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
                        : <div style={{ fontSize: 14, textAlign: 'center', marginBottom: 2 }}>▶️</div>}
                      <div style={{ fontSize: 7, fontWeight: 700, color: t.text, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', textAlign: 'center' }}>{slide.heading || (parsed ? (parsed.type === 'youtube' ? 'YouTube' : parsed.type === 'vimeo' ? 'Vimeo' : 'Vídeo') : 'Sin vídeo')}</div>
                    </>;
                  })()
                : <>
                    <div style={{ fontSize: 9, fontWeight: 800, color: t.text, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{slide.heading || 'Sin título'}</div>
                    {slide.subheading && <div style={{ fontSize: 7, color: t.sub, marginTop: 2, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{slide.subheading}</div>}
                    <div style={{ fontSize: 6, color: t.accent, marginTop: 4, textTransform: 'uppercase', letterSpacing: 1 }}>{LAYOUTS.find(l => l.id === slide.layout)?.icon} {slide.layout}</div>
                  </>}
            </div>}
      </div>
      <div style={{ position: 'absolute', top: 6, left: 4, fontSize: 8, color: '#fff', fontWeight: 800, background: 'rgba(0,0,0,0.55)', borderRadius: 4, padding: '1px 4px' }}>{index + 1}</div>
      <div style={{ position: 'absolute', top: 6, right: 4, display: 'flex', gap: 2 }}>
        <button title="Duplicar diapositiva" onClick={e => { e.stopPropagation(); onDuplicate?.(); }} style={miniBtn('rgba(108,99,255,0.85)')}>⧉</button>
        <button title="Eliminar diapositiva" onClick={e => { e.stopPropagation(); onDelete(); }} style={miniBtn('rgba(239,68,68,0.85)')}>✕</button>
      </div>
      <div style={{ position: 'absolute', bottom: 2, right: 2, display: 'flex', flexDirection: 'column', gap: 1 }}>
        <button onClick={e => { e.stopPropagation(); onMoveUp?.(); }} disabled={index === 0}
          style={{ background: index === 0 ? 'rgba(55,65,81,0.5)' : 'rgba(108,99,255,0.8)', color: index === 0 ? '#555' : '#fff', border: 'none', borderRadius: 3, width: 14, height: 12, fontSize: 8, cursor: index === 0 ? 'default' : 'pointer', lineHeight: 1, padding: 0 }}>↑</button>
        <button onClick={e => { e.stopPropagation(); onMoveDown?.(); }} disabled={index === total - 1}
          style={{ background: index === total - 1 ? 'rgba(55,65,81,0.5)' : 'rgba(108,99,255,0.8)', color: index === total - 1 ? '#555' : '#fff', border: 'none', borderRadius: 3, width: 14, height: 12, fontSize: 8, cursor: index === total - 1 ? 'default' : 'pointer', lineHeight: 1, padding: 0 }}>↓</button>
      </div>
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

// ── Staff Y-position → MIDI note ─────────────────────────────────────────────
// Treble (step 0 = top line = F5=77). Each step = ls/2 down.
const _TREBLE_MIDI = [84,83,81,79,77,76,74,72,71,69,67,65,64,62,60,59,57,55,53,52,50,48,47];
// Bass   (step 0 = top line = A3=57). Each step = ls/2 down.
const _BASS_MIDI   = [62,60,59,57,55,53,52,50,48,47,45,43,41,40,38];

function yToMidi(noteY, staffItem) {
  if (!staffItem) return 60;
  const step = Math.round((noteY - staffItem.y) / (STAFF_LS / 2));
  if (staffItem.clef === 'fa') {
    return _BASS_MIDI[Math.max(0, Math.min(step + 3, _BASS_MIDI.length - 1))];
  }
  return _TREBLE_MIDI[Math.max(0, Math.min(step + 4, _TREBLE_MIDI.length - 1))];
}

function midiToName(midi) {
  const n = ['C','Db','D','Eb','E','F','Gb','G','Ab','A','Bb','B'];
  return `${n[midi % 12]}${Math.floor(midi / 12) - 1}`;
}

// note-type → duration in beats (quarter = 1)
const NOTE_BEATS = {
  redonda: 4, blanca: 2, negra: 1, corchea: 0.5, semicorchea: 0.25, fusa: 0.125,
  s_redonda: 4, s_blanca: 2, s_negra: 1, s_corchea: 0.5,
};

function MusicPanel({ onInsert, onClose }) {
  const [items, setItems] = useState([]);
  const [staffY] = useState(80);
  const [hasStaff, setHasStaff] = useState(false);
  const [selectedTool, setSelectedTool] = useState(null);
  const [cursorX, setCursorX] = useState(null);
  const [bpm, setBpm] = useState(90);
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playingIdx, setPlayingIdx] = useState(null);
  const canvasRef = useRef(null);
  const acRef = useRef(null);
  const pianoRef = useRef(null);
  const stopRef = useRef(false);

  const drawAll = (ctx, its, curX, pIdx = null) => {
    ctx.clearRect(0, 0, CNVS_W, CNVS_H);
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, CNVS_W, CNVS_H);
    its.forEach(item => {
      if (item.t === 'staff') drawStaff(ctx, item);
      else if (item.t === 'note') drawNote(ctx, item);
      else if (item.t === 'rest') drawRest(ctx, item);
      else if (item.t === 'acc') drawAccidental(ctx, item);
    });
    // Cursor line
    if (curX !== null) {
      ctx.save(); ctx.strokeStyle = '#6c63ff'; ctx.lineWidth = 1.5;
      ctx.setLineDash([5, 3]);
      ctx.beginPath(); ctx.moveTo(curX, 5); ctx.lineTo(curX, CNVS_H - 5); ctx.stroke();
      ctx.restore();
    }
    // Playing highlight
    if (pIdx !== null) {
      const seq = its.filter(i => i.t === 'note' || i.t === 'rest').sort((a, b) => a.x - b.x);
      const pi = seq[pIdx];
      if (pi) {
        ctx.save(); ctx.strokeStyle = '#ef4444'; ctx.lineWidth = 2.5;
        ctx.setLineDash([]);
        ctx.beginPath(); ctx.arc(pi.x, pi.y, 18, 0, Math.PI * 2); ctx.stroke();
        ctx.restore();
      }
    }
  };
  useEffect(() => {
    const cv = canvasRef.current; if (!cv) return;
    drawAll(cv.getContext('2d'), items, cursorX, playingIdx);
  }, [items, cursorX, playingIdx]); // eslint-disable-line

  // ── Audio ──────────────────────────────────────────────────────────────────
  const getAC = () => {
    if (!acRef.current) acRef.current = new (window.AudioContext || window.webkitAudioContext)();
    if (acRef.current.state === 'suspended') acRef.current.resume();
    return acRef.current;
  };

  const loadPiano = async () => {
    if (pianoRef.current) return pianoRef.current;
    setIsLoadingAudio(true);
    try {
      const { default: Soundfont } = await import('soundfont-player');
      pianoRef.current = await Soundfont.instrument(getAC(), 'acoustic_grand_piano', { soundfont: 'MusyngKite' });
    } catch (e) {
      alert('No se pudo cargar el piano. Comprueba la conexión a internet.'); throw e;
    } finally { setIsLoadingAudio(false); }
    return pianoRef.current;
  };

  const handlePlay = async () => {
    const seq = items.filter(i => i.t === 'note' || i.t === 'rest').sort((a, b) => a.x - b.x);
    if (!seq.length) return;
    const staffItem = items.find(i => i.t === 'staff');
    let piano;
    try { piano = await loadPiano(); } catch { return; }
    setIsPlaying(true); stopRef.current = false;
    const secPerBeat = 60 / bpm;
    for (let i = 0; i < seq.length; i++) {
      if (stopRef.current) break;
      setPlayingIdx(i);
      const item = seq[i];
      const dur = (NOTE_BEATS[item.figura] || 1) * secPerBeat;
      if (item.t === 'note') {
        const noteName = midiToName(yToMidi(item.y, staffItem));
        piano.play(noteName, getAC().currentTime, { duration: dur * 0.9, gain: 0.85 });
      }
      await new Promise(r => setTimeout(r, dur * 1000));
    }
    setIsPlaying(false); setPlayingIdx(null);
  };

  const handleStop = () => {
    stopRef.current = true;
    if (pianoRef.current) pianoRef.current.stop();
    setIsPlaying(false); setPlayingIdx(null);
  };

  const canvasCoords = (e) => {
    const cv = canvasRef.current; if (!cv) return null;
    const r = cv.getBoundingClientRect();
    return {
      x: Math.round((e.clientX - r.left) * (CNVS_W / r.width)),
      y: Math.round((e.clientY - r.top)  * (CNVS_H / r.height)),
    };
  };

  const handleCanvasClick = (e) => {
    const pos = canvasCoords(e); if (!pos) return;
    setCursorX(pos.x);
    if (!selectedTool) return;
    if (!hasStaff) { alert('Primero añade un pentagrama'); return; }
    const { x, y } = pos;
    if (selectedTool.t === 'note') {
      setItems(prev => [...prev, { t:'note', figura:selectedTool.figura, x, y, ls:STAFF_LS, color:'#111', stemUp: y >= staffY + STAFF_LS }]);
    } else if (selectedTool.t === 'rest') {
      setItems(prev => [...prev, { t:'rest', figura:selectedTool.figura, x, y, ls:STAFF_LS, color:'#111' }]);
    } else if (selectedTool.t === 'acc') {
      setItems(prev => [...prev, { t:'acc', figura:selectedTool.figura, x, y, ls:STAFF_LS, color:'#111' }]);
    }
  };

  const addStaff = (clef) => {
    setItems(prev => [...prev, { t:'staff', x:30, y:staffY, w:CNVS_W-60, ls:STAFF_LS, clef }]);
    setHasStaff(true); setCursorX(80);
  };
  const undo = () => setItems(prev => {
    const n = [...prev]; n.pop();
    if (!n.some(i => i.t === 'staff')) { setHasStaff(false); setCursorX(null); }
    return n;
  });
  const clear = () => { setItems([]); setHasStaff(false); setCursorX(null); setSelectedTool(null); };

  const handleInsert = () => {
    const cv = document.createElement('canvas');
    cv.width = CNVS_W; cv.height = CNVS_H;
    const ctx = cv.getContext('2d');
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, CNVS_W, CNVS_H);
    items.forEach(item => {
      if (item.t === 'staff') drawStaff(ctx, item);
      else if (item.t === 'note') drawNote(ctx, item);
      else if (item.t === 'rest') drawRest(ctx, item);
      else if (item.t === 'acc') drawAccidental(ctx, item);
    });
    onInsert({ imageData: cv.toDataURL('image/png'), items: [...items], bpm });
  };

  const ToolBtn = ({ label, t, figura }) => {
    const active = selectedTool?.t === t && selectedTool?.figura === figura;
    return (
      <button key={`${t}-${figura}`}
        onClick={() => setSelectedTool(active ? null : { t, figura })}
        style={{ background: active ? '#6c63ff' : '#374151', color: '#fff', border: `2px solid ${active ? '#a78bfa' : 'transparent'}`, borderRadius:6, padding:'4px 8px', cursor:'pointer', fontSize:11, fontWeight:700, whiteSpace:'nowrap' }}>
        {label}
      </button>
    );
  };

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.75)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:3000 }}>
      <div style={{ background:'#1f2937', borderRadius:16, padding:20, width:'95vw', maxWidth:680, maxHeight:'90vh', overflowY:'auto', border:'1px solid #374151' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
          <h3 style={{ margin:0, color:'#fff', fontSize:16, fontWeight:900 }}>🎵 Pentagrama Musical</h3>
          <button onClick={onClose} style={{ background:'none', border:'none', color:'#9ca3af', fontSize:20, cursor:'pointer' }}>✕</button>
        </div>

        <div style={{ fontSize:11, color: selectedTool ? '#a78bfa' : '#6b7280', marginBottom:10, fontWeight:700, background: selectedTool ? 'rgba(108,99,255,0.12)' : 'transparent', padding:'5px 8px', borderRadius:6 }}>
          {selectedTool
            ? `✅ Seleccionado — haz clic en el pentagrama para colocar el símbolo`
            : 'Selecciona un símbolo y haz clic donde quieras colocarlo en el pentagrama'}
        </div>

        {/* Staff controls */}
        <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:10 }}>
          <span style={{ fontSize:11, color:'#9ca3af', alignSelf:'center', fontWeight:700 }}>Pentagrama:</span>
          <button key="sol" onClick={() => addStaff('sol')} style={{ background:'#1d4ed8', color:'#fff', border:'none', borderRadius:6, padding:'4px 8px', cursor:'pointer', fontSize:11, fontWeight:700 }}>𝄞 Clave Sol</button>
          <button key="fa"  onClick={() => addStaff('fa')}  style={{ background:'#1d4ed8', color:'#fff', border:'none', borderRadius:6, padding:'4px 8px', cursor:'pointer', fontSize:11, fontWeight:700 }}>𝄢 Clave Fa</button>
          <button key="undo" onClick={undo}  style={{ background:'#374151', color:'#9ca3af', border:'none', borderRadius:6, padding:'4px 8px', cursor:'pointer', fontSize:11, fontWeight:700 }}>↩ Deshacer</button>
          <button key="clr"  onClick={clear} style={{ background:'rgba(239,68,68,0.2)', color:'#f87171', border:'none', borderRadius:6, padding:'4px 8px', cursor:'pointer', fontSize:11, fontWeight:700 }}>🗑 Limpiar</button>
        </div>

        <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:6 }}>
          <span style={{ fontSize:11, color:'#9ca3af', alignSelf:'center', fontWeight:700 }}>Notas:</span>
          {MUSIC_NOTES.map(n => <ToolBtn key={n.id} label={`${n.sym} ${n.label}`} t="note" figura={n.id} />)}
        </div>
        <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:6 }}>
          <span style={{ fontSize:11, color:'#9ca3af', alignSelf:'center', fontWeight:700 }}>Silencios:</span>
          {MUSIC_RESTS.map(r => <ToolBtn key={r.id} label={`${r.sym} ${r.label}`} t="rest" figura={r.id} />)}
        </div>
        <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:10 }}>
          <span style={{ fontSize:11, color:'#9ca3af', alignSelf:'center', fontWeight:700 }}>Accidentales:</span>
          {MUSIC_ACCS.map(a => <ToolBtn key={a.id} label={`${a.sym} ${a.label}`} t="acc" figura={a.id} />)}
        </div>

        <div style={{ background:'#fff', borderRadius:8, overflow:'hidden', marginBottom:10, cursor: selectedTool ? 'crosshair' : 'default' }}>
          <canvas ref={canvasRef} width={CNVS_W} height={CNVS_H}
            style={{ width:'100%', height:'auto', display:'block' }}
            onClick={handleCanvasClick} />
        </div>

        {selectedTool && (
          <div style={{ marginBottom:8, textAlign:'center' }}>
            <button onClick={() => setSelectedTool(null)} style={{ background:'rgba(108,99,255,0.15)', color:'#a78bfa', border:'1px solid rgba(108,99,255,0.3)', borderRadius:8, padding:'4px 14px', cursor:'pointer', fontSize:11, fontWeight:700 }}>
              ✕ Deseleccionar
            </button>
          </div>
        )}

        {/* BPM + Play controls */}
        <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:10, background:'rgba(255,255,255,0.04)', borderRadius:10, padding:'8px 12px' }}>
          <span style={{ fontSize:11, color:'#9ca3af', fontWeight:700, whiteSpace:'nowrap' }}>BPM:</span>
          <input type="range" min={40} max={200} value={bpm} onChange={e => setBpm(+e.target.value)}
            style={{ flex:1, accentColor:'#6c63ff' }} />
          <span style={{ fontSize:12, color:'#e5e7eb', fontWeight:800, minWidth:32, textAlign:'right' }}>{bpm}</span>
          <div style={{ display:'flex', gap:6 }}>
            {isPlaying ? (
              <button onClick={handleStop} style={{ background:'rgba(239,68,68,0.2)', color:'#f87171', border:'1px solid rgba(239,68,68,0.4)', borderRadius:8, padding:'6px 14px', cursor:'pointer', fontWeight:800, fontSize:13 }}>
                ⏹ Stop
              </button>
            ) : (
              <button onClick={handlePlay}
                disabled={isLoadingAudio || items.filter(i=>i.t==='note'||i.t==='rest').length === 0}
                style={{ background: isLoadingAudio || items.filter(i=>i.t==='note'||i.t==='rest').length===0 ? '#374151' : 'rgba(52,211,153,0.2)', color: isLoadingAudio || items.filter(i=>i.t==='note'||i.t==='rest').length===0 ? '#6b7280' : '#34d399', border:'1px solid rgba(52,211,153,0.4)', borderRadius:8, padding:'6px 14px', cursor: isLoadingAudio || items.filter(i=>i.t==='note'||i.t==='rest').length===0 ? 'not-allowed' : 'pointer', fontWeight:800, fontSize:13 }}>
                {isLoadingAudio ? '⏳' : '▶ Play'}
              </button>
            )}
          </div>
        </div>

        <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
          <button onClick={onClose} style={{ background:'#374151', color:'#9ca3af', border:'none', borderRadius:10, padding:'9px 20px', cursor:'pointer', fontWeight:700 }}>Cancelar</button>
          <button onClick={handleInsert} disabled={items.length === 0}
            style={{ background: items.length === 0 ? '#374151' : '#6c63ff', color:'#fff', border:'none', borderRadius:10, padding:'9px 24px', cursor: items.length === 0 ? 'not-allowed' : 'pointer', fontWeight:700 }}>
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

function MathEquationModal({ onInsert, onClose, initialLatex = '' }) {
  const [latex, setLatex] = useState(initialLatex);
  const [catIdx, setCatIdx] = useState(0);
  const [error, setError] = useState('');
  const inputRef = useRef(null);
  const previewRef = useRef(null);
  const isEdit = !!initialLatex;

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

  const handleInsert = () => {
    if (!latex.trim()) return;
    onInsert(latex.trim());
  };

  const cat = MATH_KEYS[catIdx];

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.8)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:3000 }}>

      <div style={{ background:'#1f2937', borderRadius:16, padding:20, width:'95vw', maxWidth:680, maxHeight:'90vh', overflowY:'auto', border:'1px solid #374151' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
          <h3 style={{ margin:0, color:'#fff', fontSize:16, fontWeight:900 }}>{isEdit ? '✏️ Editar Ecuación' : '∑ Nueva Ecuación'}</h3>
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
            {isEdit ? '✓ Actualizar' : '📌 Insertar ecuación'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── FREE CANVAS: constantes ──────────────────────────────────────────────────
const FC_STICKERS = ['⭐','🔥','✅','❌','💡','🎯','👍','📌','⚠️','🏆','🌈','🎨'];
// Asas de redimensionar: dirección en x e y (-1, 0, 1)
const HANDLES = { nw: [-1, -1], n: [0, -1], ne: [1, -1], e: [1, 0], se: [1, 1], s: [0, 1], sw: [-1, 1], w: [-1, 0] };
const CURSOR_ASA = { nw: 'nwse-resize', se: 'nwse-resize', ne: 'nesw-resize', sw: 'nesw-resize', n: 'ns-resize', s: 'ns-resize', e: 'ew-resize', w: 'ew-resize' };
const UMBRAL_X = 0.8, UMBRAL_Y = 1.3; // distancia (en %) a la que se "imanta" a una guía

// Elemento imagen centrado que respeta la proporción real de la foto
function imagenEl(src, ratio = 4 / 3, extra = {}) {
  let wpx = BASE_W * 0.5, hpx = wpx / ratio;
  if (hpx > BASE_H * 0.7) { hpx = BASE_H * 0.7; wpx = hpx * ratio; }
  const w = wpx / PX_X, h = hpx / PX_Y;
  return { id: nid(), type: 'image', src, x: (100 - w) / 2, y: (100 - h) / 2, w, h, objectFit: 'cover', borderRadius: 0, opacity: 1, ...extra };
}

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

// Lienzo de elementos (controlado: la selección y la edición viven en el editor).
// Los elementos se dibujan en una superficie fija de 960×540 escalada al tamaño real.
function FreeCanvas({ slide, t, isFree, selIds, setSelIds, editingId, setEditingId, onChangeEls, onCortar, onEquationEdit, onMarco, onSeleccionCanvas, previewAnim, rejilla }) {
  const wrapRef = useRef(null);
  const surfRef = useRef(null);
  const [k, setK] = useState(1);
  const [guias, setGuias] = useState([]);
  const [marquee, setMarquee] = useState(null);
  const [rotTip, setRotTip] = useState(null);
  const elements = slide.elements || [];
  const elsRef = useRef(elements);
  elsRef.current = elements;
  const isMob = window.innerWidth < 640;

  useEffect(() => {
    const el = wrapRef.current; if (!el) return;
    const medir = () => setK((el.clientWidth || BASE_W) / BASE_W);
    medir();
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const puntoSup = (e) => {
    const r = surfRef.current.getBoundingClientRect();
    return { x: (e.clientX - r.left) / r.width * 100, y: (e.clientY - r.top) / r.height * 100 };
  };
  const arrastrar = (onMove, onUp) => {
    const mv = ev => onMove(ev);
    const up = ev => {
      window.removeEventListener('pointermove', mv);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      onUp?.(ev);
    };
    window.addEventListener('pointermove', mv);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  };

  // Guías inteligentes: bordes y centros de la página y de los demás elementos
  const ajustar = (b, otros, sinIman) => {
    if (sinIman) return { dx: 0, dy: 0, g: [] };
    const cx = [0, 50, 100], cy = [0, 50, 100];
    otros.forEach(o => { cx.push(o.x, o.x + o.w / 2, o.x + o.w); cy.push(o.y, o.y + o.h / 2, o.y + o.h); });
    let mx = null, my = null;
    for (const m of [b.x0, (b.x0 + b.x1) / 2, b.x1]) for (const c of cx) {
      const d = c - m; if (Math.abs(d) < UMBRAL_X && (!mx || Math.abs(d) < Math.abs(mx.d))) mx = { d, v: c };
    }
    for (const m of [b.y0, (b.y0 + b.y1) / 2, b.y1]) for (const c of cy) {
      const d = c - m; if (Math.abs(d) < UMBRAL_Y && (!my || Math.abs(d) < Math.abs(my.d))) my = { d, v: c };
    }
    const g = [];
    if (mx) g.push({ eje: 'x', v: mx.v });
    if (my) g.push({ eje: 'y', v: my.v });
    return { dx: mx?.d || 0, dy: my?.d || 0, g };
  };

  // ── Mover (uno o varios) ──
  const onElDown = (e, el) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    if (editingId === el.id) return;
    if (e.shiftKey || e.ctrlKey || e.metaKey) {
      setSelIds(selIds.includes(el.id) ? selIds.filter(i => i !== el.id) : [...selIds, el.id]);
      onSeleccionCanvas?.();
      return;
    }
    let ids = selIds;
    if (!selIds.includes(el.id)) { ids = [el.id]; setSelIds(ids); }
    onSeleccionCanvas?.();
    if (editingId) setEditingId(null);
    const mov = elsRef.current.filter(x => ids.includes(x.id) && !x.locked);
    if (!mov.length) return;
    const p0 = puntoSup(e);
    const ini = new Map(mov.map(m => [m.id, { x: m.x, y: m.y, w: m.w, h: m.h }]));
    const otros = elsRef.current.filter(x => !ids.includes(x.id) && !x.hidden);
    const b0 = {
      x0: Math.min(...mov.map(m => m.x)), y0: Math.min(...mov.map(m => m.y)),
      x1: Math.max(...mov.map(m => m.x + m.w)), y1: Math.max(...mov.map(m => m.y + m.h)),
    };
    let movido = false;
    onCortar?.();
    arrastrar(ev => {
      const p = puntoSup(ev);
      let dx = p.x - p0.x, dy = p.y - p0.y;
      if (!movido && Math.abs(dx) < 0.3 && Math.abs(dy) < 0.5) return;
      movido = true;
      if (ev.shiftKey) { if (Math.abs(dx * PX_X) > Math.abs(dy * PX_Y)) dy = 0; else dx = 0; }
      const s = ajustar({ x0: b0.x0 + dx, x1: b0.x1 + dx, y0: b0.y0 + dy, y1: b0.y1 + dy }, otros, ev.altKey);
      dx += s.dx; dy += s.dy;
      setGuias(s.g);
      onChangeEls(els => els.map(x => {
        const o = ini.get(x.id);
        if (!o) return x;
        return { ...x, x: Math.min(98, Math.max(2 - o.w, o.x + dx)), y: Math.min(98, Math.max(2 - o.h, o.y + dy)) };
      }));
    }, () => setGuias([]));
  };

  // ── Redimensionar (respeta el giro: el lado contrario queda fijo) ──
  const onHandleDown = (e, el, h) => {
    e.stopPropagation(); e.preventDefault();
    if (el.locked) return;
    onCortar?.();
    const [sx, sy] = HANDLES[h];
    const r = (el.rotation || 0) * Math.PI / 180, cos = Math.cos(r), sin = Math.sin(r);
    const w0 = el.w * PX_X, h0 = el.h * PX_Y;
    const c0 = { x: (el.x + el.w / 2) * PX_X, y: (el.y + el.h / 2) * PX_Y };
    const anc = { x: -sx * w0 / 2, y: -sy * h0 / 2 };
    const ancW = { x: c0.x + anc.x * cos - anc.y * sin, y: c0.y + anc.x * sin + anc.y * cos };
    const p0 = puntoSup(e);
    const ratio = w0 / h0;
    const f0 = el.fontSize || (el.type === 'equation' ? 28 : 16);
    const escalaTexto = el.type === 'text' || el.type === 'equation';
    arrastrar(ev => {
      const p = puntoSup(ev);
      const dX = (p.x - p0.x) * PX_X, dY = (p.y - p0.y) * PX_Y;
      const lx = dX * cos + dY * sin, ly = -dX * sin + dY * cos;
      let w = sx ? Math.max(10, w0 + sx * lx) : w0;
      let hh = sy ? Math.max(8, h0 + sy * ly) : h0;
      const esquina = sx && sy;
      const mantener = esquina && ((el.type === 'image' || escalaTexto) ? !ev.shiftKey : ev.shiftKey);
      if (mantener) { if (w / hh > ratio) hh = w / ratio; else w = hh * ratio; }
      const a2 = { x: -sx * w / 2, y: -sy * hh / 2 };
      const c = { x: ancW.x - (a2.x * cos - a2.y * sin), y: ancW.y - (a2.x * sin + a2.y * cos) };
      const upd = { x: (c.x - w / 2) / PX_X, y: (c.y - hh / 2) / PX_Y, w: w / PX_X, h: hh / PX_Y };
      if (mantener && escalaTexto) upd.fontSize = Math.max(6, Math.round(f0 * w / w0));
      onChangeEls(els => els.map(x => (x.id === el.id ? { ...x, ...upd } : x)));
    });
  };

  // ── Girar ──
  const onRotDown = (e, el) => {
    e.stopPropagation(); e.preventDefault();
    if (el.locked) return;
    onCortar?.();
    const r = surfRef.current.getBoundingClientRect();
    const cx = r.left + (el.x + el.w / 2) / 100 * r.width;
    const cy = r.top + (el.y + el.h / 2) / 100 * r.height;
    arrastrar(ev => {
      let ang = Math.atan2(ev.clientY - cy, ev.clientX - cx) * 180 / Math.PI - 90;
      if (ev.shiftKey) ang = Math.round(ang / 15) * 15;
      else { const s = Math.round(ang / 45) * 45; if (Math.abs(ang - s) < 4) ang = s; }
      ang = ((ang % 360) + 540) % 360 - 180;
      setRotTip(Math.round(ang));
      onChangeEls(els => els.map(x => (x.id === el.id ? { ...x, rotation: Math.round(ang * 10) / 10 } : x)));
    }, () => setRotTip(null));
  };

  // ── Fondo: deseleccionar o seleccionar con recuadro ──
  const onFondoDown = (e) => {
    if (e.button !== 0) return;
    if (editingId) setEditingId(null);
    const p0 = puntoSup(e);
    const base = e.shiftKey ? selIds : [];
    let movido = false;
    arrastrar(ev => {
      const p = puntoSup(ev);
      if (!movido && Math.hypot(p.x - p0.x, p.y - p0.y) < 0.8) return;
      movido = true;
      setMarquee({ x0: Math.min(p0.x, p.x), y0: Math.min(p0.y, p.y), x1: Math.max(p0.x, p.x), y1: Math.max(p0.y, p.y) });
    }, ev => {
      if (!movido) { setSelIds(base); setMarquee(null); return; }
      const p = puntoSup(ev);
      const m = { x0: Math.min(p0.x, p.x), y0: Math.min(p0.y, p.y), x1: Math.max(p0.x, p.x), y1: Math.max(p0.y, p.y) };
      const dentro = elsRef.current.filter(x => !x.hidden && x.x < m.x1 && x.x + x.w > m.x0 && x.y < m.y1 && x.y + x.h > m.y0).map(x => x.id);
      setSelIds([...new Set([...base, ...dentro])]);
      if (dentro.length) onSeleccionCanvas?.();
      setMarquee(null);
    });
  };

  const onDoble = (e, el) => {
    e.stopPropagation();
    if (el.locked) return;
    if (el.marco) { onMarco?.(el.id); return; }
    if (el.type === 'text' || (el.type === 'shape' && el.shapeType !== 'line')) { setSelIds([el.id]); setEditingId(el.id); }
    else if (el.type === 'equation') onEquationEdit?.(el.id);
  };

  const sel = elements.filter(e => selIds.includes(e.id));
  const unico = sel.length === 1 ? sel[0] : null;
  const ib = 1 / (k || 1);
  const HS = (isMob ? 16 : 11) * ib;

  return (
    <div ref={wrapRef} onPointerDown={isFree ? onFondoDown : undefined}
      style={{ position: 'absolute', inset: 0, overflow: 'hidden', zIndex: 2, pointerEvents: isFree ? 'auto' : 'none', touchAction: isFree ? 'none' : 'auto' }}>
      {!isFree && (selIds.length > 0 || editingId) && (
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'auto' }} onPointerDown={() => { setSelIds([]); setEditingId(null); }} />
      )}
      <div ref={surfRef} style={{ position: 'absolute', left: 0, top: 0, width: BASE_W, height: BASE_H, transform: `scale(${k})`, transformOrigin: '0 0' }}>
        {rejilla && (
          <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', backgroundImage: 'linear-gradient(rgba(148,163,184,0.28) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.28) 1px, transparent 1px)', backgroundSize: '48px 54px' }} />
        )}
        {elements.map(el => {
          const edit = editingId === el.id;
          const ent = previewAnim ? estiloEntrada(el.anim) : null;
          const bucle = previewAnim ? estiloBucle(el.anim) : null;
          return (
            <div key={el.id} onPointerDown={e => onElDown(e, el)} onDoubleClick={e => onDoble(e, el)}
              style={{ ...estiloCaja(el), opacity: el.hidden ? 0.25 : (el.opacity ?? 1), pointerEvents: 'auto', touchAction: 'none', cursor: edit ? 'text' : el.locked ? 'default' : 'move', userSelect: edit ? 'text' : 'none' }}>
              <div key={previewAnim || 0} style={{ width: '100%', height: '100%', ...ent }}>
                <div style={{ width: '100%', height: '100%', ...bucle }}>
                  <ElementoContenido el={el} t={t} editando={edit}
                    onTexto={txt => onChangeEls(els => els.map(x => (x.id === el.id ? { ...x, text: txt } : x)))}
                    onFinEdicion={() => setEditingId(null)} />
                </div>
              </div>
            </div>
          );
        })}

        {/* Marcos de selección, asas y giro */}
        {sel.map(el => (
          <div key={`sel_${el.id}`} style={{ ...estiloCaja(el, false), pointerEvents: 'none', outline: `${2 * ib}px solid ${el.locked ? '#f59e0b' : '#6c63ff'}`, outlineOffset: `${ib}px` }}>
            {el.locked && <div style={{ position: 'absolute', top: -20 * ib, left: 0, fontSize: 12 * ib, lineHeight: 1 }}>🔒</div>}
            {unico && !el.locked && editingId !== el.id && <>
              {Object.keys(HANDLES).map(h => {
                const [sx, sy] = HANDLES[h];
                const lateral = !sx || !sy;
                if (lateral && ((sx && el.h * PX_Y * k < 34) || (sy && el.w * PX_X * k < 34))) return null;
                return (
                  <div key={h} onPointerDown={e => onHandleDown(e, el, h)}
                    style={{
                      position: 'absolute', width: lateral && sy ? HS * 1.8 : HS, height: lateral && sx ? HS * 1.8 : HS,
                      left: `calc(${(sx + 1) * 50}% - ${(lateral && sy ? HS * 1.8 : HS) / 2}px)`,
                      top: `calc(${(sy + 1) * 50}% - ${(lateral && sx ? HS * 1.8 : HS) / 2}px)`,
                      background: '#fff', border: `${1.5 * ib}px solid #6c63ff`, borderRadius: lateral ? 4 * ib : '50%',
                      pointerEvents: 'auto', cursor: CURSOR_ASA[h], boxShadow: '0 1px 4px rgba(0,0,0,0.4)', boxSizing: 'border-box', touchAction: 'none',
                    }} />
                );
              })}
              <div style={{ position: 'absolute', left: '50%', top: `calc(100% + ${4 * ib}px)`, width: 1.5 * ib, height: 14 * ib, background: '#6c63ff', transform: 'translateX(-50%)' }} />
              <div onPointerDown={e => onRotDown(e, el)} title="Girar (Mayús = de 15° en 15°)"
                style={{ position: 'absolute', left: '50%', top: `calc(100% + ${16 * ib}px)`, width: 22 * ib, height: 22 * ib, transform: 'translateX(-50%)', background: '#fff', border: `${1.5 * ib}px solid #6c63ff`, borderRadius: '50%', pointerEvents: 'auto', cursor: 'grab', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13 * ib, color: '#6c63ff', touchAction: 'none', boxShadow: '0 1px 4px rgba(0,0,0,0.4)' }}>⟳</div>
            </>}
          </div>
        ))}

        {guias.map((g, i) => (g.eje === 'x'
          ? <div key={i} style={{ position: 'absolute', top: 0, bottom: 0, left: `${g.v}%`, width: ib, background: '#ec4899', pointerEvents: 'none', zIndex: 50 }} />
          : <div key={i} style={{ position: 'absolute', left: 0, right: 0, top: `${g.v}%`, height: ib, background: '#ec4899', pointerEvents: 'none', zIndex: 50 }} />))}
        {marquee && (
          <div style={{ position: 'absolute', left: `${marquee.x0}%`, top: `${marquee.y0}%`, width: `${marquee.x1 - marquee.x0}%`, height: `${marquee.y1 - marquee.y0}%`, background: 'rgba(108,99,255,0.12)', border: `${ib}px solid #6c63ff`, pointerEvents: 'none', zIndex: 50 }} />
        )}
      </div>
      {rotTip != null && (
        <div style={{ position: 'absolute', top: 8, left: '50%', transform: 'translateX(-50%)', background: 'rgba(17,24,39,0.9)', color: '#fff', fontSize: 12, fontWeight: 800, padding: '3px 10px', borderRadius: 10, pointerEvents: 'none', zIndex: 60 }}>⟳ {rotTip}°</div>
      )}
    </div>
  );
}

// ─── SLIDE CANVAS ─────────────────────────────────────────────────────────────
// canvas = props del lienzo (selección, edición, cambios…) que vienen del editor
function SlideCanvas({ slide, onChange, usuario, canvas, anadirEls, superficieRef, exportando, onAbrirElementos, onArchivos, editEquationId, setEditEquationId }) {
  const t = THEMES[slide.theme] || THEMES.dark;
  const fileRef = useRef();
  const imageFileRef = useRef();
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

  const mkText = (extra = {}) => ({
    id: nid(), type: 'text', x: 15, y: 25, w: 70, h: 20,
    text: 'Texto aquí', textAlign: 'left',
    fontSize: 24, fontWeight: 'normal', fontStyle: 'normal',
    textDecoration: 'none', color: null, lineHeight: 1.5, opacity: 1, ...extra,
  });
  const addHeading = () => anadirEls([mkText({ text: 'Título', textAlign: 'center', fontSize: 48, fontWeight: 'bold', y: 10, h: 22, lineHeight: 1.2 })], true);
  const addText = () => anadirEls([mkText()], true);
  const addSticker = (emoji) => {
    anadirEls([mkText({ text: emoji, textAlign: 'center', fontSize: 84, x: 44, y: 39, w: 12, h: 22, lineHeight: 1, vAlign: 'middle' })]);
    setShowStickers(false);
  };
  const handleImageFile = (e) => {
    const files = [...(e.target.files || [])];
    e.target.value = '';
    if (files.length) onArchivos(files);
  };
  const addYT = (url) => {
    const parsed = parseVideoUrl(url);
    if (!parsed || parsed.type !== 'youtube') { alert('URL de YouTube no reconocida'); return; }
    anadirEls([{ id: nid(), type: 'youtube', ytId: parsed.id, thumb: parsed.thumb, embed: parsed.embed, x: 15, y: 10, w: 70, h: 70, opacity: 1 }]);
    setShowYT(false);
  };
  const addWeb = (url) => {
    anadirEls([{ id: nid(), type: 'webview', src: url, x: 5, y: 5, w: 90, h: 85, opacity: 1 }]);
    setShowWeb(false);
  };
  const addFromSearch = async (imgUrl) => {
    setShowImgSearch(false);
    const r = await proporcionImagen(imgUrl);
    anadirEls([imagenEl(imgUrl, r)]);
  };
  const handleInsert3D = (base64) => {
    anadirEls([{ id: nid(), type: 'image', x: 15, y: 10, w: 55, h: 45, src: base64, objectFit: 'contain', borderRadius: 0, opacity: 1 }]);
    setShow3D(null);
  };
  const handleInsertMusic = ({ imageData, items, bpm }) => {
    anadirEls([{ id: nid(), type: 'music', x: 5, y: 25, w: 88, h: 30, src: imageData, items, bpm, objectFit: 'contain', borderRadius: 0, opacity: 1 }]);
    setShowMusic(false);
  };
  const handleInsertGeo = (src, wOrType, h) => {
    if (wOrType === 'text') {
      anadirEls([mkText({ text: src, fontSize: 20, fontWeight: 'bold', x: 10, y: 30, w: 50, h: 12 })]);
    } else {
      const w = typeof wOrType === 'number' ? wOrType : 75;
      anadirEls([{ id: nid(), type: 'image', x: 5, y: 5, src, w, h: h || 65, objectFit: 'contain', borderRadius: 0, opacity: 1 }]);
    }
    setShowGeo(false);
  };
  const handleInsertMath = (latex) => {
    anadirEls([{ id: nid(), type: 'equation', latex, x: 20, y: 30, w: 55, h: 18, fontSize: 36, color: null, opacity: 1 }]);
    setShowMath(false);
  };
  const handleEquationUpdate = (latex) => {
    onChange({ ...slide, elements: (slide.elements || []).map(e => e.id === editEquationId ? { ...e, latex } : e) });
    setEditEquationId(null);
  };

  const upd = (key, val) => onChange({ ...slide, [key]: val });

  const handleImage = async e => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    upd('imageBase64', await comprimirImagen(file));
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

  const onDrop = (e) => {
    const files = [...(e.dataTransfer?.files || [])].filter(f => f.type.startsWith('image/'));
    if (!files.length) return;
    e.preventDefault();
    const r = e.currentTarget.getBoundingClientRect();
    onArchivos(files, { x: (e.clientX - r.left) / r.width * 100, y: (e.clientY - r.top) / r.height * 100 });
  };

  return (
    <>
      <div ref={superficieRef}
        onDragOver={e => { if ([...e.dataTransfer.types].includes('Files')) e.preventDefault(); }}
        onDrop={onDrop}
        style={{ position: 'relative', width: '100%', aspectRatio: '16/9', ...fondoCss(slide, t), borderRadius: exportando ? 0 : 16, overflow: 'hidden', boxShadow: exportando ? 'none' : '0 8px 40px rgba(0,0,0,0.4)' }}>
        <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleImage} />
        <input ref={imageFileRef} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={handleImageFile} />
        {!isFree && <div style={{ position: 'relative', zIndex: 1, height: '100%' }}>{renderContent()}</div>}
        {isFree && (slide.elements || []).length === 0 && !exportando && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, pointerEvents: 'none', zIndex: 1, textAlign: 'center', padding: 20 }}>
            <div style={{ fontSize: 28 }}>✋</div>
            <div style={{ fontWeight: 700, fontSize: 13, color: t.text }}>Lienzo libre</div>
            <div style={{ fontSize: 11, color: t.sub, lineHeight: 1.6 }}>Elige un diseño en 🧩 Diseños, añade elementos en ➕ Añadir<br />o arrastra aquí imágenes desde tu ordenador</div>
          </div>
        )}
        <FreeCanvas slide={slide} t={t} isFree={isFree} {...canvas} onEquationEdit={setEditEquationId} />
      </div>

      {/* ── Add elements toolbar (all layouts) ── */}
      <div style={{display:'flex',gap:5,justifyContent:'center',flexWrap:'wrap',padding:'8px 4px 2px',position:'relative'}}>
        <button onClick={addHeading} style={FC_BTN('#374151','#e5e7eb')}>🔤 Título</button>
        <button onClick={addText} style={FC_BTN('#374151','#e5e7eb')}>T Texto</button>
        <button onClick={() => imageFileRef.current.click()} style={FC_BTN('#374151','#e5e7eb')}>🖼 Imagen</button>
        <button onClick={() => setShowImgSearch(true)} style={FC_BTN('#374151','#e5e7eb')}>🔍 Buscar</button>
        <button onClick={() => setShowYT(true)} style={FC_BTN('rgba(239,68,68,0.2)','#f87171',{border:'1px solid rgba(239,68,68,0.3)'})}>▶ YouTube</button>
        <button onClick={() => setShowWeb(true)} style={FC_BTN('#374151','#e5e7eb')}>🌐 Web</button>
        <button onClick={onAbrirElementos} style={FC_BTN('rgba(108,99,255,0.2)','#c4b5fd',{border:'1px solid rgba(108,99,255,0.4)'})}>⬟ Formas, textos y más</button>
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
        <select value={subject} onChange={e=>setSubject(e.target.value)}
          style={{background:'#1f2937',color:'#e5e7eb',border:'1px solid #374151',borderRadius:8,padding:'4px 8px',fontSize:11,fontWeight:700,cursor:'pointer',outline:'none'}}>
          <option value="general">🔬 Ciencias</option>
          <option value="musica">🎵 Música</option>
          <option value="geo">🌍 Geografía</option>
        </select>

        {subject === 'general' && <>
          {[['Cubo','prisma'],['Pirámide','pyramid'],['Cilindro','cylinder'],['Cono','cone'],['Esfera','sphere']].map(([label,shape])=>(
            <button key={shape} onClick={()=>setShow3D(shape)}
              style={FC_BTN('rgba(99,102,241,0.15)','#a5b4fc',{border:'1px solid rgba(99,102,241,0.3)'})}>
              {label}
            </button>
          ))}
        </>}

        {subject === 'musica' && (
          <button onClick={()=>setShowMusic(true)} style={FC_BTN('rgba(168,85,247,0.15)','#c084fc',{border:'1px solid rgba(168,85,247,0.3)'})}>
            🎵 Panel Música
          </button>
        )}

        {subject === 'geo' && (
          <button onClick={()=>setShowGeo(true)} style={FC_BTN('rgba(34,197,94,0.15)','#86efac',{border:'1px solid rgba(34,197,94,0.3)'})}>
            🌍 Panel Geografía
          </button>
        )}

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
      {editEquationId && <MathEquationModal initialLatex={(slide.elements||[]).find(e=>e.id===editEquationId)?.latex||''} onInsert={handleEquationUpdate} onClose={()=>setEditEquationId(null)} />}
    </>
  );
}

// ─── GENERACIÓN CON IA (Gemini aquí o prompt para la IA del profe) ─────────────
const LAYOUTS_IA = ['title', 'content', 'image-right', 'image-left', 'two-col', 'cta', 'map'];

export function construirPromptPresentacion({ tema, numSlides, nivel = '', idioma = 'español', extra = '' }) {
  return `Actúa como profesor/a experto/a y crea una presentación educativa SENCILLA para la web PiKT.

TEMA: "${tema || '[escribe aquí el tema]'}"
${nivel ? `NIVEL / CURSO: ${nivel}\n` : ''}IDIOMA: ${idioma}
NÚMERO DE DIAPOSITIVAS: exactamente ${numSlides}
${extra ? `INDICACIONES DEL PROFESOR: ${extra}\n` : ''}
Devuelve SOLO un objeto JSON (sin markdown, sin bloques de código, sin explicaciones) con esta forma:
{
  "titulo": "Título de la presentación",
  "slides": [
    {
      "layout": "title" | "content" | "image-right" | "image-left" | "two-col" | "cta" | "map",
      "heading": "Título de la diapositiva (máx. 8 palabras)",
      "subheading": "Subtítulo (solo para title y cta)",
      "body": "Texto principal. En content y two-col: 3-5 líneas que empiecen por • ",
      "col2": "Segunda columna con líneas • (solo two-col)",
      "tags": ["palabra clave", "otra"],
      "mapNodes": [
        {"id": 1, "text": "Concepto central", "x": 50, "y": 50, "isCenter": true},
        {"id": 2, "text": "Idea 1", "x": 20, "y": 25},
        {"id": 3, "text": "Idea 2", "x": 80, "y": 25},
        {"id": 4, "text": "Idea 3", "x": 20, "y": 75},
        {"id": 5, "text": "Idea 4", "x": 80, "y": 75}
      ]
    }
  ]
}

Reglas:
- La 1.ª diapositiva es "title" (título atractivo + subtítulo).
- La última es "cta" con un resumen o un reto final para la clase.
- Mezcla tipos: varias "content", al menos una "two-col" (comparar, ventajas/inconvenientes…) y una "map" (mapa conceptual con 4-6 ideas; x e y entre 10 y 90).
- "image-right"/"image-left": texto breve en body; la imagen la añadirá el profesor después.
- Frases cortas y claras, adecuadas al nivel: máximo ~40 palabras por diapositiva.
- Separa las líneas de body y col2 con \\n.
- Los campos que no use un layout pueden omitirse.
- Responde ÚNICAMENTE con el JSON.`;
}

// Pasa una diapositiva de plantilla a modo libre: cada texto es una caja que se
// puede mover y redimensionar. El mapa conceptual se convierte en nodos (forma + texto).
function diapositivaACajas(slide) {
  const t = THEMES[slide.theme] || THEMES.dark;
  let elements;
  if (slide.layout === 'map') {
    let n = 0;
    const formas = [], textos = [];
    const textoCentro = String(t.accent).toLowerCase() === '#ffffff' ? '#1f2937' : '#ffffff';
    if (slide.heading) textos.push({ id: `el_t${++n}`, type: 'text', x: 5, y: 3, w: 90, h: 12, text: slide.heading, textStyle: 'heading', textAlign: 'center' });
    (slide.mapNodes || []).forEach(nd => {
      const w = nd.isCenter ? 28 : 22, h = nd.isCenter ? 14 : 12;
      const x = Math.min(100 - w, Math.max(0, nd.x - w / 2));
      const y = Math.min(100 - h, Math.max(14, nd.y - h / 2));
      formas.push({ id: `el_s${++n}`, type: 'shape', shapeType: 'rect', x, y, w, h, fill: nd.isCenter ? t.accent : `${t.accent}33`, borderRadius: 14, stroke: t.accent, strokeWidth: 2 });
      textos.push({ id: `el_t${++n}`, type: 'text', x, y: y + h * 0.15, w, h: h * 0.7, text: nd.text, textStyle: nd.isCenter ? 'heading' : 'body', textAlign: 'center', fontSize: nd.isCenter ? 20 : 15, fontWeight: 'bold', ...(nd.isCenter ? { color: textoCentro } : {}) });
    });
    elements = [...formas, ...textos];
  } else {
    elements = migrateToElements(slide);
  }
  if ((slide.layout === 'title' || slide.layout === 'cta') && slide.tags?.length) {
    elements.push({ id: 'el_tags', type: 'text', x: 10, y: slide.layout === 'cta' ? 80 : 64, w: 80, h: 8, text: slide.tags.map(x => `#${x}`).join('   '), textStyle: 'cta', textAlign: 'center', fontSize: 14 });
  }
  return { ...slide, layout: 'free', elements };
}

// Acepta lo que pegue el profe: {titulo, slides}, un array directo, con ```json``` o texto alrededor
// opciones.cajas = true → cada diapositiva se crea en modo libre (cajas de texto movibles)
export function parsearPresentacionIA(raw, theme = 'dark', opciones = {}) {
  const txt = String(raw || '').replace(/```(?:json)?/gi, '').trim();
  let data;
  try { data = JSON.parse(txt); } catch {
    const ini = txt.search(/[[{]/);
    const fin = Math.max(txt.lastIndexOf('}'), txt.lastIndexOf(']'));
    try { data = JSON.parse(ini >= 0 && fin > ini ? txt.slice(ini, fin + 1) : ''); }
    catch { throw new Error('No se ha encontrado un JSON válido. Copia la respuesta completa de tu IA.'); }
  }
  const lista = Array.isArray(data) ? data : (data?.slides || data?.diapositivas);
  if (!Array.isArray(lista) || !lista.length) throw new Error('El JSON no contiene diapositivas ("slides").');
  const titulo = (!Array.isArray(data) && (data.titulo || data.title)) || '';
  const aTexto = v => Array.isArray(v)
    ? v.map(x => (String(x).trim().startsWith('•') ? String(x) : '• ' + x)).join('\n')
    : String(v || '');
  const base = Date.now();
  const slides = lista.map((s, i) => {
    const layout = LAYOUTS_IA.includes(s?.layout) ? s.layout : 'content';
    const nodos = Array.isArray(s?.mapNodes) ? s.mapNodes.map((n, j) => ({
      id: n.id ?? j + 1, text: String(n.text || ''),
      x: Math.min(92, Math.max(8, Number(n.x) || 50)),
      y: Math.min(92, Math.max(8, Number(n.y) || 50)),
      ...(n.isCenter ? { isCenter: true } : {}),
    })) : [];
    return {
      ...JSON.parse(JSON.stringify(SLIDE_DEFAULTS[layout])),
      id: base + i, layout, theme, duration: 5000,
      heading: String(s?.heading || ''),
      subheading: String(s?.subheading || ''),
      body: aTexto(s?.body),
      col2: aTexto(s?.col2),
      tags: Array.isArray(s?.tags) ? s.tags.map(String).slice(0, 6) : [],
      imageBase64: null,
      mapNodes: layout === 'map' && !nodos.length ? SLIDE_DEFAULTS.map.mapNodes : nodos,
    };
  });
  return { titulo, slides: opciones.cajas ? slides.map(diapositivaACajas) : slides };
}

async function generateWithGemini(topic, numSlides, theme) {
  const prompt = construirPromptPresentacion({ tema: topic, numSlides });
  const data = await callGeminiProxy({
    model: 'gemini-2.0-flash',
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.7, maxOutputTokens: 4000 },
  });
  return parsearPresentacionIA(extractText(data), theme).slides;
}

// ─── MAIN EDITOR COMPONENT ────────────────────────────────────────────────────
const TABS_DERECHA = [
  ['editar', '✏️', 'Editar'], ['elementos', '➕', 'Añadir'], ['plantillas', '🧩', 'Diseños'],
  ['fondo', '🎨', 'Fondo'], ['capas', '🗂️', 'Capas'], ['ajustes', '⚙️', 'Ajustes'],
];
const ETQ = { fontSize: 11, fontWeight: 700, color: '#9ca3af', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 };
const BTN_PANEL = { width: '100%', background: '#374151', color: '#e5e7eb', border: 'none', borderRadius: 8, padding: '8px 0', cursor: 'pointer', fontSize: 12, fontWeight: 700, marginBottom: 6 };

function primeraDiapositiva() {
  return { ...newSlide('free', 'dark'), elements: PLANTILLAS[0].crear(THEMES.dark) };
}
const limpiarParaGuardar = (v) => JSON.parse(JSON.stringify(v)); // Firestore no admite «undefined»

export default function PresentationEditor({ usuario, presentacionInicial, onClose, onSaved }) {
  const bgFileRef = useRef();
  const imgFileRef = useRef();
  const accionImgRef = useRef(null); // { tipo: 'nueva' | 'reemplazar' | 'marco', id }
  const superficieRef = useRef(null);
  const [titulo, setTitulo] = useState(presentacionInicial?.titulo || 'Nueva presentación');
  const [autoPlay, setAutoPlay] = useState(presentacionInicial?.autoPlay !== false);
  const hist = useHistorial(presentacionInicial?.slides?.length ? presentacionInicial.slides : [primeraDiapositiva()]);
  const slides = hist.valor;
  const setSlides = hist.set;
  const { deshacer, rehacer, cortar } = hist;
  const [activeIdx, setActiveIdx] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [presId, setPresId] = useState(presentacionInicial?.id || null);
  const [estadoGuardado, setEstadoGuardado] = useState(''); // '' | 'pendiente' | 'guardando' | 'ok' | 'error'
  const [aviso, setAviso] = useState('');

  // Selección en el lienzo
  const [selIds, setSelIds] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [editEquationId, setEditEquationId] = useState(null);
  const [previewAnim, setPreviewAnim] = useState(0);
  const [rejilla, setRejilla] = useState(false);
  const [estiloCopiado, setEstiloCopiado] = useState(null);
  const [exportando, setExportando] = useState(false);
  const [showBuscarFondo, setShowBuscarFondo] = useState(false);
  const [showBuscarPanel, setShowBuscarPanel] = useState(false);
  const portapapeles = useRef(null);
  const animTimer = useRef(null);
  const avisoTimer = useRef(null);

  // AI
  const [showAI, setShowAI] = useState(false);
  const [aiTopic, setAiTopic] = useState('');
  const [aiSlides, setAiSlides] = useState(6);
  const [aiTheme, setAiTheme] = useState('dark');
  const [generating, setGenerating] = useState(false);
  const [aiError, setAiError] = useState('');
  const [aiModo, setAiModo] = useState('miIA'); // 'miIA' (copiar prompt/pegar JSON) | 'gemini'
  const [aiNivel, setAiNivel] = useState('');
  const [aiExtra, setAiExtra] = useState('');
  const [aiPegado, setAiPegado] = useState('');
  const [aiCopiado, setAiCopiado] = useState(false);
  const [aiCajas, setAiCajas] = useState(true); // importar con cajas de texto movibles (modo libre)

  // Right panel
  const [rightTab, setRightTab] = useState(presentacionInicial?.slides?.length ? 'editar' : 'plantillas');

  // Mobile panels
  const [leftOpen,  setLeftOpen]  = useState(false);
  const [rightOpen, setRightOpen] = useState(false);
  const [isMobile,  setIsMobile]  = useState(() => window.innerWidth < 640);
  const centerRef = useRef(null);
  const [canvasMaxW, setCanvasMaxW] = useState(800);
  useEffect(() => {
    const fn = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener('resize', fn);
    return () => window.removeEventListener('resize', fn);
  }, []);
  useEffect(() => {
    const el = centerRef.current; if (!el) return;
    const compute = () => {
      const { width, height } = el.getBoundingClientRect();
      // ~195px: two toolbars (88px) + slide controls (36px) + gaps/padding (71px)
      const availH = height - 195;
      const wFromH = availH > 100 ? Math.floor(availH * 16 / 9) : 800;
      setCanvasMaxW(Math.min(wFromH, width - (isMobile ? 16 : 48)));
    };
    compute();
    const ro = new ResizeObserver(compute);
    ro.observe(el);
    return () => ro.disconnect();
  }, [isMobile]);

  useEffect(() => { cargarFuentes(); }, []);

  const mostrarAviso = (txt) => {
    setAviso(txt);
    clearTimeout(avisoTimer.current);
    avisoTimer.current = setTimeout(() => setAviso(''), 2800);
  };

  // Si deshacer quita diapositivas, que el índice siga siendo válido
  useEffect(() => {
    if (activeIdx > slides.length - 1) setActiveIdx(Math.max(0, slides.length - 1));
  }, [slides.length, activeIdx]);

  const idx = Math.min(activeIdx, slides.length - 1);
  const activeSlide = slides[idx] || slides[0];
  const activeEls = activeSlide?.elements || [];

  // Cambiar la diapositiva activa (objeto completo o función)
  const updateSlide = useCallback((updated) => {
    setSlides(prev => prev.map((s, i) => (i === idx ? (typeof updated === 'function' ? updated(s) : updated) : s)));
  }, [idx, setSlides]);
  // Cambiar los elementos de la diapositiva activa
  const cambiarEls = useCallback((fn) => {
    setSlides(prev => prev.map((s, i) => (i === idx ? { ...s, elements: fn(s.elements || []) } : s)));
  }, [idx, setSlides]);
  const anadirEls = useCallback((nuevos, editar = false) => {
    if (!nuevos?.length) return;
    cortar();
    cambiarEls(els => [...els, ...nuevos]);
    setSelIds(nuevos.map(e => e.id));
    setEditingId(editar ? nuevos[0].id : null);
  }, [cambiarEls, cortar]);

  // Al cambiar de diapositiva se quita la selección
  useEffect(() => { setSelIds([]); setEditingId(null); }, [idx]);

  // ── Imágenes: subir, soltar, pegar, reemplazar, rellenar marcos ──
  const rellenarMarco = (id, src) => {
    hist.cortar();
    cambiarEls(els => els.map(e => (e.id === id
      ? { id: e.id, type: 'image', src, x: e.x, y: e.y, w: e.w, h: e.h, rotation: e.rotation, objectFit: 'cover', borderRadius: e.borderRadius || 0, mask: e.mask || (e.shapeType === 'circle' ? 'circulo' : undefined), filters: e.filters, opacity: 1, anim: e.anim, shadow: e.shadow }
      : e)));
    setSelIds([id]);
  };
  const onArchivos = async (files, punto) => {
    const imgs = (files || []).filter(f => f.type.startsWith('image/'));
    if (!imgs.length) return;
    const marco = punto && [...activeEls].reverse().find(e => e.marco && punto.x >= e.x && punto.x <= e.x + e.w && punto.y >= e.y && punto.y <= e.y + e.h);
    const srcs = await Promise.all(imgs.map(f => comprimirImagen(f)));
    if (marco) { rellenarMarco(marco.id, srcs[0]); return; }
    const nuevos = [];
    for (let i = 0; i < srcs.length; i++) {
      const el = imagenEl(srcs[i], await proporcionImagen(srcs[i]));
      if (punto) { el.x = punto.x - el.w / 2; el.y = punto.y - el.h / 2; }
      el.x += i * 3; el.y += i * 3;
      nuevos.push(el);
    }
    anadirEls(nuevos);
  };
  const pedirImagen = (tipo, id) => { accionImgRef.current = { tipo, id }; imgFileRef.current?.click(); };
  const onImgFile = async (e) => {
    const files = [...(e.target.files || [])];
    e.target.value = '';
    const acc = accionImgRef.current || { tipo: 'nueva' };
    if (!files.length) return;
    if (acc.tipo === 'nueva') { onArchivos(files); return; }
    const src = await comprimirImagen(files[0]);
    if (acc.tipo === 'marco') rellenarMarco(acc.id, src);
    else { hist.cortar(); cambiarEls(els => els.map(x => (x.id === acc.id ? { ...x, src } : x))); }
  };

  // ── Acciones sobre la selección ──
  const borrarSel = () => {
    if (!selIds.length) return;
    hist.cortar();
    cambiarEls(els => els.filter(e => !selIds.includes(e.id) || e.locked));
    setSelIds([]); setEditingId(null);
  };
  const duplicarSel = () => {
    const orig = activeEls.filter(e => selIds.includes(e.id));
    if (!orig.length) return;
    anadirEls(orig.map(e => ({ ...JSON.parse(JSON.stringify(e)), id: nid(), x: e.x + 2, y: e.y + 3, locked: false })));
  };
  const copiarSel = () => {
    const orig = activeEls.filter(e => selIds.includes(e.id));
    if (!orig.length) return false;
    portapapeles.current = JSON.parse(JSON.stringify(orig));
    return true;
  };
  const pegarInterno = () => {
    const c = portapapeles.current;
    if (!c?.length) return;
    const copias = c.map(e => ({ ...JSON.parse(JSON.stringify(e)), id: nid(), x: e.x + 2, y: e.y + 3, locked: false }));
    portapapeles.current = copias;
    anadirEls(copias);
  };
  const pegarTexto = (txt) => {
    const yt = parseVideoUrl(txt);
    if (yt?.type === 'youtube') {
      anadirEls([{ id: nid(), type: 'youtube', ytId: yt.id, thumb: yt.thumb, embed: yt.embed, x: 15, y: 10, w: 70, h: 70, opacity: 1 }]);
      return;
    }
    anadirEls([{ id: nid(), type: 'text', text: txt.slice(0, 2000), x: 15, y: 30, w: 70, h: 30, fontSize: 22, lineHeight: 1.5, opacity: 1 }]);
  };
  const probarAnimaciones = () => {
    const d = duracionEntradas(activeEls);
    const hayBucle = activeEls.some(e => e.anim?.bucle);
    if (!d && !hayBucle) { mostrarAviso('Esta diapositiva no tiene animaciones. Selecciona un elemento → Animación.'); return; }
    setSelIds([]); setEditingId(null);
    setPreviewAnim(Date.now());
    clearTimeout(animTimer.current);
    animTimer.current = setTimeout(() => setPreviewAnim(0), (d + (hayBucle ? 3 : 0.6)) * 1000);
  };
  const onAccionPanel = (accion, id) => {
    const e = activeEls.find(x => x.id === id);
    switch (accion) {
      case 'borrar': borrarSel(); break;
      case 'duplicar': duplicarSel(); break;
      case 'copiarEstilo':
        if (e) { setEstiloCopiado(Object.fromEntries(CLAVES_ESTILO.map(c => [c, e[c]]))); mostrarAviso('🖌 Estilo copiado: selecciona otro elemento y pulsa «Pegar estilo»'); }
        break;
      case 'reemplazarImagen': pedirImagen('reemplazar', id); break;
      case 'comoFondo':
        if (e) { hist.cortar(); updateSlide(s => ({ ...s, bgImage: e.src, bgColor: null, bgGradient: null, elements: (s.elements || []).filter(x => x.id !== id) })); setSelIds([]); }
        break;
      case 'probarAnim': probarAnimaciones(); break;
      case 'editarEcuacion': setEditEquationId(id); break;
      default:
    }
  };

  // ── Teclado y portapapeles (handlers siempre con el estado más reciente) ──
  const acciones = useRef({});
  acciones.current = { borrarSel, duplicarSel, copiarSel, pegarInterno, pegarTexto, onArchivos, guardar: () => handleSave() };
  const estado = useRef({});
  estado.current = { selIds, activeEls, showAI, editEquationId };

  useEffect(() => {
    const escribiendo = (el) => el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable);
    const onKey = (e) => {
      const { selIds: sel, activeEls: els, showAI: ia, editEquationId: eq } = estado.current;
      if (ia || eq) return;
      const mod = e.ctrlKey || e.metaKey;
      const k = e.key.toLowerCase();
      const esc = escribiendo(e.target);
      if (mod && k === 's') { e.preventDefault(); acciones.current.guardar(); return; }
      if (esc) return;
      if (mod && k === 'z') { e.preventDefault(); if (e.shiftKey) rehacer(); else deshacer(); return; }
      if (mod && k === 'y') { e.preventDefault(); rehacer(); return; }
      if (mod && k === 'a') { e.preventDefault(); setSelIds(els.filter(x => !x.hidden).map(x => x.id)); return; }
      if (!sel.length) return;
      if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); acciones.current.borrarSel(); }
      else if (e.key === 'Escape') { setSelIds([]); setEditingId(null); }
      else if (mod && k === 'd') { e.preventDefault(); acciones.current.duplicarSel(); }
      else if (mod && (e.key === ']' || e.key === '[' || e.code === 'BracketRight' || e.code === 'BracketLeft')) {
        e.preventDefault();
        const delante = e.key === ']' || e.code === 'BracketRight';
        const modo = delante ? (e.shiftKey ? 'frente' : 'adelante') : (e.shiftKey ? 'fondo' : 'atras');
        cambiarEls(lista => ordenarEls(lista, sel, modo));
      } else if (e.key === 'Enter' && sel.length === 1) {
        const el = els.find(x => x.id === sel[0]);
        if (el && !el.locked && (el.type === 'text' || (el.type === 'shape' && el.shapeType !== 'line'))) { e.preventDefault(); setEditingId(el.id); }
      } else if (e.key.startsWith('Arrow')) {
        e.preventDefault();
        const px = e.shiftKey ? 10 : 1;
        const dx = e.key === 'ArrowLeft' ? -px : e.key === 'ArrowRight' ? px : 0;
        const dy = e.key === 'ArrowUp' ? -px : e.key === 'ArrowDown' ? px : 0;
        cambiarEls(lista => lista.map(x => (sel.includes(x.id) && !x.locked ? { ...x, x: x.x + dx / PX_X, y: x.y + dy / PX_Y } : x)));
      }
    };
    const MARCA = '[pikt-elementos]';
    const onCopy = (e) => {
      if (escribiendo(e.target) || window.getSelection()?.toString()) return;
      if (acciones.current.copiarSel()) { e.clipboardData?.setData('text/plain', MARCA); e.preventDefault(); }
    };
    const onCut = (e) => {
      if (escribiendo(e.target) || window.getSelection()?.toString()) return;
      if (acciones.current.copiarSel()) { e.clipboardData?.setData('text/plain', MARCA); e.preventDefault(); acciones.current.borrarSel(); }
    };
    const onPaste = (e) => {
      if (escribiendo(e.target) || estado.current.showAI) return;
      const files = [...(e.clipboardData?.files || [])].filter(f => f.type.startsWith('image/'));
      if (files.length) { e.preventDefault(); acciones.current.onArchivos(files); return; }
      const txt = (e.clipboardData?.getData('text/plain') || '').trim();
      if (txt === MARCA) { e.preventDefault(); acciones.current.pegarInterno(); return; }
      if (txt) { e.preventDefault(); acciones.current.pegarTexto(txt); }
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('copy', onCopy);
    document.addEventListener('cut', onCut);
    document.addEventListener('paste', onPaste);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('copy', onCopy);
      document.removeEventListener('cut', onCut);
      document.removeEventListener('paste', onPaste);
    };
  }, [deshacer, rehacer, cambiarEls]);

  // ── Diapositivas ──
  const addSlide = (layout = 'free') => {
    const s = newSlide(layout, activeSlide?.theme || 'dark');
    setSlides(prev => [...prev.slice(0, idx + 1), s, ...prev.slice(idx + 1)]);
    setActiveIdx(idx + 1);
  };
  const deleteSlide = (i) => {
    if (slides.length <= 1) return;
    hist.cortar();
    setSlides(prev => prev.filter((_, j) => j !== i));
    setActiveIdx(Math.min(idx, slides.length - 2));
  };
  const moveSlide = (from, to) => {
    if (to < 0 || to >= slides.length || from === to) return;
    hist.cortar();
    setSlides(prev => { const next = [...prev]; const [item] = next.splice(from, 1); next.splice(to, 0, item); return next; });
    setActiveIdx(to);
  };
  const duplicarDiapositiva = (i = idx) => {
    hist.cortar();
    const c = clonarDiapositiva(slides[i], nid);
    setSlides(prev => [...prev.slice(0, i + 1), c, ...prev.slice(i + 1)]);
    setActiveIdx(i + 1);
  };
  const usarPlantilla = (elements) => {
    hist.cortar();
    const vacia = activeSlide?.layout === 'free' && !activeEls.length;
    if (vacia) updateSlide(s => ({ ...s, elements }));
    else {
      const s = { ...newSlide('free', activeSlide?.theme || 'dark'), elements };
      setSlides(prev => [...prev.slice(0, idx + 1), s, ...prev.slice(idx + 1)]);
      setActiveIdx(idx + 1);
    }
    setSelIds([]);
    if (isMobile) setRightOpen(false);
  };

  const handleBgImageUpload = async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    const src = await comprimirImagen(file, 1920, 0.82);
    updateSlide(s => ({ ...s, bgImage: src }));
  };

  // ── Guardar (manual y automático) ──
  const guardando = useRef(false);
  const guardar = async ({ silencioso = false } = {}) => {
    if (!usuario) return null;
    if (guardando.current) return presId;
    guardando.current = true;
    setEstadoGuardado('guardando');
    if (!silencioso) setSaving(true);
    try {
      const data = { titulo, slides: limpiarParaGuardar(slides), autoPlay, uid: usuario.uid, profesorNombre: usuario.displayName || '', updatedAt: serverTimestamp() };
      let id = presId;
      if (id) {
        await updateDoc(doc(db, 'presentations', id), data);
      } else {
        const ref = await addDoc(collection(db, 'presentations'), { ...data, createdAt: serverTimestamp() });
        id = ref.id;
        setPresId(id);
        if (onSaved) onSaved(id);
      }
      setEstadoGuardado('ok');
      if (!silencioso) { setSaved(true); setTimeout(() => setSaved(false), 2500); }
      return id;
    } catch (e) {
      setEstadoGuardado('error');
      const grande = /exceed|too large|longer than|maximum|1048487|size/i.test(e.message || '');
      const msg = grande ? 'La presentación pesa demasiado (más de 1 MB). Quita alguna imagen subida o usa imágenes buscadas.' : e.message;
      if (silencioso) mostrarAviso('⚠️ No se pudo guardar: ' + msg);
      else alert('Error guardando: ' + msg);
      return null;
    } finally {
      guardando.current = false;
      if (!silencioso) setSaving(false);
    }
  };
  const handleSave = () => guardar();

  // Guardado automático 4 s después del último cambio (solo si ya existe la presentación)
  const primerRender = useRef(true);
  useEffect(() => {
    if (primerRender.current) { primerRender.current = false; return; }
    if (!presId || !usuario) { setEstadoGuardado('pendiente'); return; }
    setEstadoGuardado('pendiente');
    const tm = setTimeout(() => { guardar({ silencioso: true }); }, 4000);
    return () => clearTimeout(tm);
  }, [slides, titulo, autoPlay]); // eslint-disable-line react-hooks/exhaustive-deps

  const cerrar = async () => {
    if (estadoGuardado === 'pendiente') {
      if (presId) await guardar({ silencioso: true });
      else if (!window.confirm('No has guardado esta presentación. ¿Salir sin guardar?')) return;
    }
    onClose?.();
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

  const promptMiIA = construirPromptPresentacion({ tema: aiTopic.trim(), numSlides: aiSlides, nivel: aiNivel.trim(), extra: aiExtra.trim() });

  const copiarPrompt = async () => {
    try { await navigator.clipboard.writeText(promptMiIA); }
    catch {
      const ta = document.createElement('textarea'); ta.value = promptMiIA;
      document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove();
    }
    setAiCopiado(true); setTimeout(() => setAiCopiado(false), 2500);
  };

  // modo: 'reemplazar' | 'anadir'
  const importarPegado = (modo) => {
    setAiError('');
    try {
      const { titulo: t, slides: nuevas } = parsearPresentacionIA(aiPegado, aiTheme, { cajas: aiCajas });
      if (modo === 'anadir') {
        setSlides(prev => [...prev, ...nuevas]);
        setActiveIdx(slides.length);
      } else {
        setSlides(nuevas);
        setActiveIdx(0);
        if (t || aiTopic.trim()) setTitulo(t || aiTopic.trim());
      }
      setShowAI(false);
      setAiPegado('');
    } catch (e) {
      setAiError(e.message);
    }
  };

  // Vista previa / presentar / PDF: se guarda antes para que el visor tenga lo último
  const abrirVisor = async ({ desdeAqui = false, imprimir = false } = {}) => {
    const w = window.open('about:blank', '_blank');
    const id = await guardar({ silencioso: true });
    if (!id) { w?.close(); return; }
    const url = `/pikt-viewer.html?id=${id}${desdeAqui ? `&s=${idx + 1}` : ''}${imprimir ? '&print=1' : ''}`;
    if (w) w.location.href = url; else window.open(url, '_blank');
  };

  const exportarPNG = async () => {
    setSelIds([]); setEditingId(null); setExportando(true);
    await new Promise(r => setTimeout(r, 150));
    try {
      const { default: html2canvas } = await import('html2canvas');
      const nodo = superficieRef.current;
      const canvas = await html2canvas(nodo, { useCORS: true, backgroundColor: null, scale: 1920 / nodo.offsetWidth, logging: false });
      const a = document.createElement('a');
      const base = (titulo || 'presentacion').replace(/[\\/:*?"<>|]+/g, '').trim() || 'presentacion';
      a.download = `${base} - ${idx + 1}.png`;
      a.href = canvas.toDataURL('image/png');
      a.click();
    } catch (e) {
      alert('No se pudo exportar la imagen: ' + e.message);
    }
    setExportando(false);
  };

  const convertToFree = () => {
    updateSlide(diapositivaACajas(activeSlide));
  };
  // Solo las de plantilla con texto: juego, vídeo y las ya libres se dejan igual
  const convertAllToFree = () => {
    const convertibles = LAYOUTS_IA;
    const n = slides.filter(s => convertibles.includes(s.layout) && !(s.elements || []).length).length;
    if (!n) { alert('No hay diapositivas de plantilla que convertir.'); return; }
    if (!window.confirm(`Se pasarán ${n} diapositiva${n !== 1 ? 's' : ''} a cajas de texto movibles. ¿Continuar?`)) return;
    setSlides(slides.map(s => (convertibles.includes(s.layout) && !(s.elements || []).length) ? diapositivaACajas(s) : s));
  };

  const aplicarFondoATodas = () => {
    const a = activeSlide;
    if (a.bgImage?.startsWith('data:') && slides.length > 2 && !window.confirm('La imagen de fondo se copiará en todas las diapositivas y la presentación pesará más. ¿Continuar?')) return;
    hist.cortar();
    setSlides(prev => prev.map(s => ({ ...s, theme: a.theme, bgColor: a.bgColor || null, bgGradient: a.bgGradient || null, bgImage: a.bgImage || null, bgOverlay: a.bgOverlay || 0 })));
    mostrarAviso('🎨 Fondo aplicado a todas las diapositivas');
  };

  const theme = THEMES[activeSlide?.theme] || THEMES.dark;
  const haySeleccion = selIds.length > 0 && activeEls.some(e => selIds.includes(e.id));
  const pesoKB = rightTab === 'ajustes' ? Math.round(JSON.stringify(slides).length / 1024) : 0;
  const canvasProps = {
    selIds, setSelIds, editingId, setEditingId, onChangeEls: cambiarEls, onCortar: hist.cortar,
    onMarco: id => pedirImagen('marco', id),
    onSeleccionCanvas: () => setRightTab(tab => (tab === 'capas' ? tab : 'editar')),
    previewAnim, rejilla,
  };
  const estadoTxt = { pendiente: presId ? '● Cambios sin guardar' : '● Sin guardar', guardando: '⏳ Guardando…', ok: '✓ Guardado', error: '⚠️ Error al guardar' }[estadoGuardado] || '';
  const topBtn = (extra = {}) => ({ background: '#374151', color: '#e5e7eb', border: 'none', borderRadius: 8, padding: '7px 11px', cursor: 'pointer', fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap', ...extra });

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 500, display: 'flex', flexDirection: 'column', background: '#111827', fontFamily: "'Inter', 'Segoe UI', Arial, sans-serif", color: '#fff', overflow: 'hidden' }}>
      <style>{KEYFRAMES_CSS}</style>
      <input ref={imgFileRef} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={onImgFile} />

      {/* TOP BAR */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: isMobile ? '8px 10px' : '10px 16px', background: '#1f2937', borderBottom: '1px solid #374151', flexShrink: 0, flexWrap: isMobile ? 'wrap' : 'nowrap' }}>
        <button onClick={cerrar} style={topBtn({ color: '#9ca3af' })}>← {isMobile ? '' : 'Volver'}</button>
        <input
          value={titulo} onChange={e => setTitulo(e.target.value)}
          style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: '#fff', fontSize: 16, fontWeight: 700, minWidth: 80 }}
          placeholder="Título de la presentación"
        />
        {!isMobile && estadoTxt && <span style={{ fontSize: 11, color: estadoGuardado === 'error' ? '#f87171' : estadoGuardado === 'ok' ? '#34d399' : '#9ca3af', whiteSpace: 'nowrap' }}>{estadoTxt}</span>}
        <div style={{ display: 'flex', gap: 6, flexShrink: 0, flexWrap: 'wrap' }}>
          <button onClick={hist.deshacer} disabled={!hist.puedeDeshacer} title="Deshacer (Ctrl+Z)" style={topBtn({ opacity: hist.puedeDeshacer ? 1 : 0.4 })}>↶</button>
          <button onClick={hist.rehacer} disabled={!hist.puedeRehacer} title="Rehacer (Ctrl+Y)" style={topBtn({ opacity: hist.puedeRehacer ? 1 : 0.4 })}>↷</button>
          <button onClick={() => setRejilla(r => !r)} title="Mostrar cuadrícula" style={topBtn(rejilla ? { background: '#6c63ff', color: '#fff' } : {})}>▦</button>
          <button onClick={probarAnimaciones} title="Ver las animaciones de esta diapositiva" style={topBtn()}>✨{isMobile ? '' : ' Animar'}</button>
          <button onClick={() => setShowAI(true)} style={topBtn({ background: 'linear-gradient(135deg, #6c63ff, #a855f7)', color: '#fff' })}>
            🤖{isMobile ? '' : ' IA'}
          </button>
          <button onClick={() => abrirVisor({ desdeAqui: true })} title="Presentar desde esta diapositiva" style={topBtn({ background: '#059669', color: '#fff' })}>
            ▶{isMobile ? '' : ' Presentar'}
          </button>
          <button onClick={handleSave} disabled={saving} title="Guardar (Ctrl+S)" style={topBtn({ background: saved ? '#10b981' : '#6c63ff', color: '#fff', minWidth: isMobile ? 0 : 92 })}>
            {saving ? '⏳' : saved ? '✓' : '💾'}{isMobile ? '' : saving ? ' Guardando…' : saved ? ' Guardado' : ' Guardar'}
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
              <SlideThumb key={s.id} slide={s} index={i} isActive={i === idx} total={slides.length} ancho={isMobile ? 182 : 142}
                onClick={() => { setActiveIdx(i); if (isMobile) setLeftOpen(false); }} onDelete={() => deleteSlide(i)} onDuplicate={() => duplicarDiapositiva(i)}
                onMoveUp={() => moveSlide(i, i - 1)} onMoveDown={() => moveSlide(i, i + 1)} onDropThumb={moveSlide} />
            ))}
          </div>
          <div style={{ padding: 8, borderTop: '1px solid #374151', display: 'flex', gap: 6 }}>
            <button onClick={() => addSlide('free')} title="Diapositiva en blanco" style={{ flex: 1, background: '#6c63ff', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 0', cursor: 'pointer', fontWeight: 700, fontSize: 13 }}>+ Añadir</button>
            <button onClick={() => { setRightTab('plantillas'); if (isMobile) { setRightOpen(true); setLeftOpen(false); } }} title="Añadir un diseño" style={{ background: '#374151', color: '#e5e7eb', border: 'none', borderRadius: 8, padding: '8px 9px', cursor: 'pointer', fontSize: 13 }}>🧩</button>
          </div>
        </div>

        {/* CENTER: CANVAS */}
        <div ref={centerRef} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: isMobile ? '8px 10px 16px' : 24, background: '#0f172a', overflow: 'auto', gap: 16 }}>

          {/* Mobile panel toggles */}
          {isMobile && (
            <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', flexShrink: 0 }}>
              <button onClick={() => { setLeftOpen(o => !o); setRightOpen(false); }}
                style={{ background: leftOpen ? '#6c63ff' : '#374151', color: '#fff', border: 'none', borderRadius: 8, padding: '7px 14px', cursor: 'pointer', fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 5 }}>
                🖼️ {leftOpen ? 'Ocultar' : 'Slides'}
              </button>
              <button onClick={() => { setRightOpen(o => !o); setLeftOpen(false); }}
                style={{ background: rightOpen ? '#6c63ff' : '#374151', color: '#fff', border: 'none', borderRadius: 8, padding: '7px 14px', cursor: 'pointer', fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 5 }}>
                {rightOpen ? 'Ocultar' : haySeleccion ? '✏️ Editar' : '⚙️ Opciones'}
              </button>
            </div>
          )}

          <div style={{ width: '100%', maxWidth: canvasMaxW }}>
            {activeSlide && (
              <SlideCanvas key={activeSlide.id} slide={activeSlide} onChange={updateSlide} usuario={usuario}
                canvas={canvasProps} anadirEls={anadirEls} superficieRef={superficieRef} exportando={exportando}
                onAbrirElementos={() => { setRightTab('elementos'); if (isMobile) setRightOpen(true); }}
                onArchivos={onArchivos} editEquationId={editEquationId} setEditEquationId={setEditEquationId} />
            )}
          </div>
          {/* Slide controls */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button onClick={() => setActiveIdx(Math.max(0, idx - 1))} disabled={idx === 0} title="Diapositiva anterior" style={{ background: '#1f2937', color: '#9ca3af', border: 'none', borderRadius: 6, padding: '5px 10px', cursor: 'pointer' }}>◀</button>
            <span style={{ fontSize: 12, color: '#6b7280' }}>{idx + 1} / {slides.length}</span>
            <button onClick={() => setActiveIdx(Math.min(slides.length - 1, idx + 1))} disabled={idx === slides.length - 1} title="Diapositiva siguiente" style={{ background: '#1f2937', color: '#9ca3af', border: 'none', borderRadius: 6, padding: '5px 10px', cursor: 'pointer' }}>▶</button>
          </div>
        </div>

        {/* RIGHT: PROPERTIES PANEL */}
        <div style={{
          width: 272, flexShrink: 0,
          ...(isMobile ? {
            position: 'absolute', top: 0, bottom: 0, right: 0, zIndex: 300, width: 280,
            transform: rightOpen ? 'translateX(0)' : 'translateX(100%)',
            transition: 'transform 0.25s cubic-bezier(0.4,0,0.2,1)',
            boxShadow: rightOpen ? '-6px 0 24px rgba(0,0,0,0.6)' : 'none',
          } : {}),
          background: '#1f2937', borderLeft: '1px solid #374151', display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}>
          {/* Tabs */}
          <div style={{ display: 'flex', borderBottom: '1px solid #374151' }}>
            {TABS_DERECHA.map(([tab, icon, label]) => (
              <button key={tab} onClick={() => setRightTab(tab)} title={label} style={{
                flex: 1, background: rightTab === tab ? '#374151' : 'transparent', color: rightTab === tab ? '#fff' : '#6b7280',
                border: 'none', borderBottom: rightTab === tab ? '2px solid #6c63ff' : '2px solid transparent', padding: '6px 0 5px', cursor: 'pointer', fontSize: 13, lineHeight: 1.2,
              }}>
                {icon}<div style={{ fontSize: 8, fontWeight: 700, marginTop: 1 }}>{label}</div>
              </button>
            ))}
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: 12 }}>
            {rightTab === 'editar' && (
              <div>
                {haySeleccion ? (
                  <PanelPropiedades elementos={activeEls} selIds={selIds} t={theme} numSlides={slides.length}
                    onCambiarEls={cambiarEls} onAccion={onAccionPanel} estiloCopiado={estiloCopiado} />
                ) : (activeSlide?.layout === 'free' || activeEls.length > 0) ? (
                  <>
                    <div style={{ ...ETQ, marginBottom: 6 }}>Lienzo libre</div>
                    <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 12, lineHeight: 1.7 }}>
                      Haz clic en un elemento para editarlo. Arrastra sobre el fondo para seleccionar varios.
                    </div>
                    <button onClick={() => setRightTab('plantillas')} style={BTN_PANEL}>🧩 Ver diseños</button>
                    <button onClick={() => setRightTab('elementos')} style={BTN_PANEL}>➕ Añadir textos, formas y emojis</button>
                    <button onClick={() => setSelIds(activeEls.filter(e => !e.hidden).map(e => e.id))} disabled={!activeEls.length} style={{ ...BTN_PANEL, opacity: activeEls.length ? 1 : 0.5 }}>🔲 Seleccionar todo</button>
                    <div style={{ background: '#111827', borderRadius: 10, padding: 10, fontSize: 10, color: '#9ca3af', lineHeight: 1.8, margin: '8px 0 14px' }}>
                      <b style={{ color: '#d1d5db' }}>Atajos</b><br />
                      Doble clic / Intro = escribir · Supr = borrar<br />
                      Ctrl+Z / Ctrl+Y = deshacer / rehacer<br />
                      Ctrl+C / Ctrl+V = copiar / pegar (también entre diapositivas)<br />
                      Ctrl+D = duplicar · Ctrl+A = todo<br />
                      Mayús+clic = selección múltiple<br />
                      Flechas = mover (Mayús = 10 px) · Alt al arrastrar = sin imán<br />
                      Ctrl+] / Ctrl+[ = adelante / atrás
                    </div>
                    {activeSlide?.layout === 'free' && (
                      <button onClick={() => {
                        if (!window.confirm('¿Convertir a plantilla? Los elementos libres se convertirán a un diseño "Contenido".')) return;
                        const textEls = activeEls.filter(e => e.type === 'text');
                        updateSlide({ ...activeSlide, layout: 'content', elements: undefined, heading: textEls[0]?.text?.split('\n')[0] || '', body: textEls.slice(1).map(e => e.text).join('\n') || '' });
                      }} style={{ ...BTN_PANEL, color: '#9ca3af' }}>
                        ↩ Volver a plantilla
                      </button>
                    )}
                  </>
                ) : (
                  <>
                    <div style={ETQ}>Diseño</div>
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
                    <button onClick={convertAllToFree} title="Pasa todas las diapositivas con plantilla a cajas de texto movibles"
                      style={{ width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', marginBottom: 4, background: 'transparent', border: '1px dashed #6c63ff', borderRadius: 8, color: '#c4b5fd', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                      <span>✋✋</span><span>Convertir todas a libre</span>
                    </button>
                  </>
                )}
                {!haySeleccion && <>
                  <div style={{ ...ETQ, marginTop: 12 }}>Añadir diapositiva</div>
                  {LAYOUTS.map(l => (
                    <button key={`add-${l.id}`} onClick={() => addSlide(l.id)}
                      style={{ width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', marginBottom: 3, background: 'transparent', border: '1px solid #374151', borderRadius: 8, color: '#9ca3af', cursor: 'pointer', fontSize: 11 }}>
                      <span>{l.icon}</span><span>+ {l.label}</span>
                    </button>
                  ))}
                </>}
              </div>
            )}

            {rightTab === 'elementos' && (
              <PanelElementos t={theme} onAnadir={anadirEls} onSubirImagen={() => pedirImagen('nueva')} onBuscarImagen={() => setShowBuscarPanel(true)} />
            )}

            {rightTab === 'plantillas' && (
              <PanelPlantillas t={theme} theme={activeSlide?.theme || 'dark'} onUsar={usarPlantilla} />
            )}

            {rightTab === 'capas' && (
              <PanelCapas elementos={activeEls} selIds={selIds} onCambiarEls={cambiarEls}
                onSeleccionar={(id, aditivo) => setSelIds(s => (aditivo ? (s.includes(id) ? s.filter(x => x !== id) : [...s, id]) : [id]))} />
            )}

            {rightTab === 'fondo' && (
              <div>
                <div style={ETQ}>Tema de color</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                  {Object.entries(THEMES).map(([key, th]) => (
                    <button key={key} onClick={() => updateSlide(s => ({ ...s, theme: key, bgColor: null, bgGradient: null }))}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 6, padding: '8px 8px',
                        background: th.bg, border: `2px solid ${activeSlide?.theme === key ? '#fff' : 'transparent'}`,
                        borderRadius: 10, cursor: 'pointer', color: th.text, fontWeight: 700, fontSize: 11,
                      }}>
                      <div style={{ width: 12, height: 12, borderRadius: '50%', background: th.accent, flexShrink: 0, boxShadow: '0 0 0 1px rgba(0,0,0,0.2)' }} />
                      {th.label}
                    </button>
                  ))}
                </div>
                <button onClick={() => { const t = activeSlide?.theme || 'dark'; hist.cortar(); setSlides(prev => prev.map(s => ({ ...s, theme: t }))); mostrarAviso('Tema aplicado a todas'); }}
                  style={{ ...BTN_PANEL, marginTop: 8, color: '#9ca3af' }}>
                  Aplicar tema a todas
                </button>

                <div style={{ ...ETQ, marginTop: 14 }}>Color de fondo</div>
                <ColorPicker value={activeSlide?.bgColor || null} allowNull onChange={c => updateSlide(s => ({ ...s, bgColor: c, bgGradient: null }))} />

                <div style={{ ...ETQ, marginTop: 6 }}>Degradado</div>
                <CampoDegradado valor={activeSlide?.bgGradient || null} onChange={g => updateSlide(s => ({ ...s, bgGradient: g, bgColor: null }))} />

                <div style={{ ...ETQ, marginTop: 10 }}>Imagen de fondo</div>
                <input ref={bgFileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleBgImageUpload} />
                {activeSlide?.bgImage ? (
                  <>
                    <div style={{ position: 'relative', borderRadius: 10, overflow: 'hidden', marginBottom: 8 }}>
                      <img src={activeSlide.bgImage} alt="" style={{ width: '100%', height: 80, objectFit: 'cover', display: 'block' }} />
                      <button onClick={() => updateSlide(s => ({ ...s, bgImage: null }))}
                        style={{ position: 'absolute', top: 4, right: 4, background: 'rgba(239,68,68,0.85)', color: '#fff', border: 'none', borderRadius: 6, padding: '2px 8px', cursor: 'pointer', fontSize: 11, fontWeight: 700 }}>
                        ✕ Quitar
                      </button>
                    </div>
                    <Deslizador label="Oscurecer (para que se lea el texto)" value={activeSlide.bgOverlay || 0} min={0} max={0.85} step={0.05}
                      formato={v => `${Math.round(v * 100)}%`} onChange={v => updateSlide(s => ({ ...s, bgOverlay: v }))} />
                  </>
                ) : (
                  <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 6 }}>Sin imagen de fondo</div>
                )}
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={() => bgFileRef.current?.click()} style={{ ...BTN_PANEL, border: '1px dashed #4b5563' }}>🖼️ Subir</button>
                  <button onClick={() => setShowBuscarFondo(true)} style={BTN_PANEL}>🔍 Buscar</button>
                </div>

                <div style={{ borderTop: '1px solid #374151', marginTop: 10, paddingTop: 10 }}>
                  <button onClick={() => updateSlide(s => ({ ...s, bgColor: null, bgGradient: null, bgImage: null, bgOverlay: 0 }))} style={{ ...BTN_PANEL, color: '#9ca3af' }}>↺ Quitar fondo personalizado</button>
                  <button onClick={aplicarFondoATodas} style={{ ...BTN_PANEL, background: 'rgba(108,99,255,0.2)', color: '#c4b5fd' }}>🎨 Aplicar este fondo a todas</button>
                </div>
              </div>
            )}

            {rightTab === 'ajustes' && (
              <div>
                <div style={{ marginBottom: 16 }}>
                  <div style={ETQ}>Reproducción</div>
                  <button onClick={() => setAutoPlay(v => !v)}
                    style={{ width: '100%', background: autoPlay ? 'rgba(108,99,255,0.2)' : '#374151', color: autoPlay ? '#a78bfa' : '#9ca3af', border: `1px solid ${autoPlay ? 'rgba(108,99,255,0.4)' : '#4b5563'}`, borderRadius: 8, padding: '8px 12px', cursor: 'pointer', fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 16 }}>{autoPlay ? '▶' : '⏸'}</span>
                    {autoPlay ? 'Auto-play activado' : 'Auto-play desactivado'}
                  </button>
                  <div style={{ fontSize: 10, color: '#6b7280', marginTop: 4 }}>
                    {autoPlay ? 'Las diapositivas avanzan solas.' : 'Avance manual con las flechas.'}
                  </div>
                </div>

                <div style={ETQ}>Duración de esta diapositiva</div>
                <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 14 }}>
                  {[3000, 5000, 7000, 10000, 15000, 30000, 60000].map(d => (
                    <button key={d} onClick={() => updateSlide(s => ({ ...s, duration: d }))}
                      style={{ background: activeSlide?.duration === d ? '#6c63ff' : '#374151', color: '#fff', border: 'none', borderRadius: 6, padding: '5px 8px', cursor: 'pointer', fontSize: 11, fontWeight: 700 }}>
                      {d < 60000 ? `${d / 1000}s` : '1 min'}
                    </button>
                  ))}
                </div>

                <div style={ETQ}>Transición al entrar</div>
                <select value={activeSlide?.transition || ''} onChange={e => updateSlide(s => ({ ...s, transition: e.target.value || undefined }))}
                  style={{ width: '100%', background: '#111827', border: '1px solid #374151', borderRadius: 8, padding: '7px 8px', color: '#fff', fontSize: 12, outline: 'none', marginBottom: 6 }}>
                  {TRANSICIONES.map(tr => <option key={tr.id} value={tr.id}>{tr.label}</option>)}
                </select>
                <button onClick={() => { const tr = activeSlide?.transition; hist.cortar(); setSlides(prev => prev.map(s => ({ ...s, transition: tr || undefined }))); mostrarAviso('Transición aplicada a todas'); }}
                  style={{ ...BTN_PANEL, color: '#9ca3af', marginBottom: 14 }}>Aplicar transición a todas</button>

                <div style={ETQ}>Notas del profesor</div>
                <textarea value={activeSlide?.notes || ''} onChange={e => updateSlide(s => ({ ...s, notes: e.target.value }))}
                  placeholder="Lo que quieres recordar al explicar esta diapositiva (pulsa N al presentar para verlas)"
                  style={{ width: '100%', minHeight: 80, background: '#111827', border: '1px solid #374151', borderRadius: 8, padding: 8, color: '#fff', fontSize: 12, outline: 'none', resize: 'vertical', boxSizing: 'border-box', marginBottom: 14, fontFamily: 'inherit' }} />

                <div style={ETQ}>Diapositiva</div>
                <button onClick={() => duplicarDiapositiva()} style={BTN_PANEL}>⧉ Duplicar diapositiva</button>
                <button onClick={() => deleteSlide(idx)} disabled={slides.length <= 1}
                  style={{ ...BTN_PANEL, background: '#7f1d1d', color: '#fca5a5', marginBottom: 14 }}>
                  🗑️ Eliminar diapositiva
                </button>

                <div style={ETQ}>Descargar y compartir</div>
                <button onClick={exportarPNG} disabled={exportando} style={BTN_PANEL}>{exportando ? '⏳ Generando…' : '🖼️ Esta diapositiva como imagen (PNG)'}</button>
                <button onClick={() => abrirVisor({ imprimir: true })} style={BTN_PANEL}>📄 Toda la presentación en PDF</button>
                <button onClick={() => abrirVisor()} style={BTN_PANEL}>👁️ Vista previa desde el principio</button>
                <div style={{ fontSize: 10, color: '#6b7280', lineHeight: 1.5, marginBottom: 12 }}>
                  En el PDF, elige «Guardar como PDF» en la ventana de impresión y activa «Gráficos de fondo».
                </div>
                <div style={{ fontSize: 10, color: pesoKB > 850 ? '#f87171' : '#6b7280' }}>
                  Tamaño de la presentación: {pesoKB} KB de 1024 KB{pesoKB > 850 ? ' — quita imágenes subidas o usa el buscador' : ''}
                </div>
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

      {/* Aviso flotante */}
      {aviso && (
        <div style={{ position: 'fixed', bottom: 22, left: '50%', transform: 'translateX(-50%)', background: '#111827', border: '1px solid #6c63ff', color: '#e5e7eb', padding: '9px 16px', borderRadius: 12, fontSize: 13, fontWeight: 600, zIndex: 3500, boxShadow: '0 6px 24px rgba(0,0,0,0.5)', maxWidth: '90vw', textAlign: 'center' }}>{aviso}</div>
      )}

      {showBuscarFondo && <ImgSearchModal onAdd={url => { updateSlide(s => ({ ...s, bgImage: url })); setShowBuscarFondo(false); }} onClose={() => setShowBuscarFondo(false)} />}
      {showBuscarPanel && <ImgSearchModal onAdd={async url => { setShowBuscarPanel(false); anadirEls([imagenEl(url, await proporcionImagen(url))]); }} onClose={() => setShowBuscarPanel(false)} />}

      {/* AI MODAL */}
      {showAI && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#1f2937', borderRadius: 20, padding: 'clamp(18px,4vw,32px)', width: '92%', maxWidth: 580, maxHeight: '92vh', overflowY: 'auto', border: '1px solid #374151', boxSizing: 'border-box' }}>
            <h2 style={{ margin: '0 0 14px', fontSize: 22, fontWeight: 900, background: 'linear-gradient(135deg, #6c63ff, #a855f7)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              🤖 Generar presentación con IA
            </h2>
            <div style={{ display: 'flex', gap: 6, marginBottom: 18, background: '#111827', padding: 4, borderRadius: 12 }}>
              {[['miIA', '📋 Con mi IA (copiar y pegar)'], ['gemini', '✨ Generar aquí']].map(([id, lab]) => (
                <button key={id} onClick={() => { setAiModo(id); setAiError(''); }}
                  style={{ flex: 1, padding: '8px 10px', borderRadius: 9, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 13,
                    background: aiModo === id ? 'linear-gradient(135deg, #6c63ff, #a855f7)' : 'transparent', color: aiModo === id ? '#fff' : '#9ca3af' }}>
                  {lab}
                </button>
              ))}
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: '#9ca3af', display: 'block', marginBottom: 6 }}>TEMA DE LA PRESENTACIÓN</label>
              <input
                value={aiTopic} onChange={e => setAiTopic(e.target.value)}
                placeholder="Ej: El sistema solar, La Revolución Francesa, Las fracciones..."
                style={{ width: '100%', background: '#111827', border: '2px solid #374151', borderRadius: 10, padding: '10px 14px', color: '#fff', fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
                onKeyDown={e => e.key === 'Enter' && aiModo === 'gemini' && handleGenerate()}
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
            {aiModo === 'miIA' && (
              <>
                <div style={{ display: 'flex', gap: 16, marginBottom: 12, flexWrap: 'wrap' }}>
                  <div style={{ flex: '1 1 160px' }}>
                    <label style={{ fontSize: 12, fontWeight: 700, color: '#9ca3af', display: 'block', marginBottom: 6 }}>NIVEL / CURSO (opcional)</label>
                    <input value={aiNivel} onChange={e => setAiNivel(e.target.value)} placeholder="Ej: 2.º ESO"
                      style={{ width: '100%', background: '#111827', border: '2px solid #374151', borderRadius: 10, padding: '9px 12px', color: '#fff', fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
                  </div>
                  <div style={{ flex: '2 1 220px' }}>
                    <label style={{ fontSize: 12, fontWeight: 700, color: '#9ca3af', display: 'block', marginBottom: 6 }}>INDICACIONES (opcional)</label>
                    <input value={aiExtra} onChange={e => setAiExtra(e.target.value)} placeholder="Ej: incluye ejemplos de la vida diaria"
                      style={{ width: '100%', background: '#111827', border: '2px solid #374151', borderRadius: 10, padding: '9px 12px', color: '#fff', fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
                  </div>
                </div>
                <div style={{ background: '#111827', border: '1px solid #374151', borderRadius: 12, padding: 14, marginBottom: 14 }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: '#e5e7eb', marginBottom: 6 }}>1 · Copia el prompt y pégalo en tu IA</div>
                  <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 10, lineHeight: 1.5 }}>Sirve en ChatGPT, Gemini, Claude, Copilot… Si dejas el tema vacío, escríbelo luego en tu IA.</div>
                  <button onClick={copiarPrompt}
                    style={{ width: '100%', background: aiCopiado ? '#10b981' : '#374151', color: '#fff', border: 'none', borderRadius: 10, padding: '10px', cursor: 'pointer', fontWeight: 700, fontSize: 14 }}>
                    {aiCopiado ? '✓ Prompt copiado' : '📋 Copiar prompt'}
                  </button>
                  <details style={{ marginTop: 8 }}>
                    <summary style={{ fontSize: 11, color: '#9ca3af', cursor: 'pointer' }}>Ver prompt</summary>
                    <pre style={{ whiteSpace: 'pre-wrap', fontSize: 11, color: '#d1d5db', maxHeight: 180, overflowY: 'auto', margin: '6px 0 0' }}>{promptMiIA}</pre>
                  </details>
                </div>
                <div style={{ background: '#111827', border: '1px solid #374151', borderRadius: 12, padding: 14, marginBottom: 14 }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: '#e5e7eb', marginBottom: 8 }}>2 · Pega aquí la respuesta de tu IA</div>
                  <textarea value={aiPegado} onChange={e => setAiPegado(e.target.value)} placeholder='{ "titulo": "...", "slides": [ ... ] }'
                    style={{ width: '100%', height: 130, background: '#0b1220', border: '2px solid #374151', borderRadius: 10, padding: '10px 12px', color: '#fff', fontSize: 12, fontFamily: 'monospace', outline: 'none', boxSizing: 'border-box', resize: 'vertical' }} />
                  <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginTop: 10, fontSize: 12, color: '#d1d5db', cursor: 'pointer', lineHeight: 1.4 }}>
                    <input type="checkbox" checked={aiCajas} onChange={e => setAiCajas(e.target.checked)} style={{ marginTop: 2 }} />
                    <span><b>Textos en cajas movibles</b> (recomendado): podrás arrastrar, agrandar y añadir imágenes en cada diapositiva. Desmárcalo para usar las plantillas fijas.</span>
                  </label>
                </div>
              </>
            )}
            {aiError && <div style={{ background: '#7f1d1d', color: '#fca5a5', borderRadius: 8, padding: '8px 12px', marginBottom: 12, fontSize: 13 }}>{aiError}</div>}
            {aiModo === 'miIA' && (
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                <button onClick={() => { setShowAI(false); setAiError(''); }} style={{ background: '#374151', color: '#9ca3af', border: 'none', borderRadius: 10, padding: '10px 20px', cursor: 'pointer', fontWeight: 700 }}>Cancelar</button>
                <button onClick={() => importarPegado('anadir')} disabled={!aiPegado.trim()}
                  style={{ background: '#374151', color: '#e5e7eb', border: 'none', borderRadius: 10, padding: '10px 18px', cursor: aiPegado.trim() ? 'pointer' : 'not-allowed', fontWeight: 700, opacity: aiPegado.trim() ? 1 : 0.5 }}>
                  ➕ Añadir al final
                </button>
                <button onClick={() => { if (slides.length > 1 && !window.confirm('Se sustituirán las diapositivas actuales. ¿Continuar?')) return; importarPegado('reemplazar'); }} disabled={!aiPegado.trim()}
                  style={{ background: 'linear-gradient(135deg, #6c63ff, #a855f7)', color: '#fff', border: 'none', borderRadius: 10, padding: '10px 22px', cursor: aiPegado.trim() ? 'pointer' : 'not-allowed', fontWeight: 700, fontSize: 14, opacity: aiPegado.trim() ? 1 : 0.5 }}>
                  📥 Crear presentación
                </button>
              </div>
            )}
            {aiModo === 'gemini' && <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => { setShowAI(false); setAiError(''); }} style={{ background: '#374151', color: '#9ca3af', border: 'none', borderRadius: 10, padding: '10px 20px', cursor: 'pointer', fontWeight: 700 }}>Cancelar</button>
              <button onClick={handleGenerate} disabled={generating || !aiTopic.trim()} style={{ background: generating ? '#374151' : 'linear-gradient(135deg, #6c63ff, #a855f7)', color: '#fff', border: 'none', borderRadius: 10, padding: '10px 24px', cursor: generating ? 'not-allowed' : 'pointer', fontWeight: 700, fontSize: 14, minWidth: 140 }}>
                {generating ? '⏳ Generando…' : '✨ Generar ahora'}
              </button>
            </div>}
          </div>
        </div>
      )}
    </div>
  );
}
