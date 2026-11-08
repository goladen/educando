import React, { memo } from 'react';
import { Corazon } from './Sprites';
import { NEON } from '../tema';

export default memo(function HudJugador({ jugador, cooperativo }) {
  const c = NEON[jugador.color];
  const vidas = Math.max(0, jugador.vidas);
  return (
    <div className="flex items-center justify-between gap-2 border-b-2 border-slate-800 bg-slate-950/80 px-2 py-1.5 font-arcade text-[9px] sm:text-[11px]">
      <span className={`truncate ${c.text} ${c.sombraTexto}`}>{jugador.nombre}</span>
      <span className="tabular-nums text-slate-100">{String(jugador.puntos).padStart(6, '0')}</span>
      <span className="flex items-center gap-2">
        {jugador.racha >= 3 && <span className="text-orange-400">🔥{jugador.racha}</span>}
        <span className="text-slate-400">N{jugador.nivel}</span>
        {!cooperativo && (
          vidas <= 5
            ? <span className="flex gap-0.5">{Array.from({ length: vidas }, (_, k) => <Corazon key={k} />)}</span>
            : <span className="flex items-center gap-1 text-rose-400"><Corazon />×{vidas}</span>
        )}
      </span>
    </div>
  );
});
