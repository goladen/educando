// Zona de un jugador, COMÚN a las dos variantes: HUD + (cabecera) + PlayField + panel de la variante.
// Se coloca en vertical (panel debajo) o en horizontal (panel a la derecha) según su propia forma,
// así sirve igual para un móvil, una tablet partida en 2 o una pizarra con 4 columnas.
import React, { useEffect, useRef, useState } from 'react';
import HudJugador from './HudJugador';
import PlayField from './PlayField';
import { NEON } from '../tema';

function useForma(ref) {
  const [horizontal, setHorizontal] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(([e]) => {
      const { width, height } = e.contentRect;
      setHorizontal(width > height * 1.3);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return horizontal;
}

/** Pista que se ve mientras baja el primer alien (se apaga sola). */
function pistaInicial(variante, mandos, unico) {
  if (variante.id === 'DISPARA') {
    if (mandos === 'numero') return 'MARCA EL RESULTADO EN TU MANDO Y AGÍTALO';
    if (mandos) return 'ELIGE LA LETRA CON A · DISPARA CON B';
    return unico ? 'ESCRIBE LA RESPUESTA ↓ Y PULSA ▲ FUEGO' : 'RESPONDE ↓ Y PULSA FUEGO';
  }
  if (mandos) return 'INCLINA PARA MOVERTE · AGITA O A = DISPARO';
  return 'DISPARA A LAS FALSAS · DEJA PASAR LA BUENA';
}

export default function PlayerZone({
  jugador, mundo, variante, pregunta, cooperativo, escribir, mandos, piloto,
  onTecla, onFuego, onInput, unico,
}) {
  const ref = useRef(null);
  const horizontal = useForma(ref);
  const c = NEON[jugador.color];
  const { Panel, Cabecera } = variante;
  const bloqueado = variante.bloqueado(mundo);
  const arrastre = variante.seMueve ? (x) => onInput(jugador.id, { objetivoX: x }) : null;
  const vida = jugador.feedback?.tipo === 'vida';
  const ahora = Date.now();
  const aviso = jugador.aviso && ahora - jugador.aviso.t < 1700 ? jugador.aviso : null;
  const pista = jugador.rondas === 0 && mundo && mundo.t < 8 && !jugador.eliminado ? pistaInicial(variante, mandos, unico) : null;

  const panel = (
    <Panel jugador={jugador} pregunta={pregunta} onTecla={onTecla} onFuego={onFuego} onInput={onInput}
      bloqueado={bloqueado} escribir={escribir} horizontal={horizontal} mandos={mandos} />
  );

  return (
    <section ref={ref}
      className={`relative flex min-h-0 min-w-0 flex-col overflow-hidden bg-slate-900 ${unico ? '' : `rounded-xl border-2 ${c.borde} ${c.glow}`}`}>
      <HudJugador jugador={jugador} cooperativo={cooperativo} />
      {piloto && <div className="flex justify-center border-b border-slate-800 bg-slate-950/70 px-1 py-1">{piloto}</div>}
      <div className={`flex min-h-0 flex-1 ${horizontal ? 'flex-row' : 'flex-col'}`}>
        <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
          {Cabecera && <Cabecera pregunta={pregunta} />}
          <PlayField mundo={mundo} color={jugador.color} onArrastre={arrastre} />
          {pista && (
            <div className="pointer-events-none absolute inset-x-2 bottom-[18%] text-center">
              <span className="animate-inv-latido inline-block rounded-md border-2 border-yellow-300/80 bg-slate-950/85 px-2 py-1.5 font-arcade text-[length:clamp(7px,1.6vh,12px)] leading-relaxed text-yellow-200 shadow-[0_0_14px_rgba(253,224,71,0.45)]">
                {pista}
              </span>
            </div>
          )}
          {aviso && (
            <div key={aviso.t} className="pointer-events-none absolute inset-x-0 top-[38%] text-center animate-inv-entrada">
              <span className={`inline-block -rotate-3 font-arcade text-[length:clamp(12px,3.4vh,26px)] ${aviso.nivel ? 'text-amber-300 drop-shadow-[0_0_12px_rgba(251,191,36,0.95)]' : 'text-orange-400 drop-shadow-[0_0_12px_rgba(251,146,60,0.95)]'}`}>
                {aviso.texto}
              </span>
            </div>
          )}
        </div>
        {horizontal ? <div className="w-[clamp(280px,34%,460px)] shrink-0">{panel}</div> : panel}
      </div>

      <div className="inv-scanlines pointer-events-none absolute inset-0" />
      {vida && <div key={jugador.feedback.t} className="pointer-events-none absolute inset-0 animate-inv-temblor" />}

      {jugador.eliminado && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-slate-950/85">
          <div className="animate-inv-latido font-arcade text-[length:clamp(16px,4vw,32px)] text-rose-400 drop-shadow-[0_0_10px_rgba(244,63,94,0.9)]">GAME OVER</div>
          <div className={`font-arcade text-xs ${c.text}`}>{jugador.nombre} · {jugador.puntos} PTS</div>
        </div>
      )}
    </section>
  );
}
