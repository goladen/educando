// Temas de color de las presentaciones. OJO: public/pikt-viewer.html tiene una copia
// (y PresentationList.jsx una versión reducida); si añades uno, añádelo allí también.
export const THEMES = {
  dark: {
    label: 'Oscuro',
    bg: 'linear-gradient(135deg, #1a0533 0%, #0d1b4a 50%, #0a0a1a 100%)',
    accent: '#6c63ff', text: '#ffffff', sub: 'rgba(255,255,255,0.65)',
    card: 'rgba(255,255,255,0.07)', cardBorder: 'rgba(255,255,255,0.12)',
    tag: 'rgba(108,99,255,0.25)', tagBorder: 'rgba(108,99,255,0.5)', tagText: '#a78bfa',
  },
  purple: {
    label: 'Morado',
    bg: 'linear-gradient(135deg, #6c63ff 0%, #a855f7 60%, #ec4899 100%)',
    accent: '#ffffff', text: '#ffffff', sub: 'rgba(255,255,255,0.8)',
    card: 'rgba(255,255,255,0.2)', cardBorder: 'rgba(255,255,255,0.3)',
    tag: 'rgba(255,255,255,0.2)', tagBorder: 'rgba(255,255,255,0.4)', tagText: '#ffffff',
  },
  light: {
    label: 'Claro',
    bg: '#f0f4ff',
    accent: '#6c63ff', text: '#1a1a2e', sub: '#555',
    card: '#ffffff', cardBorder: '#e8e8ff',
    tag: '#ede9fe', tagBorder: '#c4b5fd', tagText: '#6c63ff',
  },
  blue: {
    label: 'Azul Noche',
    bg: 'linear-gradient(160deg, #0A0E45 0%, #0d0d2b 100%)',
    accent: '#a78bfa', text: '#ffffff', sub: 'rgba(255,255,255,0.65)',
    card: 'rgba(255,255,255,0.08)', cardBorder: 'rgba(255,255,255,0.12)',
    tag: 'rgba(108,99,255,0.25)', tagBorder: 'rgba(108,99,255,0.5)', tagText: '#a78bfa',
  },
  green: {
    label: 'Verde',
    bg: 'linear-gradient(135deg, #064e3b 0%, #065f46 100%)',
    accent: '#34d399', text: '#ffffff', sub: 'rgba(255,255,255,0.75)',
    card: 'rgba(255,255,255,0.1)', cardBorder: 'rgba(52,211,153,0.3)',
    tag: 'rgba(52,211,153,0.2)', tagBorder: 'rgba(52,211,153,0.5)', tagText: '#6ee7b7',
  },
  orange: {
    label: 'Naranja',
    bg: 'linear-gradient(135deg, #7c2d12 0%, #431407 100%)',
    accent: '#fb923c', text: '#ffffff', sub: 'rgba(255,255,255,0.75)',
    card: 'rgba(255,255,255,0.1)', cardBorder: 'rgba(251,146,60,0.3)',
    tag: 'rgba(251,146,60,0.2)', tagBorder: 'rgba(251,146,60,0.5)', tagText: '#fdba74',
  },
  blanco: {
    label: 'Blanco',
    bg: '#ffffff',
    accent: '#2563eb', text: '#111827', sub: '#4b5563',
    card: '#f3f4f6', cardBorder: '#e5e7eb',
    tag: '#dbeafe', tagBorder: '#93c5fd', tagText: '#1d4ed8',
  },
  pizarra: {
    label: 'Pizarra',
    bg: 'linear-gradient(160deg, #1f3b2c 0%, #16291f 100%)',
    accent: '#fde68a', text: '#f8fafc', sub: 'rgba(248,250,252,0.75)',
    card: 'rgba(255,255,255,0.08)', cardBorder: 'rgba(253,230,138,0.35)',
    tag: 'rgba(253,230,138,0.18)', tagBorder: 'rgba(253,230,138,0.5)', tagText: '#fde68a',
  },
  papel: {
    label: 'Papel',
    bg: '#fdf6e3',
    accent: '#b45309', text: '#3f2d1a', sub: '#7c5e3c',
    card: '#fffaf0', cardBorder: '#e9d8b4',
    tag: '#fde9c4', tagBorder: '#e0b973', tagText: '#92400e',
  },
  coral: {
    label: 'Coral',
    bg: 'linear-gradient(135deg, #ff7e5f 0%, #feb47b 100%)',
    accent: '#ffffff', text: '#ffffff', sub: 'rgba(255,255,255,0.85)',
    card: 'rgba(255,255,255,0.22)', cardBorder: 'rgba(255,255,255,0.4)',
    tag: 'rgba(255,255,255,0.25)', tagBorder: 'rgba(255,255,255,0.5)', tagText: '#ffffff',
  },
  oceano: {
    label: 'Océano',
    bg: 'linear-gradient(135deg, #0ea5e9 0%, #1e3a8a 100%)',
    accent: '#fde047', text: '#ffffff', sub: 'rgba(255,255,255,0.8)',
    card: 'rgba(255,255,255,0.14)', cardBorder: 'rgba(255,255,255,0.3)',
    tag: 'rgba(253,224,71,0.2)', tagBorder: 'rgba(253,224,71,0.5)', tagText: '#fef08a',
  },
};

// ¿Es un color claro? (para elegir texto oscuro o claro encima)
export function esClaro(color) {
  const c = String(color || '').trim();
  let r, g, b;
  const hex = c.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hex) {
    let h = hex[1];
    if (h.length === 3) h = h.split('').map(x => x + x).join('');
    r = parseInt(h.slice(0, 2), 16); g = parseInt(h.slice(2, 4), 16); b = parseInt(h.slice(4, 6), 16);
  } else {
    const rgb = c.match(/rgba?\(([^)]+)\)/i);
    if (!rgb) return false;
    [r, g, b] = rgb[1].split(',').map(v => parseFloat(v));
  }
  return (0.299 * r + 0.587 * g + 0.114 * b) > 170;
}

// Color de texto legible sobre un fondo dado
export const sobreColor = (fondo) => (esClaro(fondo) ? '#1f2937' : '#ffffff');
