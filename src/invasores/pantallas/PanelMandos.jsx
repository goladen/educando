// Panel de mandos micro:bit del menú (mismo sistema que el Ovni: los mandos se detectan solos,
// el primero que se mueve coge una zona libre y se pueden asignar o pasar con un toque).
// No hay que reprogramar nada: se usan los modos que ya tienen (letras, número, volante/fútbol).
import React, { useEffect, useState } from 'react';
import ChipAntena from '../../mandos/ChipAntena.jsx';
import { BotonTutorialMandos } from '../../mandos/TutorialMandos.jsx';
import { ElegirPiloto } from '../../ovniMandos.jsx';
import { NEON, COLORES_JUGADOR, chip } from '../tema';

export default function PanelMandos({ ctrl, config, setConfig, numJugadores, permiteNumero }) {
  const [, setTick] = useState(0); // apaga el punto verde de los mandos que dejan de moverse
  useEffect(() => { const t = setInterval(() => setTick((x) => x + 1), 2000); return () => clearInterval(t); }, []);
  const ids = Object.keys(ctrl.vistos).map(Number).sort((a, b) => a - b);
  const ahora = Date.now();
  const dispara = config.variante === 'DISPARA';
  const tutorial = dispara ? (config.mandosRespuesta === 'numero' ? 'numero' : 'letras') : 'futbol';

  return (
    <div className="flex flex-col gap-3 rounded-lg border-2 border-yellow-400/50 bg-yellow-400/5 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <ChipAntena />
        <BotonTutorialMandos inicial={tutorial} texto="📖 Cómo se usa el mando"
          style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.2)', padding: '7px 12px' }} />
      </div>

      <p className="font-pixel text-xl leading-tight text-slate-200">
        {dispara
          ? (config.mandosRespuesta === 'numero'
            ? <>Cada alumno <b className="text-yellow-300">marca el resultado</b> con A (−) y B (+) y <b className="text-yellow-300">agita</b> el mando para disparar.</>
            : <>Cada alumno elige la letra con <b className="text-yellow-300">A</b> y dispara con <b className="text-yellow-300">B o agitando</b>. En pantalla salen las opciones A-D.</>)
          : <><b className="text-yellow-300">Inclina</b> el mando a izquierda o derecha para mover la nave y <b className="text-yellow-300">agítalo o pulsa A</b> para disparar.</>}
        {' '}No hace falta reprogramar los mandos: cambian de modo solos.
      </p>

      {dispara && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-arcade text-[9px] text-slate-400">RESPONDER CON EL MANDO</span>
          <button type="button" onClick={() => setConfig({ mandosRespuesta: 'letras' })} className={chip(config.mandosRespuesta !== 'numero')}>🔤 LETRAS A-D</button>
          <button type="button" disabled={!permiteNumero} onClick={() => setConfig({ mandosRespuesta: 'numero' })}
            title={permiteNumero ? '' : 'Solo con cálculo rápido o Math World'}
            className={`${chip(config.mandosRespuesta === 'numero')} disabled:opacity-30`}>🔢 MARCAR EL NÚMERO</button>
        </div>
      )}

      <div>
        <div className="mb-1.5 font-arcade text-[9px] text-yellow-200">MANDOS DETECTADOS</div>
        {!ids.length ? (
          <p className="font-pixel text-lg text-slate-400">Mueve o agita cada mando para que aparezca aquí.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {ids.map((id) => {
              const vivo = ahora - ctrl.vistos[id] < 4000;
              const zona = ctrl.pilotos.slice(0, numJugadores).indexOf(id);
              const c = zona >= 0 ? NEON[COLORES_JUGADOR[zona]] : null;
              return (
                <div key={id} className={`flex items-center gap-1.5 rounded-md border-2 bg-slate-950/80 px-2 py-1 ${c ? c.borde : 'border-slate-700'}`}>
                  <span className={`h-2.5 w-2.5 rounded-full ${vivo ? 'bg-green-400 shadow-[0_0_8px_#4ade80]' : 'bg-slate-600'}`} />
                  <b className="font-arcade text-[10px] text-white">🎮{id}</b>
                  <input value={ctrl.nombres[id] || ''} onChange={(e) => ctrl.setNombre(id, e.target.value)} placeholder="Nombre" maxLength={20}
                    className="w-24 rounded border border-slate-600 bg-slate-900 px-1.5 py-0.5 font-pixel text-lg text-slate-100 outline-none focus:border-yellow-300" />
                  {zona >= 0 && <span className={`font-arcade text-[9px] ${c.text}`}>J{zona + 1}</span>}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-3">
        {Array.from({ length: numJugadores }, (_, i) => {
          const c = NEON[COLORES_JUGADOR[i]];
          return (
            <label key={i} className={`flex items-center gap-2 font-arcade text-[9px] ${c.text}`}>
              J{i + 1}:
              <ElegirPiloto ctrl={ctrl} i={i} color={c.hex} />
            </label>
          );
        })}
      </div>

      <label className="flex cursor-pointer items-center gap-2 font-pixel text-lg text-slate-300">
        <input type="checkbox" checked={config.turnos} onChange={(e) => setConfig({ turnos: e.target.checked })} />
        🔄 Turnos: tras cada pregunta, el mando de cada zona pasa al siguiente alumno (ideal para toda la clase)
      </label>
    </div>
  );
}
