import React, { useState, useEffect } from 'react';
import pikaSprite from '../assets/pikatron-sprite2.png';
import pikaSprite1 from '../assets/pikatron-sprite.png';

// ─── Componente COMPARTIDO del tirón de cuerda ─────────────────────────────────
// Escenario + personajes elegibles por equipo + armazón de competición.
// Cada juego aporta su PANEL NATIVO de preguntas (render-prop) que llama a
// onResultado(true|false) por cada respuesta.

export const TIRON_CSS = `
  @keyframes cuHeaveL{0%,100%{transform:rotate(-9deg)}50%{transform:rotate(-19deg)}}
  @keyframes cuHeaveR{0%,100%{transform:rotate(9deg)}50%{transform:rotate(19deg)}}
  @keyframes cuCelebrate{0%,100%{transform:rotate(-5deg)}50%{transform:rotate(5deg)}}
  @keyframes cuWinJump{0%,100%{transform:translateY(0)}40%{transform:translateY(-9px)}}
  @keyframes cuDust{0%{opacity:.55;transform:translateX(-50%) scale(.5)}100%{opacity:0;transform:translateX(-50%) scale(1.7)}}
  @keyframes cuRopeB{0%,100%{transform:translateY(0)}50%{transform:translateY(2px)}}
  @keyframes cuPikaRun{0%{background-position:0% 0%}50%{background-position:0% 100%}100%{background-position:0% 0%}}
`;

export function FiguraSVG({ shirt, hair, w = 48, h = 70 }) {
  return (
    <svg viewBox="-22 -64 46 68" width={w} height={h} style={{ overflow: 'visible', display: 'block' }}>
      <path d="M-12,0 L-1,-26" stroke="#324a5f" strokeWidth="5" strokeLinecap="round" fill="none" />
      <path d="M13,0 L5,-14 L0,-27" stroke="#3a5568" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <path d="M0,-25 L-6,-46" stroke={shirt} strokeWidth="12" strokeLinecap="round" fill="none" />
      <path d="M-5,-44 L18,-33" stroke={shirt} strokeWidth="6" strokeLinecap="round" fill="none" />
      <circle cx="18" cy="-33" r="3.6" fill="#f6c9a0" />
      <circle cx="-8" cy="-52" r="7.6" fill="#f6c9a0" />
      {hair === 'pony'
        ? <><path d="M-16,-54 a8.5,8.5 0 0 1 15,-2 l-2,5 z" fill="#7a4a1e" /><path d="M-14,-56 q-12,6 -9,21 q1,6 6,6" fill="none" stroke="#7a4a1e" strokeWidth="6" strokeLinecap="round" /></>
        : <path d="M-16,-52 a8,8 0 0 1 15,-3 l-2,4 z" fill="#3a2817" />}
    </svg>
  );
}

// Personajes elegibles por equipo
export const PERSONAJES = [
  { id: 'pi-azul', label: 'Pi Azul', kind: 'sprite', src: pikaSprite, hue: 'none', face: 'left' },
  { id: 'pi-rojo', label: 'Pi Rojo', kind: 'sprite', src: pikaSprite, hue: 'hue-rotate(150deg) saturate(1.5)', face: 'left' },
  { id: 'pi-verde', label: 'Pi Verde', kind: 'sprite', src: pikaSprite, hue: 'hue-rotate(75deg) saturate(1.2)', face: 'left' },
  { id: 'pi-morado', label: 'Pi Morado', kind: 'sprite', src: pikaSprite, hue: 'hue-rotate(230deg) saturate(1.3)', face: 'left' },
  { id: 'pikatron', label: 'Pikatron', kind: 'sprite', src: pikaSprite1, hue: 'none', face: 'right' },
  { id: 'chica', label: 'Chica', kind: 'svg', shirt: '#2f7fd8', hair: 'pony', face: 'right' },
  { id: 'chico', label: 'Chico', kind: 'svg', shirt: '#e14b4b', hair: 'short', face: 'right' },
];
export const getPersonaje = (id) => PERSONAJES.find((p) => p.id === id) || PERSONAJES[0];

export function PreviewPersonaje({ p, size = 34 }) {
  if (p.kind === 'sprite') {
    return <div style={{ width: size, height: size, backgroundImage: `url(${p.src})`, backgroundSize: '200% 200%', backgroundPosition: '0% 0%', backgroundRepeat: 'no-repeat', filter: p.hue !== 'none' ? p.hue : 'none' }} />;
  }
  return <div style={{ width: size, height: size, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}><FiguraSVG shirt={p.shirt} hair={p.hair} w={size * 0.7} h={size} /></div>;
}

// Escenario del tirón de cuerda (2 equipos de 3 miembros)
export function ZonaCuerda({ diff, ganador, limite, charL, charR }) {
  const off = diff * (30 / limite);
  const POS = [3, 12, 21];

  const miembro = (side, idx) => {
    const win = (side === 'L' && ganador === 1) || (side === 'R' && ganador === 2);
    const delay = `${idx * 0.13}s`;
    const anclaje = side === 'L' ? { left: `${POS[idx]}%` } : { right: `${POS[idx]}%` };
    const p = side === 'L' ? charL : charR;
    // Cada personaje debe MIRAR al centro (a la cuerda) según su orientación de origen
    const face = p.face || (p.kind === 'sprite' ? 'left' : 'right');
    const desired = side === 'L' ? 'right' : 'left';
    const faceFlip = face !== desired;
    const leanAnim = win ? 'cuCelebrate' : (side === 'L' ? 'cuHeaveL' : 'cuHeaveR');
    const cuerpo = p.kind === 'sprite'
      ? <div style={{ width: 46, height: 46, backgroundImage: `url(${p.src})`, backgroundSize: '200% 200%', backgroundRepeat: 'no-repeat', animation: 'cuPikaRun 0.55s steps(1) infinite', animationDelay: delay, filter: p.hue !== 'none' ? p.hue : 'none' }} />
      : <FiguraSVG shirt={p.shirt} hair={p.hair} />;
    return (
      <div key={side + idx} style={{ position: 'absolute', bottom: 16, ...anclaje, zIndex: 5 - idx }}>
        <div style={{ animation: win ? 'cuWinJump 0.6s ease-in-out infinite' : 'none', filter: win ? 'drop-shadow(0 0 7px #FFE234)' : 'none' }}>
          <div style={{ transformOrigin: '50% 100%', animation: `${leanAnim} 0.8s ease-in-out infinite`, animationDelay: delay }}>
            <div style={{ transform: faceFlip ? 'scaleX(-1)' : 'none' }}>{cuerpo}</div>
          </div>
        </div>
        <span style={{ position: 'absolute', bottom: -2, left: '50%', width: 22, height: 7, borderRadius: '50%', background: '#fff', animation: 'cuDust 0.9s ease-out infinite', animationDelay: delay }} />
      </div>
    );
  };

  return (
    <div style={{ position: 'relative', height: 138, overflow: 'hidden', borderRadius: 16, background: 'linear-gradient(180deg,#0b2447 0%,#19376d 58%,#3aa15f 58%,#1c7a43 100%)', boxShadow: 'inset 0 -10px 18px rgba(0,0,0,0.25)' }}>
      <style>{TIRON_CSS}</style>
      <div style={{ position: 'absolute', left: '50%', top: 0, bottom: 24, width: 2, background: 'rgba(255,255,255,0.14)', zIndex: 1 }} />
      <div style={{ position: 'absolute', inset: 0, transform: `translateX(${off}%)`, transition: 'transform 0.4s cubic-bezier(0.34,1.56,0.64,1)', zIndex: 2 }}>
        {/* Cuerda trenzada, a la altura de las manos, pasando entre los equipos */}
        <div style={{ position: 'absolute', left: '24%', right: '24%', bottom: 40, height: 9, borderRadius: 5,
          background: 'repeating-linear-gradient(62deg,#5c3a0e 0 3px,#9a6a18 3px 6px,#d29a2c 6px 8px,#9a6a18 8px 10px)',
          boxShadow: '0 2px 5px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.25), inset 0 -2px 3px rgba(0,0,0,0.35)',
          animation: 'cuRopeB 0.75s ease-in-out infinite', zIndex: 3 }}>
          <div style={{ position: 'absolute', left: '50%', top: -24, transform: 'translateX(-50%)' }}>
            <div style={{ width: 2, height: 26, background: '#FFE234' }} />
            <div style={{ position: 'absolute', top: 0, left: 2, width: 16, height: 11, background: 'linear-gradient(135deg,#E53935,#FF5722)', clipPath: 'polygon(0 0,100% 0,80% 100%,0 100%)' }} />
          </div>
        </div>
        {[0, 1, 2].map((i) => miembro('L', i))}
        {[0, 1, 2].map((i) => miembro('R', i))}
      </div>
      <div style={{ position: 'absolute', bottom: 5, left: '50%', transform: 'translateX(-50%)', background: 'rgba(0,0,0,0.6)', borderRadius: 20, padding: '2px 12px', fontSize: '0.7rem', color: 'rgba(255,255,255,0.85)', fontWeight: 700, zIndex: 6, whiteSpace: 'nowrap' }}>
        {diff === 0 ? '— ¡Igualados! —' : diff < 0 ? `🔵 Equipo 1 +${Math.abs(diff)}` : `🔴 Equipo 2 +${diff}`}
      </div>
    </div>
  );
}

// Selector de personaje por equipo (miniaturas)
export function SelectorPersonajes({ charLId, setCharLId, charRId, setCharRId, dark = false }) {
  const rows = [
    { eq: 1, sel: charLId, set: setCharLId, color: '#42A5F5' },
    { eq: 2, sel: charRId, set: setCharRId, color: '#EF5350' },
  ];
  const txt = dark ? 'rgba(255,255,255,0.6)' : '#64748b';
  return (
    <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', justifyContent: 'center' }}>
      {rows.map((t) => (
        <div key={t.eq}>
          <div style={{ fontSize: '0.68rem', color: t.color, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 5, textAlign: 'center' }}>Equipo {t.eq}</div>
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', justifyContent: 'center', maxWidth: 320 }}>
            {PERSONAJES.map((p) => {
              const activo = t.sel === p.id;
              return (
                <button key={p.id} onClick={() => t.set(p.id)} title={p.label}
                  style={{ padding: 3, borderRadius: 9, border: '2px solid', borderColor: activo ? t.color : (dark ? 'rgba(255,255,255,0.1)' : '#e2e8f0'), background: activo ? (dark ? 'rgba(255,255,255,0.12)' : '#eef2ff') : 'transparent', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', width: 46 }}>
                  <PreviewPersonaje p={p} size={30} />
                  <span style={{ fontSize: '0.5rem', color: activo ? t.color : txt, fontWeight: 700, whiteSpace: 'nowrap' }}>{p.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

export const METAS_CUERDA = [
  { valor: 3, label: '⚡ Exprés', desc: '±3' },
  { valor: 5, label: '🎯 Corta', desc: '±5' },
  { valor: 7, label: '🔥 Media', desc: '±7' },
  { valor: 10, label: '🏔️ Larga', desc: '±10' },
];

// Hook con la lógica del tirón (diff, ganador, marcadores, meta, personajes)
export function useTironCuerda(metaInicial = 5) {
  const [limite, setLimite] = useState(metaInicial);
  const [diff, setDiff] = useState(0);
  const [ganador, setGanador] = useState(null);
  const [p1, setP1] = useState(0);
  const [p2, setP2] = useState(0);
  const [ronda, setRonda] = useState(0);
  const [charLId, setCharLId] = useState('pi-azul');
  const [charRId, setCharRId] = useState('pi-rojo');

  useEffect(() => { if (!ganador && Math.abs(diff) >= limite) setGanador(diff < 0 ? 1 : 2); }, [diff, ganador, limite]);

  const reiniciar = () => { setDiff(0); setGanador(null); setP1(0); setP2(0); setRonda((r) => r + 1); };
  const cambiarMeta = (v) => { setLimite(v); reiniciar(); };
  const aplicar = (equipo, ok) => {
    if (ganador) return;
    if (ok) (equipo === 1 ? setP1 : setP2)((v) => v + 1);
    const delta = ok ? (equipo === 1 ? -1 : 1) : (equipo === 1 ? 1 : -1);
    setDiff((prev) => Math.max(-limite, Math.min(limite, prev + delta)));
  };

  return {
    limite, setLimite, cambiarMeta, diff, ganador, p1, p2, ronda, reiniciar, aplicar,
    charL: getPersonaje(charLId), charR: getPersonaje(charRId), charLId, setCharLId, charRId, setCharRId,
  };
}

// Pantalla de ganador (overlay)
export function PantallaGanador({ ganador, p1, p2, onRevancha, onSalir }) {
  if (!ganador) return null;
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 10002, gap: 14, padding: 20 }}>
      <div style={{ fontSize: '4.5rem' }}>🏆</div>
      <div style={{ fontSize: '2.2rem', fontWeight: 900, color: ganador === 1 ? '#42A5F5' : '#EF5350', textAlign: 'center' }}>¡Gana el Equipo {ganador}!</div>
      <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.95rem' }}>🔵 Equipo 1: {p1} · 🔴 Equipo 2: {p2}</div>
      <div style={{ display: 'flex', gap: 12, marginTop: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
        <button onClick={onRevancha} style={{ padding: '13px 32px', fontSize: '1rem', fontWeight: 900, border: 'none', borderRadius: 16, background: 'linear-gradient(135deg,#f093fb,#f5576c)', color: 'white', cursor: 'pointer' }}>🔄 Revancha</button>
        {onSalir && <button onClick={onSalir} style={{ padding: '13px 24px', fontSize: '0.9rem', fontWeight: 900, borderRadius: 16, background: 'transparent', color: 'rgba(255,255,255,0.7)', border: '2px solid rgba(255,255,255,0.25)', cursor: 'pointer' }}>← Salir</button>}
      </div>
    </div>
  );
}

// Armazón completo: barra (meta + personajes) + cuerda + 2 paneles nativos + ganador.
// renderPanel(equipo, { aplicar, bloqueado, ronda }) → el panel nativo de cada juego.
export function CompeticionCuerda({ metaInicial = 5, onSalir, renderPanel, isMobile = false, extraBar = null, configExtra = null }) {
  const t = useTironCuerda(metaInicial);
  const [mostrarConfig, setMostrarConfig] = useState(true);
  return (
    <div>
      <style>{TIRON_CSS}</style>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 6 }}>
        <button onClick={() => setMostrarConfig((s) => !s)}
          style={{ padding: '6px 12px', borderRadius: 20, border: '2px solid #94a3b8', background: 'white', color: '#475569', fontWeight: 800, fontSize: '0.78rem', cursor: 'pointer' }}>
          {mostrarConfig ? '🔽 Ocultar opciones' : '⚙️ Mostrar opciones'}
        </button>
      </div>

      {mostrarConfig && (
        <div style={{ background: '#fff9e6', border: '2px solid #f39c12', borderRadius: 12, padding: '10px 14px', marginBottom: 12, fontSize: '0.85rem', color: '#7d6608', fontWeight: 700 }}>
          <div style={{ textAlign: 'center', marginBottom: 8 }}>🪢 <b>Competición por equipos</b> · Acierta para tirar de la cuerda · Falla y el rival gana terreno</div>
          {configExtra}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap', alignItems: 'center', marginBottom: 8 }}>
            <span>Meta:</span>
            {METAS_CUERDA.map((m) => (
              <button key={m.valor} onClick={() => t.cambiarMeta(m.valor)}
                style={{ padding: '5px 11px', borderRadius: 20, cursor: 'pointer', fontWeight: 800, fontSize: '0.78rem', border: '2px solid #f39c12', background: t.limite === m.valor ? '#f39c12' : 'white', color: t.limite === m.valor ? 'white' : '#b9770f' }}>
                {m.label} <span style={{ opacity: 0.8 }}>{m.desc}</span>
              </button>
            ))}
            {extraBar}
          </div>
          <SelectorPersonajes charLId={t.charLId} setCharLId={t.setCharLId} charRId={t.charRId} setCharRId={t.setCharRId} />
        </div>
      )}

      <ZonaCuerda diff={t.diff} ganador={t.ganador} limite={t.limite} charL={t.charL} charR={t.charR} />

      <div style={{ display: 'flex', gap: 16, marginTop: 14, alignItems: 'flex-start', flexDirection: isMobile ? 'column' : 'row' }}>
        <div style={{ flex: 1, minWidth: 0, width: '100%' }}>
          {renderPanel(1, { key: `e1-${t.ronda}`, aplicar: (ok) => t.aplicar(1, ok), bloqueado: !!t.ganador, ronda: t.ronda })}
        </div>
        <div style={{ width: 4, background: '#e2e8f0', alignSelf: 'stretch', borderRadius: 4 }} />
        <div style={{ flex: 1, minWidth: 0, width: '100%' }}>
          {renderPanel(2, { key: `e2-${t.ronda}`, aplicar: (ok) => t.aplicar(2, ok), bloqueado: !!t.ganador, ronda: t.ronda })}
        </div>
      </div>

      <PantallaGanador ganador={t.ganador} p1={t.p1} p2={t.p2} onRevancha={t.reiniciar} onSalir={onSalir} />
    </div>
  );
}
