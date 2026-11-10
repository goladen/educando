// Enunciado de la pregunta, común a las dos variantes. Los ejercicios de Math World traen su propio
// componente Enunciado (texto oscuro, fórmulas KaTeX): se pintan en una «pantalla LCD» clara.
import React, { memo } from 'react';

const tamano = (txt) => {
  const n = String(txt || '').length;
  if (n <= 14) return 'text-[length:clamp(26px,9cqw,56px)]';
  if (n <= 30) return 'text-[length:clamp(22px,6.5cqw,42px)]';
  if (n <= 60) return 'text-[length:clamp(19px,5cqw,32px)]';
  return 'text-[length:clamp(17px,4cqw,26px)]';
};

export default memo(function PreguntaDisplay({ pregunta, compacta = false }) {
  if (!pregunta) return <div className="py-2 text-center font-arcade text-[10px] text-slate-500">…</div>;
  const { Enunciado } = pregunta;
  return (
    <div className="@container relative w-full">
      {pregunta.fichaNum && (
        <span className="absolute -top-1 left-0 z-10 rounded border border-fuchsia-400 bg-slate-950/90 px-1.5 py-0.5 font-arcade text-[8px] text-fuchsia-300 sm:text-[9px]"
          title="Número de la pregunta en la ficha PDF">#{String(pregunta.fichaNum).padStart(2, '0')}</span>
      )}
      {(pregunta.tema || pregunta.instruccion) && !compacta && (
        <div className="mb-1 truncate text-center font-arcade text-[8px] uppercase tracking-wider text-slate-400 sm:text-[9px]">
          {pregunta.emoji} {pregunta.instruccion || pregunta.tema}
        </div>
      )}
      {Enunciado ? (
        <div className="mx-auto flex max-h-[30vh] w-full items-center justify-center overflow-auto rounded-md border-2 border-cyan-300 bg-cyan-50 px-2 py-1.5 text-center shadow-[inset_0_0_12px_rgba(8,145,178,0.25)]">
          <Enunciado ap={pregunta.ap} size={compacta ? '1.5rem' : '2rem'} />
          {pregunta.etiqueta && <span className="ml-2 font-pixel text-xl text-slate-700">{pregunta.etiqueta}</span>}
        </div>
      ) : (
        <div className={`text-center font-pixel leading-[1.05] text-cyan-200 drop-shadow-[0_0_6px_rgba(34,211,238,0.8)] break-words ${tamano(pregunta.enunciado)}`}>
          {pregunta.enunciado}
        </div>
      )}
    </div>
  );
});
