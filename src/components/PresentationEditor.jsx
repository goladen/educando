import { useState, useRef, useCallback, useEffect } from 'react';
import { db } from '../firebase';
import { collection, addDoc, updateDoc, doc, serverTimestamp, query, where, getDocs } from 'firebase/firestore';
import { callGeminiProxy, extractText } from '../geminiProxy';

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
};

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

// ─── SLIDE CANVAS ─────────────────────────────────────────────────────────────
function SlideCanvas({ slide, onChange, usuario }) {
  const t = THEMES[slide.theme] || THEMES.dark;
  const fileRef = useRef();
  const [showPicker, setShowPicker] = useState(false);

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

  return (
    <>
      <div style={{ position: 'relative', width: '100%', aspectRatio: '16/9', background: t.bg, borderRadius: 16, overflow: 'hidden', boxShadow: '0 8px 40px rgba(0,0,0,0.4)' }}>
        <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleImage} />
        {renderContent()}
      </div>
      {showPicker && (
        <ResourcePickerModal
          usuario={usuario}
          onSelect={handleSelectResource}
          onClose={() => setShowPicker(false)}
        />
      )}
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
            {activeSlide && <SlideCanvas slide={activeSlide} onChange={updateSlide} usuario={usuario} />}
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
                <div style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>Diseño</div>
                {LAYOUTS.map(l => (
                  <button key={l.id} onClick={() => updateSlide({ ...activeSlide, layout: l.id, ...JSON.parse(JSON.stringify(SLIDE_DEFAULTS[l.id] || {})) })}
                    style={{
                      width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', marginBottom: 4,
                      background: activeSlide?.layout === l.id ? '#374151' : 'transparent',
                      border: `1px solid ${activeSlide?.layout === l.id ? '#6c63ff' : '#374151'}`,
                      borderRadius: 8, color: '#e5e7eb', cursor: 'pointer', fontSize: 12, fontWeight: 600,
                    }}>
                    <span>{l.icon}</span><span>{l.label}</span>
                    {activeSlide?.layout === l.id && <span style={{ marginLeft: 'auto', color: '#6c63ff', fontSize: 10 }}>✓</span>}
                  </button>
                ))}
                {/* Add slide of this layout */}
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
