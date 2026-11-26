// ⭐ Piezas comunes para valorar recursos en los buscadores de los juegos:
//   <ValoracionRecurso r={recurso} oscuro />  → ▶ partidas + botón ❤️ «me gusta» (uno por navegador)
//   <OrdenRecursos valor={orden} onChange={setOrden} oscuro />  → 🔥 Más jugados · ❤️ Más gustan · 🆕 Recientes
//   ordenarRecursos(lista, orden, (x) => x.r)  → ordena (el 3.er parámetro saca el recurso si va envuelto)
// La lógica (contar partidas, likes) está en utils/valoracionRecursos.js.
import React, { useState } from 'react';
import { alternarMeGusta, meGusta } from '../utils/valoracionRecursos';

const esReal = (r) => !!r?.id && !r.esPikt && !String(r.id).startsWith('fake') && !String(r.id).startsWith('pikt')
  // opciones internas de algunos juegos (Racing 3D: educación vial; Aviones: solo pilotar; Mansión: sin recurso)
  && !r.esVial && !r.soloAros && !r.libre;
const ms = (f) => (f?.toMillis ? f.toMillis() : f?.seconds ? f.seconds * 1000 : f ? new Date(f).getTime() || 0 : 0);

export const ORDENES_JUEGO = [
  ['jugados', '🔥 Más jugados'],
  ['gustan', '❤️ Más gustan'],
  ['recientes', '🆕 Recientes'],
];

/** Ordena una lista de recursos (o de objetos que los envuelven: pasa `sacar`). Desempata por partidas. */
export function ordenarRecursos(lista, orden = 'jugados', sacar = (x) => x) {
  const n = (v) => Number(v) || 0;
  const cmp = {
    jugados: (a, b) => n(b.playCount) - n(a.playCount) || n(b.likes) - n(a.likes),
    gustan: (a, b) => n(b.likes) - n(a.likes) || n(b.playCount) - n(a.playCount),
    recientes: (a, b) => ms(b.fechaCreacion) - ms(a.fechaCreacion) || n(b.playCount) - n(a.playCount),
  }[orden] || (() => 0);
  return [...lista].sort((x, y) => cmp(sacar(x) || {}, sacar(y) || {}));
}

/** ▶ partidas y ❤️ me gusta. `oscuro` para fondos oscuros; `tam` = tamaño de letra en px. */
export function ValoracionRecurso({ r, oscuro = false, tam = 12, style }) {
  const valorable = esReal(r);
  const [gusta, setGusta] = useState(() => valorable && meGusta(r.id));
  const [likes, setLikes] = useState(Number(r?.likes) || 0);
  const [enviando, setEnviando] = useState(false);
  if (!valorable) return null;
  const pulsar = async (e) => {
    e.stopPropagation();
    e.preventDefault();
    if (enviando) return;
    setEnviando(true);
    const antes = gusta;
    setGusta(!antes);
    setLikes((n) => Math.max(0, n + (antes ? -1 : 1)));
    try { await alternarMeGusta(r); }
    catch { setGusta(antes); setLikes((n) => Math.max(0, n + (antes ? 1 : -1))); }
    setEnviando(false);
  };
  const gris = oscuro ? '#cbd5e1' : '#555';
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: tam, fontWeight: 800, color: gris, ...style }} onClick={(e) => e.stopPropagation()}>
      <span title="Veces que se ha jugado">▶ {Number(r.playCount) || 0}</span>
      {/* span con role=button: estas piezas van dentro de tarjetas que ya son <button> */}
      <span role="button" tabIndex={0} onClick={pulsar} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') pulsar(e); }} aria-pressed={gusta} title={gusta ? 'Quitar «me gusta»' : 'Me gusta'}
        style={{
          border: `1px solid ${gusta ? '#e11d48' : oscuro ? 'rgba(255,255,255,0.25)' : '#ddd'}`,
          background: gusta ? (oscuro ? 'rgba(225,29,72,0.25)' : '#ffe4e6') : oscuro ? 'rgba(255,255,255,0.06)' : 'white',
          color: gusta ? (oscuro ? '#fda4af' : '#e11d48') : gris,
          borderRadius: 999, padding: '1px 8px', fontSize: tam, fontWeight: 800, cursor: enviando ? 'wait' : 'pointer', fontFamily: 'inherit', lineHeight: 1.6, userSelect: 'none',
        }}>
        {gusta ? '❤️' : '🤍'} {likes}
      </span>
    </span>
  );
}

/** Botones para elegir el orden de la lista. */
export function OrdenRecursos({ valor, onChange, oscuro = false, color = '#6c63ff', style }) {
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', ...style }}>
      {ORDENES_JUEGO.map(([k, t]) => {
        const on = valor === k;
        return (
          <button key={k} type="button" onClick={() => onChange(k)}
            style={{
              padding: '5px 12px', borderRadius: 999, fontSize: 13, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit',
              border: `2px solid ${on ? color : oscuro ? 'rgba(255,255,255,0.2)' : '#ddd'}`,
              background: on ? color : 'transparent', color: on ? 'white' : oscuro ? '#e2e8f0' : '#475569',
            }}>
            {t}
          </button>
        );
      })}
    </div>
  );
}
