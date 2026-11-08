// Pantalla final: clasificación, aciertos de cada jugador, envío al profe y revancha.
import React, { useState } from 'react';
import { BTN, PANEL, TITULO_NEON, NEON } from '../tema';
import { NaveSVG } from '../ui/Sprites';
import ModalEnviarProfe from './ModalEnviarProfe';
import GuardarResultadosMandos from '../../mandos/GuardarResultadosMandos.jsx';

const MEDALLA = ['🥇', '🥈', '🥉', '4º'];

const estrellas = (pct, aciertos) => (aciertos === 0 ? 0 : pct >= 90 ? 3 : pct >= 70 ? 2 : pct >= 40 ? 1 : 0);
const MENSAJES = [
  'Los aliens han ganado esta vez… ¡repasa los fallos y a por la revancha!',
  '¡Buen intento, cadete! Un poco más de práctica y serán tuyos.',
  '¡Gran defensa! La Tierra respira tranquila gracias a ti.',
  '¡LEGENDARIO! Ni un alien ha podido contigo.',
];

export default function FinPartida({ resumenes, config, titulo, porTiempo, record, mandosFilas, onRevancha, onMenu, onSalir }) {
  const [enviar, setEnviar] = useState(null);
  const orden = [...resumenes].sort((a, b) => b.puntos - a.puntos);
  const varios = resumenes.length > 1;
  const coop = varios && config.modo === 'cooperativo';
  const total = resumenes.reduce((s, r) => s + r.puntos, 0);
  const aciertos = resumenes.reduce((s, r) => s + r.aciertos, 0);
  const intentos = resumenes.reduce((s, r) => s + r.intentos, 0);
  const pct = intentos ? Math.round((aciertos / intentos) * 100) : 0;
  const nEstrellas = estrellas(pct, aciertos);

  return (
    <div className="inv-estrellas flex min-h-0 w-full flex-1 overflow-y-auto p-4">
      <div className={`${PANEL} m-auto flex w-full max-w-3xl flex-col gap-4 animate-inv-entrada`}>
        <div className="text-center">
          <h2 className={`${TITULO_NEON} text-lg sm:text-2xl`}>{porTiempo ? '¡TIEMPO!' : 'GAME OVER'}</h2>
          <p className="mt-2 font-pixel text-xl text-slate-400">{titulo}</p>
          <div className="mt-3 flex justify-center gap-2 text-4xl sm:text-5xl">
            {[0, 1, 2].map((k) => (
              <span key={k} className={`animate-inv-entrada ${k < nEstrellas ? 'drop-shadow-[0_0_12px_rgba(250,204,21,0.9)]' : 'opacity-20 grayscale'}`}
                style={{ animationDelay: `${300 + k * 250}ms` }}>⭐</span>
            ))}
          </div>
          <p className="mt-2 font-pixel text-2xl text-slate-200">{MENSAJES[nEstrellas]}</p>
          {record?.nuevo && (
            <p className="mt-2 animate-inv-latido font-arcade text-xs text-amber-300 drop-shadow-[0_0_10px_rgba(251,191,36,0.9)]">🏆 ¡NUEVO RÉCORD! {record.valor} PTS</p>
          )}
          {record && !record.nuevo && record.valor > 0 && (
            <p className="mt-2 font-arcade text-[10px] text-slate-500">RÉCORD EN ESTE DISPOSITIVO: {record.valor} PTS</p>
          )}
          {coop && <p className="mt-1 font-arcade text-xs text-amber-300">EQUIPO · {total} PTS</p>}
        </div>

        <div className="flex flex-col gap-2">
          {orden.map((r, k) => {
            const c = NEON[r.color];
            return (
              <div key={r.id} className={`flex flex-wrap items-center gap-3 rounded-lg border-2 ${c.borde} bg-slate-950/70 px-3 py-2 ${k === 0 && varios && !coop ? c.glow : ''}`}>
                {varios && !coop && <span className="w-8 text-center font-arcade text-sm">{MEDALLA[k]}</span>}
                <NaveSVG color={c.hex} className="h-5 w-8" />
                <span className={`min-w-[80px] flex-1 font-arcade text-[11px] ${c.text}`}>{r.nombre}</span>
                <span className="font-arcade text-xs tabular-nums text-slate-50">{r.puntos} PTS</span>
                <span className="font-pixel text-xl text-green-300">✓ {r.aciertos}</span>
                <span className="font-pixel text-xl text-rose-300">✗ {r.fallos}</span>
                <span className="font-pixel text-xl text-slate-400">{r.porcentaje}% · N{r.nivel} · 🔥{r.mejorRacha}</span>
                <button type="button" onClick={() => setEnviar(r)} className={`${BTN.menu} px-3 py-2 text-[9px]`}>📤 ENVIAR</button>
              </div>
            );
          })}
        </div>

        {orden.some((r) => r.falladas.length) && (
          <details className="rounded-lg border-2 border-slate-800 bg-slate-950/50 px-3 py-2">
            <summary className="cursor-pointer font-arcade text-[9px] text-slate-300">📋 REPASAR LOS FALLOS</summary>
            <div className="mt-2 flex max-h-60 flex-col gap-2 overflow-y-auto">
              {orden.map((r) => r.falladas.map((f, i) => (
                <div key={`${r.id}-${i}`} className="font-pixel text-lg leading-tight">
                  <span className={NEON[r.color].text}>{r.nombre}:</span> <span className="text-slate-200">{f.enunciado}</span>
                  <span className="text-slate-500"> → </span><span className="text-green-300">{f.correcta}</span>
                  {f.dada && <span className="text-rose-300"> ({f.dada})</span>}
                </div>
              )))}
            </div>
          </details>
        )}

        {mandosFilas?.length > 0 && (
          <div className="flex flex-col gap-2 rounded-lg border-2 border-yellow-400/50 bg-yellow-400/5 p-3">
            <div className="font-arcade text-[10px] text-yellow-200">🎮 RESULTADOS POR MANDO</div>
            <div className="flex flex-col gap-1">
              {[...mandosFilas].sort((a, b) => b.puntos - a.puntos).map((m, k) => (
                <div key={m.id} className="flex flex-wrap items-center gap-3 font-pixel text-xl">
                  <span className="w-8 font-arcade text-[10px] text-slate-500">{k + 1}º</span>
                  <span className="min-w-[110px] flex-1 text-slate-100">🎮 {m.nombre}</span>
                  <span className="text-cyan-200">{m.puntos} pts</span>
                  <span className="text-green-300">✓ {m.aciertos}</span>
                  <span className="text-rose-300">✗ {m.fallos}</span>
                </div>
              ))}
            </div>
            <div className="flex justify-center">
              <GuardarResultadosMandos tipo="INVASORES_MANDOS" juego="Invasión Pi con mandos" recursoTitulo={titulo}
                config={{ variante: config.variante, jugadores: resumenes.length, modo: config.modo }}
                jugadores={mandosFilas} estilo={{ fontFamily: '"Press Start 2P", monospace', fontSize: 10, padding: '12px 16px' }} />
            </div>
          </div>
        )}

        <div className="flex flex-wrap justify-center gap-3">
          <button type="button" onClick={onRevancha} className={`${BTN.primario} text-xs`}>↻ REVANCHA</button>
          <button type="button" onClick={onMenu} className={`${BTN.menu} text-[10px]`}>⚙️ MENÚ</button>
          <button type="button" onClick={onSalir} className={`${BTN.peligro} text-[10px]`}>✕ SALIR</button>
        </div>
      </div>

      {enviar && (
        <ModalEnviarProfe
          datos={{ ...enviar, titulo, modalidad: varios ? `${resumenes.length} jugadores · ${coop ? 'cooperativo' : 'competitivo'}` : 'Individual', posicion: varios && !coop ? orden.indexOf(enviar) + 1 : null }}
          onClose={() => setEnviar(null)} />
      )}
    </div>
  );
}
