// Estética arcade compartida (clases Tailwind completas: Tailwind solo detecta cadenas literales).

export const COLORES_JUGADOR = ['cyan', 'fuchsia', 'lime', 'amber'];

export const NEON = {
  cyan: {
    hex: '#22d3ee', text: 'text-cyan-300', borde: 'border-cyan-400', bg: 'bg-cyan-400', bgSuave: 'bg-cyan-400/15',
    glow: 'shadow-[0_0_16px_rgba(34,211,238,0.55)]', sombraTexto: 'drop-shadow-[0_0_6px_rgba(34,211,238,0.9)]',
  },
  fuchsia: {
    hex: '#e879f9', text: 'text-fuchsia-300', borde: 'border-fuchsia-400', bg: 'bg-fuchsia-400', bgSuave: 'bg-fuchsia-400/15',
    glow: 'shadow-[0_0_16px_rgba(232,121,249,0.55)]', sombraTexto: 'drop-shadow-[0_0_6px_rgba(232,121,249,0.9)]',
  },
  lime: {
    hex: '#a3e635', text: 'text-lime-300', borde: 'border-lime-400', bg: 'bg-lime-400', bgSuave: 'bg-lime-400/15',
    glow: 'shadow-[0_0_16px_rgba(163,230,53,0.55)]', sombraTexto: 'drop-shadow-[0_0_6px_rgba(163,230,53,0.9)]',
  },
  amber: {
    hex: '#fbbf24', text: 'text-amber-300', borde: 'border-amber-400', bg: 'bg-amber-400', bgSuave: 'bg-amber-400/15',
    glow: 'shadow-[0_0_16px_rgba(251,191,36,0.55)]', sombraTexto: 'drop-shadow-[0_0_6px_rgba(251,191,36,0.9)]',
  },
};

// Colores de los aliens (independientes del jugador)
export const COLOR_ALIEN = ['#f472b6', '#4ade80', '#60a5fa', '#facc15', '#c084fc', '#fb923c'];

// Botones grandes para pizarra / tablet: pointer events, sin selección, «hundirse» al pulsar.
const BASE = 'font-arcade select-none touch-none rounded-lg border-b-4 transition-transform duration-75 active:translate-y-1 active:border-b-0 disabled:opacity-40 disabled:active:translate-y-0';

export const BTN = {
  tecla: `${BASE} bg-slate-800 border-slate-950 text-slate-100 hover:bg-slate-700`,
  fuego: `${BASE} bg-green-500 border-green-800 text-slate-950 hover:bg-green-400 shadow-[0_0_18px_rgba(34,197,94,0.7)]`,
  borrar: `${BASE} bg-rose-600 border-rose-900 text-white hover:bg-rose-500`,
  del: `${BASE} bg-amber-500 border-amber-800 text-slate-950 hover:bg-amber-400`,
  mover: `${BASE} bg-indigo-600 border-indigo-900 text-white hover:bg-indigo-500`,
  menu: `${BASE} bg-slate-800 border-slate-950 text-slate-100 hover:bg-slate-700 px-4 py-3`,
  primario: `${BASE} bg-cyan-400 border-cyan-700 text-slate-950 hover:bg-cyan-300 shadow-[0_0_20px_rgba(34,211,238,0.6)] px-6 py-4`,
  peligro: `${BASE} bg-rose-600 border-rose-900 text-white hover:bg-rose-500 px-4 py-3`,
};

// Chip seleccionable de los menús
export const chip = (activo) =>
  `font-arcade text-[10px] sm:text-xs px-3 py-2.5 rounded-md border-2 transition-colors select-none ${
    activo
      ? 'border-cyan-300 bg-cyan-400/20 text-cyan-200 shadow-[0_0_12px_rgba(34,211,238,0.45)]'
      : 'border-slate-600 bg-slate-800/60 text-slate-300 hover:border-slate-400'
  }`;

export const PANEL = 'rounded-xl border-2 border-slate-700 bg-slate-900/90 p-4 sm:p-5';
export const TITULO_NEON = 'font-arcade text-cyan-300 drop-shadow-[0_0_8px_rgba(34,211,238,0.9)]';
