// Panel de control de la variante 1: pregunta + lo tecleado + teclado virtual.
import React, { memo } from 'react';
import PreguntaDisplay from './PreguntaDisplay';
import Keypad from './Keypad';
import { modoTeclado } from '../preguntas';
import { NEON } from '../tema';

export default memo(function PanelDispara({ jugador, pregunta, onTecla, onFuego, bloqueado, escribir, horizontal, mandos }) {
  const c = NEON[jugador.color];
  const modo = modoTeclado(pregunta, escribir, mandos);
  const error = jugador.feedback?.tipo === 'error';
  const acierto = jugador.feedback?.tipo === 'acierto';
  return (
    <div className={`flex flex-col gap-2 bg-slate-900 p-2 sm:p-3 ${horizontal ? 'h-full justify-center overflow-y-auto border-l-2 border-slate-800' : 'border-t-2 border-slate-800'}`}>
      <PreguntaDisplay pregunta={pregunta} compacta={!horizontal} />
      {modo !== 'opciones' && (
        <div key={error ? jugador.feedback.t : 'ok'}
          className={`flex min-h-[clamp(36px,6vh,56px)] items-center justify-center rounded-md border-2 bg-slate-950 px-3 font-pixel text-[length:clamp(24px,4.5vh,40px)] leading-none tabular-nums
            ${error ? 'animate-inv-temblor border-rose-500 text-rose-400' : acierto ? 'border-green-400 text-green-300' : `${c.borde} text-slate-50`}`}>
          {jugador.entrada || <span className="text-slate-600">{error ? '✗' : '_'}</span>}
          <span className="ml-1 animate-inv-parpadeo text-slate-400">▮</span>
        </div>
      )}
      {modo === 'opciones' && error && (
        <div key={jugador.feedback.t} className="animate-inv-temblor text-center font-arcade text-[10px] text-rose-400">✗ ¡PRUEBA OTRA!</div>
      )}
      {mandos && (
        <div className="text-center font-arcade text-[8px] leading-relaxed text-yellow-300/90 sm:text-[9px]">
          🎮 {mandos === 'numero' ? 'MARCA EL NÚMERO CON A (−) Y B (+) · AGITA PARA DISPARAR' : 'A CAMBIA LA LETRA · B O AGITAR PARA DISPARAR'}
        </div>
      )}
      <Keypad modo={modo} opciones={pregunta?.opciones} entrada={jugador.entrada} pregunta={pregunta}
        onTecla={onTecla} onFuego={onFuego} deshabilitado={bloqueado || jugador.eliminado} />
    </div>
  );
});
