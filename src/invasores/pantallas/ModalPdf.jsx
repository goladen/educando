// Opciones de la ficha PDF con estética arcade: nº de aliens, fondo papel/pantalla y claves.
import React, { useState } from 'react';
import { BTN, chip, PANEL } from '../tema';
import { AlienSVG } from '../ui/Sprites';

const CANTIDADES = [10, 16, 24, 30];

export default function ModalPdf({ maxPreguntas = null, vinculada = false, onGenerar, onCerrar }) {
  const [n, setN] = useState(16);
  const [oscuro, setOscuro] = useState(false);
  const [soluciones, setSoluciones] = useState(true);
  const [estado, setEstado] = useState('');          // '' | 'generando' | mensaje de error

  const generar = async () => {
    setEstado('generando');
    try {
      await onGenerar({ n, oscuro, soluciones });
      onCerrar();
    } catch (e) {
      setEstado(e?.message || 'No se pudo crear el PDF.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 p-4" onClick={onCerrar}>
      <div className={`${PANEL} flex w-full max-w-lg flex-col gap-4 animate-inv-entrada`} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3">
          <AlienSVG sprite={1} color="#e879f9" className="h-8 w-8" />
          <h3 className="font-arcade text-xs text-fuchsia-300 sm:text-sm">🖨️ FICHA PDF DE LA MISIÓN</h3>
        </div>
        <p className="font-pixel text-xl leading-tight text-slate-300">
          Las preguntas de esta partida en papel, con aliens numerados, casillas para responder y marcador de estrellas.
        </p>
        <p className="rounded-md border-2 border-fuchsia-400/60 bg-fuchsia-500/10 px-3 py-2 font-pixel text-xl leading-tight text-fuchsia-100">
          {vinculada
            ? `🔗 La partida ya está vinculada a una ficha: se vuelve a imprimir la misma (${maxPreguntas} preguntas, mismo QR).`
            : '🔗 La ficha queda VINCULADA al juego: al jugar (aquí o escaneando su QR en cualquier ordenador) salen las mismas preguntas en el mismo orden.'}
        </p>

        {!vinculada && <div className="flex flex-col gap-2">
          <span className="font-arcade text-[9px] text-slate-400">ALIENS (PREGUNTAS)</span>
          <div className="flex flex-wrap gap-2">
            {CANTIDADES.map((k) => (
              <button key={k} type="button" onClick={() => setN(k)} disabled={maxPreguntas != null && k > maxPreguntas && k !== CANTIDADES[0]}
                className={`${chip(n === k)} min-w-[52px] disabled:cursor-not-allowed disabled:opacity-30`}>{k}</button>
            ))}
          </div>
          {maxPreguntas != null && maxPreguntas < n && (
            <span className="font-pixel text-lg text-amber-300">Este contenido tiene {maxPreguntas} preguntas: saldrán todas.</span>
          )}
        </div>}

        <div className="flex flex-col gap-2">
          <span className="font-arcade text-[9px] text-slate-400">FONDO</span>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setOscuro(false)} className={chip(!oscuro)}>📄 PAPEL (AHORRA TINTA)</button>
            <button type="button" onClick={() => setOscuro(true)} className={chip(oscuro)}>🌌 PANTALLA (NEGRO)</button>
          </div>
        </div>

        <label className="flex cursor-pointer items-center gap-3 font-pixel text-xl text-slate-200">
          <input type="checkbox" checked={soluciones} onChange={(e) => setSoluciones(e.target.checked)} className="h-5 w-5 accent-fuchsia-400" />
          Añadir página de claves (soluciones para el profe)
        </label>

        {estado && estado !== 'generando' && <p className="font-pixel text-xl text-rose-400">⚠ {estado}</p>}

        <div className="flex flex-wrap justify-end gap-3">
          <button type="button" onClick={onCerrar} className={`${BTN.menu} text-[10px]`}>CANCELAR</button>
          <button type="button" onClick={generar} disabled={estado === 'generando'} className={`${BTN.primario} text-xs disabled:opacity-60`}>
            {estado === 'generando' ? 'GENERANDO…' : '⬇ DESCARGAR PDF'}
          </button>
        </div>
      </div>
    </div>
  );
}
