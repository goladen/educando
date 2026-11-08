// Zona de juego COMÚN a las dos variantes: cielo, formación, aliens, nave, láser/balas y efectos.
// Se repinta en cada frame a partir del mundo (coordenadas 0..1 → porcentajes).
import React, { useRef } from 'react';
import { AlienSVG, NaveSVG } from './Sprites';
import { SUELO, NAVE_Y } from '../motor/comun';
import { NEON } from '../tema';

const pct = (v) => `${v * 100}%`;

function Formacion({ formacion, t, color }) {
  const frame = Math.floor(t * 2) % 2;
  return (
    <div className="pointer-events-none absolute left-0 right-0 top-[2%] h-[11%] opacity-45"
      style={{ transform: `translateX(${formacion.offset * 100}%)` }}>
      {[0, 1].map((fila) => (
        <div key={fila} className="flex h-1/2 justify-center gap-[3%] px-[18%]">
          {Array.from({ length: 6 }, (_, k) => (
            <AlienSVG key={k} sprite={(fila + k) % 3} frame={(frame + k) % 2} color={fila ? '#64748b' : color} className="h-full w-[9%]" />
          ))}
        </div>
      ))}
    </div>
  );
}

function Alien({ a, t, resaltado, conEtiqueta }) {
  const frame = Math.floor(t * 2.5 + a.fase) % 2;
  const caja = { left: pct(a.x - a.w / 2), top: pct(a.y), width: pct(a.w), height: pct(a.h) };
  if (!conEtiqueta) {
    return (
      <div className="absolute" style={caja}>
        <AlienSVG sprite={a.sprite} frame={frame} color={a.color}
          className={`h-full w-full ${resaltado ? 'drop-shadow-[0_0_10px_rgba(250,250,250,0.55)]' : ''}`} />
      </div>
    );
  }
  return (
    <div className="absolute flex flex-col items-center" style={caja}>
      <AlienSVG sprite={a.sprite} frame={frame} color={a.color} className="h-[52%] w-full" />
      <div className="mt-[3%] flex max-h-[48%] w-full items-center justify-center overflow-hidden rounded border-2 bg-slate-950/90 px-1 text-center font-pixel leading-none text-slate-50 text-[length:clamp(13px,4.2cqw,30px)]"
        style={{ borderColor: a.color, boxShadow: `0 0 10px ${a.color}66` }}>
        <span className="line-clamp-2 break-words">{a.etiqueta}</span>
      </div>
    </div>
  );
}

function Efecto({ e }) {
  const p = e.t / e.dur;
  if (e.tipo === 'explosion') {
    const r = (e.grande ? 9 : 6) * (0.3 + p);
    return (
      <div className="pointer-events-none absolute" style={{ left: pct(e.x), top: pct(e.y), opacity: 1 - p }}>
        {Array.from({ length: 10 }, (_, k) => {
          const ang = (k / 10) * Math.PI * 2;
          return (
            <span key={k} className="absolute block h-[clamp(4px,1.2cqw,9px)] w-[clamp(4px,1.2cqw,9px)]"
              style={{ background: k % 2 ? e.color : '#fde68a', transform: `translate(${Math.cos(ang) * r}cqw, ${Math.sin(ang) * r}cqw)` }} />
          );
        })}
      </div>
    );
  }
  if (e.tipo === 'texto') {
    return (
      <div className="pointer-events-none absolute -translate-x-1/2 whitespace-nowrap font-arcade text-[length:clamp(9px,2.4cqw,16px)]"
        style={{ left: pct(e.x), top: pct(e.y - p * 0.08), color: e.color, opacity: 1 - p * p, textShadow: `0 0 8px ${e.color}` }}>
        {e.texto}
      </div>
    );
  }
  if (e.tipo === 'huida') {
    return (
      <div className="pointer-events-none absolute -translate-x-1/2" style={{ left: pct(e.x), top: pct(e.y - p * 0.4), width: pct(e.w), opacity: 1 - p }}>
        <AlienSVG sprite={1} color={e.color} className="h-[clamp(20px,6cqw,44px)] w-full" />
      </div>
    );
  }
  if (e.tipo === 'salvado') {
    return (
      <div className="pointer-events-none absolute -translate-x-1/2 -translate-y-full text-center font-arcade text-green-300 text-[length:clamp(9px,2.6cqw,18px)] drop-shadow-[0_0_8px_rgba(74,222,128,0.9)]"
        style={{ left: pct(e.x), top: pct(e.y - p * 0.06), opacity: 1 - p * p }}>
        ✔ {e.etiqueta}
      </div>
    );
  }
  return null;
}

export default function PlayField({ mundo, color, onArrastre }) {
  const ref = useRef(null);
  const c = NEON[color];
  if (!mundo) return <div className="inv-estrellas relative min-h-0 flex-1" />;

  const posX = (ev) => {
    const r = ref.current?.getBoundingClientRect();
    return r ? Math.max(0, Math.min(1, (ev.clientX - r.left) / r.width)) : null;
  };
  const arrastre = onArrastre ? {
    onPointerDown: (ev) => { ev.currentTarget.setPointerCapture?.(ev.pointerId); onArrastre(posX(ev)); },
    onPointerMove: (ev) => { if (ev.buttons || ev.pointerType === 'touch') onArrastre(posX(ev)); },
    onPointerUp: () => onArrastre(null),
    onPointerCancel: () => onArrastre(null),
  } : {};

  const errorX = mundo.error > 0 ? Math.sin(mundo.t * 70) * 1.2 : 0;
  const naveTop = NAVE_Y - 0.045;

  return (
    <div ref={ref} {...arrastre}
      className={`inv-estrellas @container relative min-h-0 flex-1 overflow-hidden ${onArrastre ? 'touch-none' : ''}`}>
      {mundo.formacion && <Formacion formacion={mundo.formacion} t={mundo.t} color={c.hex} />}

      {/* Suelo */}
      <div className="pointer-events-none absolute left-0 right-0 h-[2px]"
        style={{ top: pct(SUELO), background: `linear-gradient(90deg, transparent, ${c.hex}, transparent)`, boxShadow: `0 0 10px ${c.hex}` }} />

      {/* Aliens */}
      {mundo.alien && <Alien a={mundo.alien} t={mundo.t} resaltado />}
      {mundo.aliens?.map((a) => <Alien key={a.id} a={a} t={mundo.t} conEtiqueta />)}

      {/* Láser (V1) */}
      {mundo.laser && (
        <div className="pointer-events-none absolute w-[clamp(3px,0.8cqw,6px)] -translate-x-1/2 rounded-full"
          style={{
            left: pct(mundo.laser.x),
            top: pct(mundo.laser.yFin),
            height: pct(Math.max(0, naveTop - mundo.laser.yFin)),
            background: `linear-gradient(to top, #fff, ${c.hex})`,
            boxShadow: `0 0 14px ${c.hex}, 0 0 4px #fff`,
            opacity: mundo.laser.t > 0.2 ? 1 - (mundo.laser.t - 0.2) / 0.1 : 1,
          }} />
      )}

      {/* Balas (V2) */}
      {mundo.balas?.map((b) => (
        <div key={b.id} className="pointer-events-none absolute h-[3.2%] w-[clamp(3px,0.7cqw,6px)] -translate-x-1/2 rounded-sm"
          style={{ left: pct(b.x), top: pct(b.y), background: c.hex, boxShadow: `0 0 8px ${c.hex}` }} />
      ))}

      {/* Nave del jugador */}
      <div className="pointer-events-none absolute -translate-x-1/2"
        style={{ left: `calc(${pct(mundo.nave.x)} + ${errorX}cqw)`, top: pct(naveTop), height: '8%', aspectRatio: '13 / 8' }}>
        <NaveSVG color={mundo.error > 0 ? '#f43f5e' : c.hex} className="h-full w-full" style={{ filter: `drop-shadow(0 0 6px ${c.hex})` }} />
      </div>

      {mundo.efectos.map((e) => <Efecto key={e.id} e={e} />)}

      {/* Golpe: destello rojo */}
      {mundo.golpe > 0 && <div className="pointer-events-none absolute inset-0 bg-rose-600" style={{ opacity: mundo.golpe * 0.45 }} />}
    </div>
  );
}
