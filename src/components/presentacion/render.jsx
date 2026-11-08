// Dibujo de los elementos del lienzo libre (editor, miniaturas y exportación).
// Los elementos se colocan en una superficie FIJA de 960×540 px que luego se escala,
// así lo que ve el profe en el editor es exactamente lo que se ve al proyectar.
// OJO: public/pikt-viewer.html replica esta lógica en HTML plano; si cambias cómo se
// dibuja algo aquí, cámbialo también allí.
import katex from 'katex';

export const BASE_W = 960;
export const BASE_H = 540;
export const PX_X = BASE_W / 100; // px por cada 1 % horizontal
export const PX_Y = BASE_H / 100; // px por cada 1 % vertical

let _n = 0;
export const nid = () => `el_${Date.now().toString(36)}${(++_n).toString(36)}`;

// ─── FUENTES (Google Fonts) ───────────────────────────────────────────────────
export const FUENTES = [
  { label: 'Inter', cat: 'Sans', value: "'Inter','Segoe UI',sans-serif", q: 'Inter:wght@400;600;700;900' },
  { label: 'Poppins', cat: 'Sans', value: "'Poppins',sans-serif", q: 'Poppins:wght@400;600;700;900' },
  { label: 'Montserrat', cat: 'Sans', value: "'Montserrat',sans-serif", q: 'Montserrat:wght@400;700;900' },
  { label: 'Nunito', cat: 'Sans', value: "'Nunito',sans-serif", q: 'Nunito:wght@400;700;900' },
  { label: 'Raleway', cat: 'Sans', value: "'Raleway',sans-serif", q: 'Raleway:wght@400;700;900' },
  { label: 'Oswald', cat: 'Sans', value: "'Oswald',sans-serif", q: 'Oswald:wght@400;700' },
  { label: 'Playfair Display', cat: 'Serif', value: "'Playfair Display',serif", q: 'Playfair+Display:ital,wght@0,400;0,700;0,900;1,400' },
  { label: 'Merriweather', cat: 'Serif', value: "'Merriweather',serif", q: 'Merriweather:wght@400;700;900' },
  { label: 'Lora', cat: 'Serif', value: "'Lora',serif", q: 'Lora:ital,wght@0,400;0,700;1,400' },
  { label: 'Roboto Slab', cat: 'Serif', value: "'Roboto Slab',serif", q: 'Roboto+Slab:wght@400;700;900' },
  { label: 'Bebas Neue', cat: 'Display', value: "'Bebas Neue',sans-serif", q: 'Bebas+Neue' },
  { label: 'Righteous', cat: 'Display', value: "'Righteous',sans-serif", q: 'Righteous' },
  { label: 'Lobster', cat: 'Display', value: "'Lobster',cursive", q: 'Lobster' },
  { label: 'Press Start 2P', cat: 'Display', value: "'Press Start 2P',monospace", q: 'Press+Start+2P' },
  { label: 'Special Elite', cat: 'Display', value: "'Special Elite',monospace", q: 'Special+Elite' },
  { label: 'Fredoka', cat: 'Infantil', value: "'Fredoka',sans-serif", q: 'Fredoka:wght@400;600;700' },
  { label: 'Baloo 2', cat: 'Infantil', value: "'Baloo 2',sans-serif", q: 'Baloo+2:wght@400;700' },
  { label: 'Comic Neue', cat: 'Infantil', value: "'Comic Neue',cursive", q: 'Comic+Neue:wght@400;700' },
  { label: 'Patrick Hand', cat: 'Manuscrita', value: "'Patrick Hand',cursive", q: 'Patrick+Hand' },
  { label: 'Caveat', cat: 'Manuscrita', value: "'Caveat',cursive", q: 'Caveat:wght@400;700' },
  { label: 'Dancing Script', cat: 'Manuscrita', value: "'Dancing Script',cursive", q: 'Dancing+Script:wght@400;700' },
  { label: 'Pacifico', cat: 'Manuscrita', value: "'Pacifico',cursive", q: 'Pacifico' },
  { label: 'Indie Flower', cat: 'Manuscrita', value: "'Indie Flower',cursive", q: 'Indie+Flower' },
  { label: 'Permanent Marker', cat: 'Manuscrita', value: "'Permanent Marker',cursive", q: 'Permanent+Marker' },
  { label: 'Amatic SC', cat: 'Manuscrita', value: "'Amatic SC',cursive", q: 'Amatic+SC:wght@400;700' },
  { label: 'Source Code Pro', cat: 'Mono', value: "'Source Code Pro',monospace", q: 'Source+Code+Pro:wght@400;700' },
  // Fuentes del sistema (presentaciones antiguas)
  { label: 'Georgia', cat: 'Sistema', value: "'Georgia',serif" },
  { label: 'Courier', cat: 'Sistema', value: "'Courier New',monospace" },
  { label: 'Arial Black', cat: 'Sistema', value: "'Arial Black',Impact,sans-serif" },
  { label: 'Comic Sans', cat: 'Sistema', value: "'Comic Sans MS',cursive" },
];
export const GOOGLE_FONTS_URL = 'https://fonts.googleapis.com/css2?'
  + FUENTES.filter(f => f.q).map(f => `family=${f.q}`).join('&') + '&display=swap';

export function cargarFuentes() {
  if (typeof document === 'undefined' || document.getElementById('pk-fuentes')) return;
  const l = document.createElement('link');
  l.id = 'pk-fuentes'; l.rel = 'stylesheet'; l.href = GOOGLE_FONTS_URL;
  document.head.appendChild(l);
}

// ─── COLOR / EFECTOS ──────────────────────────────────────────────────────────
export const degradado = g => `linear-gradient(${g.angle ?? 135}deg, ${g.from}, ${g.to})`;

export const SOMBRAS = [
  { id: '', label: 'Ninguna' },
  { id: 'suave', label: 'Suave' },
  { id: 'fuerte', label: 'Fuerte' },
  { id: 'brillo', label: 'Brillo' },
  { id: 'solida', label: 'Sólida' },
];

// Sombra que sigue la silueta (formas, imágenes con máscara…)
export function sombraFiltro(el) {
  const c = el.shadowColor;
  switch (el.shadow) {
    case 'suave': return `drop-shadow(0 6px 12px ${c || 'rgba(0,0,0,0.45)'})`;
    case 'fuerte': return `drop-shadow(0 14px 22px ${c || 'rgba(0,0,0,0.7)'})`;
    case 'brillo': return `drop-shadow(0 0 12px ${c || '#a78bfa'})`;
    case 'solida': return `drop-shadow(6px 6px 0 ${c || '#000000'})`;
    default: return '';
  }
}
export function sombraTexto(el) {
  const c = el.shadowColor;
  switch (el.shadow) {
    case 'suave': return `0 3px 8px ${c || 'rgba(0,0,0,0.5)'}`;
    case 'fuerte': return `0 6px 16px ${c || 'rgba(0,0,0,0.85)'}`;
    case 'brillo': return `0 0 8px ${c || '#a78bfa'}, 0 0 22px ${c || '#a78bfa'}`;
    case 'solida': return `4px 4px 0 ${c || '#000000'}`;
    default: return '';
  }
}

export const FILTROS_DEF = { brillo: 100, contraste: 100, saturacion: 100, gris: 0, sepia: 0, desenfoque: 0, matiz: 0 };
export function filtroCss(f) {
  if (!f) return '';
  const v = { ...FILTROS_DEF, ...f };
  const p = [];
  if (v.brillo !== 100) p.push(`brightness(${v.brillo}%)`);
  if (v.contraste !== 100) p.push(`contrast(${v.contraste}%)`);
  if (v.saturacion !== 100) p.push(`saturate(${v.saturacion}%)`);
  if (v.gris) p.push(`grayscale(${v.gris}%)`);
  if (v.sepia) p.push(`sepia(${v.sepia}%)`);
  if (v.matiz) p.push(`hue-rotate(${v.matiz}deg)`);
  if (v.desenfoque) p.push(`blur(${v.desenfoque}px)`);
  return p.join(' ');
}
export const FILTRO_PRESETS = [
  { id: 'normal', label: 'Normal', f: null },
  { id: 'bn', label: 'B/N', f: { gris: 100 } },
  { id: 'sepia', label: 'Sepia', f: { sepia: 80 } },
  { id: 'vivo', label: 'Vivo', f: { saturacion: 160, contraste: 110 } },
  { id: 'vintage', label: 'Vintage', f: { sepia: 40, contraste: 90, brillo: 105, saturacion: 80 } },
  { id: 'calido', label: 'Cálido', f: { sepia: 25, saturacion: 130, brillo: 104 } },
  { id: 'frio', label: 'Frío', f: { matiz: 15, saturacion: 90, brillo: 104 } },
  { id: 'drama', label: 'Drama', f: { contraste: 140, brillo: 90, saturacion: 80 } },
  { id: 'suave', label: 'Suave', f: { contraste: 80, brillo: 112, saturacion: 85 } },
];

export const MASCARAS = [
  { id: '', label: 'Ninguna', icon: '▭', css: '' },
  { id: 'circulo', label: 'Círculo', icon: '●', css: 'ellipse(50% 50% at 50% 50%)' },
  { id: 'redondeado', label: 'Redondeado', icon: '▢', css: 'inset(0 round 12%)' },
  { id: 'pildora', label: 'Píldora', icon: '⬭', css: 'inset(0 round 999px)' },
  { id: 'arco', label: 'Arco', icon: '⌒', css: 'inset(0 round 50% 50% 0 0)' },
  { id: 'hexagono', label: 'Hexágono', icon: '⬢', css: 'polygon(25% 0, 75% 0, 100% 50%, 75% 100%, 25% 100%, 0 50%)' },
  { id: 'rombo', label: 'Rombo', icon: '◆', css: 'polygon(50% 0, 100% 50%, 50% 100%, 0 50%)' },
  { id: 'triangulo', label: 'Triángulo', icon: '▲', css: 'polygon(50% 0, 100% 100%, 0 100%)' },
  { id: 'estrella', label: 'Estrella', icon: '★', css: 'polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)' },
];
const MASCARA_CSS = Object.fromEntries(MASCARAS.map(m => [m.id, m.css]));

// ─── FORMAS ───────────────────────────────────────────────────────────────────
// d = trazado SVG en un cuadro 0..100; txt = margen interior para el texto dentro de la forma
export const FORMAS = {
  rect: { label: 'Rectángulo', txt: '4%' },
  circle: { label: 'Círculo', txt: '14%' },
  triangle: { label: 'Triángulo', d: 'M50 2 L98 98 L2 98 Z', txt: '40% 18% 4% 18%' },
  diamond: { label: 'Rombo', d: 'M50 2 L98 50 L50 98 L2 50 Z', txt: '25%' },
  pentagon: { label: 'Pentágono', d: 'M50 2 L98 38 L80 98 L20 98 L2 38 Z', txt: '25% 14% 6% 14%' },
  hexagon: { label: 'Hexágono', d: 'M25 3 L75 3 L98 50 L75 97 L25 97 L2 50 Z', txt: '10% 14%' },
  octagon: { label: 'Octógono', d: 'M30 2 L70 2 L98 30 L98 70 L70 98 L30 98 L2 70 L2 30 Z', txt: '12%' },
  star: { label: 'Estrella', d: 'M50 2 L61.8 36 L98 36 L68.5 57.5 L79.5 92 L50 71 L20.5 92 L31.5 57.5 L2 36 L38.2 36 Z', txt: '34% 26% 22% 26%' },
  heart: { label: 'Corazón', d: 'M50 92 C20 70 2 52 2 30 C2 14 14 4 28 4 C38 4 46 10 50 18 C54 10 62 4 72 4 C86 4 98 14 98 30 C98 52 80 70 50 92 Z', txt: '18% 16% 26% 16%' },
  bubble: { label: 'Bocadillo', d: 'M8 4 L92 4 Q98 4 98 10 L98 62 Q98 68 92 68 L40 68 L22 94 L26 68 L8 68 Q2 68 2 62 L2 10 Q2 4 8 4 Z', txt: '4% 4% 34% 4%' },
  cloud: { label: 'Nube', d: 'M25 82 C10 82 2 72 2 60 C2 47 12 39 24 40 C25 25 37 14 51 14 C64 14 74 22 77 34 C90 34 98 45 98 58 C98 71 88 82 75 82 Z', txt: '28% 14% 20% 14%' },
  arrow: { label: 'Flecha', d: 'M2 35 L62 35 L62 12 L98 50 L62 88 L62 65 L2 65 Z', txt: '34% 30% 34% 4%' },
  arrowL: { label: 'Flecha izq.', d: 'M98 35 L38 35 L38 12 L2 50 L38 88 L38 65 L98 65 Z', txt: '34% 4% 34% 30%' },
  doubleArrow: { label: 'Doble flecha', d: 'M2 50 L25 15 L25 35 L75 35 L75 15 L98 50 L75 85 L75 65 L25 65 L25 85 Z', txt: '34% 22%' },
  chevron: { label: 'Paso', d: 'M2 4 L72 4 L98 50 L72 96 L2 96 L28 50 Z', txt: '10% 24% 10% 28%' },
  banner: { label: 'Cinta', d: 'M2 18 L98 18 L86 50 L98 82 L2 82 L14 50 Z', txt: '20% 16%' },
  parallelogram: { label: 'Paralelogramo', d: 'M22 4 L98 4 L78 96 L2 96 Z', txt: '8% 22%' },
  trapezoid: { label: 'Trapecio', d: 'M22 4 L78 4 L98 96 L2 96 Z', txt: '8% 18%' },
  cross: { label: 'Cruz', d: 'M35 2 L65 2 L65 35 L98 35 L98 65 L65 65 L65 98 L35 98 L35 65 L2 65 L2 35 L35 35 Z', txt: '36%' },
  lightning: { label: 'Rayo', d: 'M58 2 L18 56 L46 56 L38 98 L82 40 L54 40 Z', txt: '40%' },
  moon: { label: 'Luna', d: 'M62 4 A46 46 0 1 0 96 70 A38 38 0 1 1 62 4 Z', txt: '30%' },
  line: { label: 'Línea' },
};

// Vector de un degradado CSS (0° = hacia arriba) en unidades del cuadro de la forma
function vectorDegradado(angle = 135) {
  const a = angle * Math.PI / 180, s = Math.sin(a), c = Math.cos(a);
  return { x1: 0.5 - s / 2, y1: 0.5 + c / 2, x2: 0.5 + s / 2, y2: 0.5 - c / 2 };
}
const giro = el => (el.flipH || el.flipV) ? `scale(${el.flipH ? -1 : 1},${el.flipV ? -1 : 1})` : undefined;

// ─── TEXTO ────────────────────────────────────────────────────────────────────
export function estiloTexto(el, t, enForma = false) {
  const st = el.textStyle;
  const defColor = enForma ? '#ffffff' : st === 'cta' ? t.accent : st === 'sub' ? t.sub : t.text;
  const defSize = st === 'heading' ? 32 : st === 'sub' ? 14 : enForma ? 18 : 16;
  const defWt = st === 'heading' ? 'bold' : st === 'sub' ? '600' : enForma ? '700' : 'normal';
  const s = {
    fontFamily: el.fontFamily || "'Inter','Segoe UI',sans-serif",
    fontSize: `${el.fontSize || defSize}px`,
    fontWeight: el.fontWeight || defWt,
    fontStyle: el.fontStyle || 'normal',
    textDecoration: el.textDecoration || 'none',
    textAlign: el.textAlign || (enForma ? 'center' : 'left'),
    color: el.color || defColor,
    lineHeight: el.lineHeight || (enForma ? 1.25 : 1.5),
    letterSpacing: el.letterSpacing != null ? `${el.letterSpacing}em` : (st === 'sub' ? '0.1em' : 'normal'),
    textTransform: el.uppercase ? 'uppercase' : 'none',
  };
  const ts = sombraTexto(el);
  if (ts) s.textShadow = ts;
  if (el.textStrokeW) {
    s.WebkitTextStroke = `${el.textStrokeW}px ${el.textStrokeColor || '#000000'}`;
    s.paintOrder = 'stroke fill';
  }
  if (el.gradient) {
    s.backgroundImage = degradado(el.gradient);
    s.WebkitBackgroundClip = 'text';
    s.backgroundClip = 'text';
    s.WebkitTextFillColor = 'transparent';
    s.color = el.gradient.from;
    if (ts) { delete s.textShadow; s.filter = sombraFiltro(el); }
  }
  return s;
}

const PREFIJOS = {
  bullet: () => '•',
  number: i => `${i + 1}.`,
  check: () => '✓',
  arrow: () => '➜',
  star: () => '★',
};
export const LISTAS = [
  { id: '', label: 'Sin lista', icon: '¶' },
  { id: 'bullet', label: 'Viñetas', icon: '•' },
  { id: 'number', label: 'Numerada', icon: '1.' },
  { id: 'check', label: 'Objetivos', icon: '✓' },
  { id: 'arrow', label: 'Flechas', icon: '➜' },
  { id: 'star', label: 'Estrellas', icon: '★' },
];

function TextoVisible({ el, t, estilo }) {
  if (!el.lista || !PREFIJOS[el.lista]) {
    return <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{el.text || ''}</div>;
  }
  const just = estilo.textAlign === 'center' ? 'center' : estilo.textAlign === 'right' ? 'flex-end' : 'flex-start';
  const marca = el.listaColor || (el.gradient ? el.gradient.from : t.accent);
  let k = 0;
  return String(el.text || '').split('\n').map((l, i) => (
    l.trim() === ''
      ? <div key={i}>&nbsp;</div>
      : <div key={i} style={{ display: 'flex', gap: '0.45em', justifyContent: just }}>
          <span style={{ flexShrink: 0, color: marca, WebkitTextFillColor: marca, fontWeight: 800 }}>{PREFIJOS[el.lista](k++)}</span>
          <span style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{l}</span>
        </div>
  ));
}

function CajaTexto({ el, t, enForma, editando, onTexto, onFinEdicion }) {
  const v = el.vAlign || (enForma ? 'middle' : 'top');
  const caja = {
    width: '100%', height: '100%', boxSizing: 'border-box',
    padding: el.bgColor ? '6px 12px' : enForma ? '4px 8px' : '4px 6px',
    display: 'flex', flexDirection: 'column',
    justifyContent: v === 'middle' ? 'center' : v === 'bottom' ? 'flex-end' : 'flex-start',
    background: el.bgColor || undefined,
    borderRadius: el.bgColor ? (el.bgRadius ?? 8) : undefined,
  };
  if (editando) {
    const est = estiloTexto({ ...el, gradient: null }, t, enForma);
    return (
      <div style={caja}>
        <textarea autoFocus value={el.text || ''}
          onChange={e => onTexto?.(e.target.value)}
          onBlur={onFinEdicion}
          onPointerDown={e => e.stopPropagation()}
          onKeyDown={e => { if (e.key === 'Escape') { e.preventDefault(); e.currentTarget.blur(); } e.stopPropagation(); }}
          onFocus={e => { const n = e.currentTarget.value.length; e.currentTarget.setSelectionRange(n, n); }}
          style={{ ...est, width: '100%', height: '100%', background: 'transparent', border: 'none', outline: 'none', resize: 'none', padding: 0, margin: 0, overflow: 'hidden', cursor: 'text' }} />
      </div>
    );
  }
  const est = estiloTexto(el, t, enForma);
  return (
    <div style={{ ...caja, ...est }}>
      <TextoVisible el={el} t={t} estilo={est} />
    </div>
  );
}

// ─── LÍNEA (se dibuja en píxeles reales: no se deforma al estirar) ────────────
function Linea({ el, t }) {
  const W = Math.max(1, el.w * PX_X), H = Math.max(1, el.h * PX_Y);
  const sw = el.strokeWidth || 3;
  const col = el.fill || t.text;
  const y = H / 2;
  const cab = Math.max(10, sw * 3.2);
  const fin = (el.lineEnd === 'arrow' || el.lineEnd === 'both') ? cab * 0.9 : 0;
  const ini = el.lineEnd === 'both' ? cab * 0.9 : 0;
  const dash = el.strokeDash === 'dashed' ? `${sw * 3} ${sw * 2}` : el.strokeDash === 'dotted' ? `0.1 ${sw * 2}` : undefined;
  return (
    <svg width="100%" height="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: 'block', overflow: 'visible' }}>
      <line x1={sw / 2 + ini} y1={y} x2={W - sw / 2 - fin} y2={y} stroke={col} strokeWidth={sw} strokeLinecap="round" strokeDasharray={dash} />
      {fin > 0 && <polygon points={`${W},${y} ${W - cab},${y - cab * 0.6} ${W - cab},${y + cab * 0.6}`} fill={col} />}
      {ini > 0 && <polygon points={`0,${y} ${cab},${y - cab * 0.6} ${cab},${y + cab * 0.6}`} fill={col} />}
    </svg>
  );
}

function Forma({ el, t, editando, onTexto, onFinEdicion }) {
  const tipo = FORMAS[el.shapeType] ? el.shapeType : 'rect';
  if (tipo === 'line') {
    return <div style={{ width: '100%', height: '100%', filter: sombraFiltro(el) || undefined }}><Linea el={el} t={t} /></div>;
  }
  const trazo = el.stroke && el.stroke !== 'none' ? el.stroke : null;
  const sw = el.strokeWidth ?? 2;
  let figura;
  if (tipo === 'rect' || tipo === 'circle') {
    figura = (
      <div style={{
        width: '100%', height: '100%', boxSizing: 'border-box',
        background: el.fillGradient ? degradado(el.fillGradient) : (el.fill || '#6c63ff'),
        borderRadius: tipo === 'circle' ? '50%' : `${el.borderRadius || 0}px`,
        border: trazo ? `${sw}px ${el.strokeDash || 'solid'} ${trazo}` : 'none',
      }} />
    );
  } else {
    const gid = `pkg_${el.id}`;
    const v = vectorDegradado(el.fillGradient?.angle);
    const dash = el.strokeDash === 'dashed' ? `${sw * 3} ${sw * 2}` : el.strokeDash === 'dotted' ? `1 ${sw * 2}` : undefined;
    figura = (
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ width: '100%', height: '100%', display: 'block', overflow: 'visible', transform: giro(el) }}>
        {el.fillGradient && (
          <defs>
            <linearGradient id={gid} x1={v.x1} y1={v.y1} x2={v.x2} y2={v.y2}>
              <stop offset="0" stopColor={el.fillGradient.from} />
              <stop offset="1" stopColor={el.fillGradient.to} />
            </linearGradient>
          </defs>
        )}
        <path d={FORMAS[tipo].d} fill={el.fillGradient ? `url(#${gid})` : (el.fill || '#6c63ff')}
          stroke={trazo || 'none'} strokeWidth={trazo ? sw : 0} vectorEffect="non-scaling-stroke"
          strokeDasharray={dash} strokeLinejoin="round" strokeLinecap="round" />
      </svg>
    );
  }
  const conTexto = editando || (el.text && String(el.text).length > 0);
  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', filter: sombraFiltro(el) || undefined }}>
      {figura}
      {conTexto && (
        <div style={{ position: 'absolute', inset: FORMAS[tipo].txt || '6%' }}>
          <CajaTexto el={el} t={t} enForma editando={editando} onTexto={onTexto} onFinEdicion={onFinEdicion} />
        </div>
      )}
    </div>
  );
}

function Imagen({ el }) {
  const mask = MASCARA_CSS[el.mask || ''];
  return (
    <div style={{ width: '100%', height: '100%', filter: sombraFiltro(el) || undefined }}>
      <img src={el.src} alt="" draggable={false} style={{
        width: '100%', height: '100%', display: 'block', boxSizing: 'border-box',
        objectFit: el.objectFit || 'cover', objectPosition: el.objPos || 'center',
        borderRadius: mask ? 0 : `${el.borderRadius || 0}px`,
        clipPath: mask || undefined,
        filter: filtroCss(el.filters) || undefined,
        transform: giro(el),
        border: el.borderW ? `${el.borderW}px solid ${el.borderColor || '#ffffff'}` : undefined,
      }} />
    </div>
  );
}

// Contenido de un elemento (sin posición). estatico = miniatura/exportación (sin iframes)
export function ElementoContenido({ el, t, estatico = false, editando = false, onTexto, onFinEdicion }) {
  switch (el.type) {
    case 'text':
      return <CajaTexto el={el} t={t} editando={editando} onTexto={onTexto} onFinEdicion={onFinEdicion} />;
    case 'shape':
      return <Forma el={el} t={t} editando={editando} onTexto={onTexto} onFinEdicion={onFinEdicion} />;
    case 'image':
      return <Imagen el={el} />;
    case 'music':
      return (
        <div style={{ width: '100%', height: '100%', position: 'relative' }}>
          <img src={el.src} alt="" draggable={false} style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }} />
          <div style={{ position: 'absolute', bottom: 4, right: 4, background: 'rgba(0,0,0,0.6)', border: '2px solid rgba(255,255,255,0.5)', color: '#fff', borderRadius: '50%', width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, pointerEvents: 'none' }}>▶</div>
        </div>
      );
    case 'youtube':
      return (
        <div style={{ width: '100%', height: '100%', position: 'relative', background: '#000', overflow: 'hidden' }}>
          {el.thumb && <img src={el.thumb} alt="" draggable={false} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ width: 52, height: 52, background: 'rgba(255,0,0,0.9)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 12px rgba(0,0,0,0.6)' }}>
              <span style={{ color: '#fff', fontSize: 20, marginLeft: 4 }}>▶</span>
            </div>
          </div>
        </div>
      );
    case 'webview':
      if (estatico) {
        return (
          <div style={{ width: '100%', height: '100%', background: '#0f172a', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, color: '#94a3b8', fontSize: 14, overflow: 'hidden' }}>
            <span style={{ fontSize: 34 }}>🌐</span>
            <span style={{ maxWidth: '90%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{el.src}</span>
          </div>
        );
      }
      return (
        <div style={{ width: '100%', height: '100%', position: 'relative', background: '#0f172a', overflow: 'hidden' }}>
          <iframe src={el.src} style={{ width: '100%', height: '100%', border: 'none' }} title="web" sandbox="allow-scripts allow-same-origin allow-forms" />
          <div style={{ position: 'absolute', inset: 0 }} />
        </div>
      );
    case 'equation': {
      let html = '';
      try { html = katex.renderToString(el.latex || '', { throwOnError: false, displayMode: true, output: 'html' }); } catch { /* latex inválido */ }
      return (
        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', padding: '2px 6px', boxSizing: 'border-box', filter: sombraFiltro(el) || undefined }}>
          <div style={{ color: el.color || t.text, fontSize: `${el.fontSize || 28}px`, lineHeight: 1, userSelect: 'none', pointerEvents: 'none', maxWidth: '100%' }}
            dangerouslySetInnerHTML={{ __html: html }} />
        </div>
      );
    }
    default:
      return null;
  }
}

// Posición del elemento dentro de la superficie
export function estiloCaja(el, conOpacidad = true) {
  return {
    position: 'absolute', left: `${el.x}%`, top: `${el.y}%`, width: `${el.w}%`, height: `${el.h}%`,
    transform: el.rotation ? `rotate(${el.rotation}deg)` : undefined,
    opacity: conOpacidad ? (el.opacity ?? 1) : undefined,
    boxSizing: 'border-box',
  };
}

// ─── FONDO DE LA DIAPOSITIVA ──────────────────────────────────────────────────
export function fondoCss(slide, t) {
  if (slide.bgImage) {
    const o = slide.bgOverlay || 0;
    const capa = o ? `linear-gradient(rgba(0,0,0,${o}), rgba(0,0,0,${o})), ` : '';
    return { background: `${capa}url("${slide.bgImage}") center / cover no-repeat` };
  }
  if (slide.bgGradient) return { background: degradado(slide.bgGradient) };
  if (slide.bgColor) return { background: slide.bgColor };
  return { background: t.bg };
}

// ─── ANIMACIONES ──────────────────────────────────────────────────────────────
export const ANIMACIONES = [
  { id: '', label: 'Ninguna', icon: '⛔' },
  { id: 'fade', label: 'Aparecer', icon: '🌫️' },
  { id: 'up', label: 'Subir', icon: '⬆️' },
  { id: 'down', label: 'Bajar', icon: '⬇️' },
  { id: 'left', label: 'Desde la dcha.', icon: '⬅️' },
  { id: 'right', label: 'Desde la izq.', icon: '➡️' },
  { id: 'zoom', label: 'Zoom', icon: '🔍' },
  { id: 'pop', label: 'Rebote', icon: '💥' },
  { id: 'drop', label: 'Caída', icon: '🪂' },
  { id: 'spin', label: 'Remolino', icon: '🌀' },
  { id: 'flip', label: 'Voltear', icon: '🔄' },
  { id: 'blur', label: 'Enfocar', icon: '✨' },
];
export const BUCLES = [
  { id: '', label: 'Ninguno' },
  { id: 'pulse', label: 'Latido', dur: 1.8 },
  { id: 'float', label: 'Flotar', dur: 3 },
  { id: 'wiggle', label: 'Balanceo', dur: 1.4 },
  { id: 'girar', label: 'Girar', dur: 6 },
  { id: 'parpadeo', label: 'Parpadeo', dur: 1.6 },
];
const DUR_BUCLE = Object.fromEntries(BUCLES.map(b => [b.id, b.dur]));

export const TRANSICIONES = [
  { id: '', label: 'Suave (por defecto)' },
  { id: 'fade', label: 'Fundido' },
  { id: 'slide', label: 'Deslizar' },
  { id: 'zoom', label: 'Zoom' },
  { id: 'flip', label: 'Giro 3D' },
  { id: 'none', label: 'Sin transición' },
];

export function estiloEntrada(anim) {
  if (!anim?.tipo) return null;
  return { animation: `pk-${anim.tipo} ${anim.dur ?? 0.7}s cubic-bezier(.2,.8,.2,1) ${anim.delay ?? 0}s both` };
}
export function estiloBucle(anim) {
  if (!anim?.bucle || !DUR_BUCLE[anim.bucle]) return null;
  const ini = anim.tipo ? (anim.delay ?? 0) + (anim.dur ?? 0.7) : 0;
  const curva = anim.bucle === 'girar' ? 'linear' : 'ease-in-out';
  return { animation: `pk-l-${anim.bucle} ${DUR_BUCLE[anim.bucle]}s ${curva} ${ini}s infinite` };
}
// Tiempo (s) que tardan en terminar las animaciones de entrada de una diapositiva
export function duracionEntradas(els = []) {
  return els.reduce((m, e) => e.anim?.tipo ? Math.max(m, (e.anim.delay ?? 0) + (e.anim.dur ?? 0.7)) : m, 0);
}

export const KEYFRAMES_CSS = `
@keyframes pk-fade { from { opacity: 0 } to { opacity: 1 } }
@keyframes pk-up { from { opacity: 0; transform: translateY(40px) } to { opacity: 1; transform: none } }
@keyframes pk-down { from { opacity: 0; transform: translateY(-40px) } to { opacity: 1; transform: none } }
@keyframes pk-left { from { opacity: 0; transform: translateX(70px) } to { opacity: 1; transform: none } }
@keyframes pk-right { from { opacity: 0; transform: translateX(-70px) } to { opacity: 1; transform: none } }
@keyframes pk-zoom { from { opacity: 0; transform: scale(.4) } to { opacity: 1; transform: none } }
@keyframes pk-pop { 0% { opacity: 0; transform: scale(.3) } 60% { opacity: 1; transform: scale(1.12) } 80% { transform: scale(.95) } 100% { opacity: 1; transform: none } }
@keyframes pk-drop { 0% { opacity: 0; transform: translateY(-140px) } 60% { opacity: 1; transform: translateY(12px) } 80% { transform: translateY(-6px) } 100% { opacity: 1; transform: none } }
@keyframes pk-spin { from { opacity: 0; transform: rotate(-200deg) scale(.3) } to { opacity: 1; transform: none } }
@keyframes pk-flip { from { opacity: 0; transform: perspective(700px) rotateY(90deg) } to { opacity: 1; transform: none } }
@keyframes pk-blur { from { opacity: 0; filter: blur(16px) } to { opacity: 1; filter: none } }
@keyframes pk-l-pulse { 0%, 100% { transform: scale(1) } 50% { transform: scale(1.08) } }
@keyframes pk-l-float { 0%, 100% { transform: translateY(0) } 50% { transform: translateY(-12px) } }
@keyframes pk-l-wiggle { 0%, 100% { transform: rotate(-4deg) } 50% { transform: rotate(4deg) } }
@keyframes pk-l-girar { from { transform: rotate(0) } to { transform: rotate(360deg) } }
@keyframes pk-l-parpadeo { 0%, 100% { opacity: 1 } 50% { opacity: .4 } }
`;

// ─── SUPERFICIE ESTÁTICA (miniaturas de diapositivas y de plantillas) ─────────
export function SuperficieEstatica({ slide, t, ancho, conFondo = true }) {
  const k = ancho / BASE_W;
  return (
    <div style={{ position: 'relative', width: ancho, height: ancho * 9 / 16, overflow: 'hidden', ...(conFondo ? fondoCss(slide, t) : {}) }}>
      <div style={{ position: 'absolute', left: 0, top: 0, width: BASE_W, height: BASE_H, transform: `scale(${k})`, transformOrigin: '0 0', pointerEvents: 'none' }}>
        {(slide.elements || []).filter(e => !e.hidden).map(el => (
          <div key={el.id} style={estiloCaja(el)}>
            <ElementoContenido el={el} t={t} estatico />
          </div>
        ))}
      </div>
    </div>
  );
}
