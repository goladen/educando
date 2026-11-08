// Briefing de la misión: 3 pasos con dibujos antes de la cuenta atrás (se puede desactivar).
import React, { useEffect, useState } from 'react';
import { AlienSVG, NaveSVG, Corazon } from '../ui/Sprites';
import { BTN, PANEL, TITULO_NEON } from '../tema';

const LS = 'pikt_invasores_briefing_visto';
export const briefingVisto = (variante) => { try { return !!JSON.parse(localStorage.getItem(LS) || '{}')[variante]; } catch { return false; } };
const marcarVisto = (variante, v) => {
  try {
    const o = JSON.parse(localStorage.getItem(LS) || '{}');
    o[variante] = v;
    localStorage.setItem(LS, JSON.stringify(o));
  } catch { /* sin localStorage */ }
};

function Paso({ n, titulo, texto, children, retraso }) {
  return (
    <div className="flex flex-1 flex-col items-center gap-3 rounded-xl border-2 border-slate-700 bg-slate-950/70 p-4 text-center animate-inv-entrada"
      style={{ animationDelay: `${retraso}ms` }}>
      <div className="font-arcade text-[9px] text-slate-500">PASO {n}</div>
      <div className="flex h-20 items-end justify-center gap-2">{children}</div>
      <div className="font-arcade text-[10px] leading-relaxed text-cyan-200 sm:text-xs">{titulo}</div>
      <p className="font-pixel text-xl leading-tight text-slate-300">{texto}</p>
    </div>
  );
}

const Tecla = ({ t, verde }) => (
  <span className={`inline-flex h-8 min-w-8 items-center justify-center rounded border-b-4 px-1.5 font-arcade text-[10px] ${verde ? 'border-green-800 bg-green-500 text-slate-950' : 'border-slate-950 bg-slate-700 text-slate-100'}`}>{t}</span>
);

export default function Briefing({ variante, mandos, numJugadores, onListo }) {
  const [texto, setTexto] = useState('');
  const [noMostrar, setNoMostrar] = useState(false);
  const cabecera = '▶ TRANSMISIÓN ENTRANTE… ¡LA TIERRA NECESITA TU CEREBRO!';
  useEffect(() => {
    let i = 0;
    const id = setInterval(() => { i += 1; setTexto(cabecera.slice(0, i)); if (i >= cabecera.length) clearInterval(id); }, 28);
    return () => clearInterval(id);
  }, []);
  const listo = () => { if (noMostrar) marcarVisto(variante, true); onListo(); };
  useEffect(() => {
    const on = (e) => { if (e.code === 'Enter' || e.code === 'Space' || e.code === 'NumpadEnter') { e.preventDefault(); listo(); } };
    window.addEventListener('keydown', on);
    return () => window.removeEventListener('keydown', on);
  });

  const dispara = variante === 'DISPARA';
  return (
    <div className="absolute inset-0 z-30 flex overflow-y-auto bg-slate-950/90 p-3 sm:p-6">
      <div className={`${PANEL} m-auto flex w-full max-w-4xl flex-col gap-4`}>
        <div className="min-h-[2.5em] font-arcade text-[9px] leading-relaxed text-green-400 sm:text-[11px]">{texto}<span className="animate-inv-parpadeo">▮</span></div>
        <h2 className={`${TITULO_NEON} text-center text-sm sm:text-xl`}>{dispara ? '⌨️ DISPARA AL RESPONDER' : '🛸 FILTRO DE RESPUESTAS'}</h2>

        {dispara ? (
          <div className="flex flex-col gap-3 md:flex-row">
            <Paso n={1} retraso={0} titulo="BAJA UN ALIEN" texto="Cada alien trae una pregunta. ¡Va bajando poco a poco!">
              <div className="flex flex-col items-center gap-1">
                <AlienSVG sprite={0} color="#f472b6" className="h-10 w-14 animate-inv-latido" />
                <span className="font-pixel text-2xl text-cyan-200">6 × 7 = ?</span>
              </div>
            </Paso>
            <Paso n={2} retraso={150} titulo={mandos ? 'RESPONDE CON EL MANDO' : 'ESCRIBE LA RESPUESTA'}
              texto={mandos === 'numero' ? 'Marca el número con A (−) y B (+).' : mandos ? 'A cambia la letra (A-D).' : 'Con el teclado de abajo… o elige A-D si hay opciones.'}>
              <div className="grid grid-cols-3 gap-1">
                {['4', '2', 'DEL'].map((t) => <Tecla key={t} t={t} />)}
              </div>
            </Paso>
            <Paso n={3} retraso={300} titulo="¡FUEGO!" texto={mandos ? 'Agita el mando (o B) para disparar. Si fallas, ¡prueba otra vez!' : 'Pulsa ▲ FUEGO. Si fallas, ¡prueba otra vez!'}>
              <div className="flex flex-col items-center">
                <span className="h-10 w-1.5 rounded-full bg-cyan-300 shadow-[0_0_12px_#22d3ee]" />
                <NaveSVG color="#22d3ee" className="h-7 w-11" />
              </div>
            </Paso>
          </div>
        ) : (
          <div className="flex flex-col gap-3 md:flex-row">
            <Paso n={1} retraso={0} titulo="LEE LA PREGUNTA" texto="Arriba sale la pregunta y bajan naves con respuestas.">
              {['15', '20', '24'].map((t, k) => (
                <div key={t} className="flex flex-col items-center">
                  <AlienSVG sprite={k} color={['#f472b6', '#4ade80', '#60a5fa'][k]} className="h-8 w-10" />
                  <span className="rounded border border-slate-500 px-1 font-pixel text-xl leading-none text-slate-100">{t}</span>
                </div>
              ))}
            </Paso>
            <Paso n={2} retraso={150} titulo="DESTRUYE LAS FALSAS" texto={mandos ? 'Inclina el mando para moverte y agítalo (o A) para disparar.' : 'Muévete con ◀ ▶ (o arrastrando el dedo) y dispara.'}>
              <div className="flex flex-col items-center gap-1">
                <span className="font-arcade text-xl text-orange-300">💥</span>
                <span className="h-6 w-1 rounded bg-fuchsia-300 shadow-[0_0_10px_#e879f9]" />
                <NaveSVG color="#e879f9" className="h-7 w-11" />
              </div>
            </Paso>
            <Paso n={3} retraso={300} titulo="SALVA LA CORRECTA" texto="Si la buena llega abajo, superas la ronda. Si la destruyes… pierdes una vida.">
              <div className="flex flex-col items-center gap-1">
                <span className="font-arcade text-xs text-green-300">✔ 20</span>
                <span className="flex gap-1"><Corazon /><Corazon /><Corazon lleno={false} /></span>
              </div>
            </Paso>
          </div>
        )}

        <div className="grid gap-2 font-pixel text-lg leading-tight text-slate-300 sm:grid-cols-3">
          <div className="rounded-lg bg-slate-800/60 px-3 py-2">⭐ Cuanto antes aciertas, <b className="text-amber-300">más puntos</b>. Las rachas suman extra.</div>
          <div className="rounded-lg bg-slate-800/60 px-3 py-2">🚀 Cada <b className="text-amber-300">5 aciertos</b> subes de nivel y los aliens bajan más rápido.</div>
          <div className="rounded-lg bg-slate-800/60 px-3 py-2">
            {mandos ? '🎮 Si el mando no responde, acércalo a la antena. El profe puede pasar el mando con ⏭.'
              : numJugadores > 1 ? '👥 Cada uno juega en su zona: ¡podéis pulsar todos a la vez!' : '⌨️ En el ordenador también puedes usar el teclado.'}
          </div>
        </div>

        <div className="flex flex-col items-center gap-3">
          <button type="button" onClick={listo} className={`${BTN.primario} animate-inv-latido text-sm`}>¡ENTENDIDO, A JUGAR!</button>
          <label className="flex cursor-pointer items-center gap-2 font-pixel text-lg text-slate-500">
            <input type="checkbox" checked={noMostrar} onChange={(e) => setNoMostrar(e.target.checked)} /> No volver a enseñar estas instrucciones
          </label>
        </div>
      </div>
    </div>
  );
}
