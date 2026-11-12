// Variante 2: pregunta arriba (CabeceraFiltro) y mando ◀ FUEGO ▶ abajo (PanelFiltro).
// ◀ y ▶ son «mantener pulsado»: pointerdown activa, pointerup/cancel/leave suelta.
import React, { memo } from 'react';
import PreguntaDisplay from './PreguntaDisplay';
import { BTN } from '../tema';

export const CabeceraFiltro = memo(function CabeceraFiltro({ pregunta }) {
  return (
    <div className="border-b-2 border-slate-800 bg-slate-950/85 px-2 py-1.5 sm:py-2">
      <PreguntaDisplay pregunta={pregunta} compacta />
      <div className="mt-1 text-center font-arcade text-[7px] text-slate-500 sm:text-[8px]">DESTRUYE LAS FALSAS · DEJA PASAR LA CORRECTA</div>
    </div>
  );
});

const mantener = (onCambio) => ({
  tabIndex: -1,
  onMouseDown: (e) => e.preventDefault(),
  onPointerDown: (e) => { e.preventDefault(); e.currentTarget.setPointerCapture?.(e.pointerId); onCambio(true); },
  onPointerUp: () => onCambio(false),
  onPointerCancel: () => onCambio(false),
  onLostPointerCapture: () => onCambio(false),
  onContextMenu: (e) => e.preventDefault(),
});

const ALTO = 'min-h-[clamp(52px,9vh,84px)]';

export const PanelFiltro = memo(function PanelFiltro({ jugador, onInput, horizontal }) {
  const set = (k) => (v) => onInput(jugador.id, { [k]: v });
  return (
    <div className={`grid gap-2 bg-slate-900 p-2 sm:p-3 ${horizontal ? 'h-full grid-cols-2 content-center border-l-2 border-slate-800' : 'grid-cols-[1fr_1.4fr_1fr] border-t-2 border-slate-800'}`}>
      <button type="button" aria-label="Izquierda" disabled={jugador.eliminado} {...mantener(set('izq'))}
        className={`${BTN.mover} ${ALTO} text-[length:clamp(16px,3.4vh,28px)]`}>◀</button>
      <button type="button" disabled={jugador.eliminado}
        {...mantener((v) => onInput(jugador.id, v ? { fuego: true, toque: true } : { fuego: false }))}
        className={`${BTN.fuego} ${ALTO} text-[length:clamp(11px,2.4vh,18px)] tracking-widest ${horizontal ? 'order-first col-span-2' : ''}`}>▲ FUEGO</button>
      <button type="button" aria-label="Derecha" disabled={jugador.eliminado} {...mantener(set('der'))}
        className={`${BTN.mover} ${ALTO} text-[length:clamp(16px,3.4vh,28px)]`}>▶</button>
    </div>
  );
});
