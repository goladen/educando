// Ratón a distancia con la mano: el punto entre el pulgar y el índice mueve un
// cursor por la pantalla y al JUNTAR pulgar e índice (pinza) se pulsa.
// Pinza corta = clic (botones, pestañas…); pinza mantenida moviendo = arrastrar
// o dibujar en la pizarra. Se envían eventos de puntero y ratón sintéticos al
// elemento que hay debajo, así que funciona con cualquier parte de la web.
import React, { useEffect, useRef, useState } from 'react';
import { escucharManos } from './manosVision.js';
import VistaManos, { useEstadoManos } from './VistaManos.jsx';

const LS_ZONA = 'pikt_manos_zona';
const PINZA_ON = 0.3;
const PINZA_OFF = 0.45;
const MAX_VIAJE_CLIC = 30; // px: si la pinza se mueve más, es arrastre y no clic
const CLICABLE = 'button, a, [role="button"], input, select, textarea, label, canvas, [onclick]';

const clamp01 = (v) => Math.max(0, Math.min(1, v));

function leerZona() {
  try {
    const v = parseFloat(localStorage.getItem(LS_ZONA));
    return Number.isFinite(v) ? v : 0.18;
  } catch {
    return 0.18;
  }
}

function disparar(tipo, el, x, y) {
  if (!el) return;
  const pulsando = tipo.endsWith('down') || tipo.endsWith('move');
  const base = { bubbles: true, cancelable: true, view: window, clientX: x, clientY: y, button: 0, buttons: pulsando ? 1 : 0 };
  if (tipo.startsWith('pointer')) {
    el.dispatchEvent(new PointerEvent(tipo, { ...base, pointerId: 77, pointerType: 'mouse', isPrimary: true }));
  } else {
    el.dispatchEvent(new MouseEvent(tipo, base));
  }
}

export default function CursorManos({ onClose, onAbrirQuiz }) {
  const cursorRef = useRef(null);
  const anilloRef = useRef(null);
  const [zona, setZona] = useState(leerZona);
  const [minimizado, setMinimizado] = useState(false);
  const estado = useEstadoManos();
  const zonaRef = useRef(zona);
  zonaRef.current = zona;
  const s = useRef({ x: window.innerWidth / 2, y: window.innerHeight / 2, pulsado: false, objetivo: null, ix: 0, iy: 0, viaje: 0, cerca: 0 });

  useEffect(() => {
    try {
      localStorage.setItem(LS_ZONA, String(zona));
    } catch {
      /* sin almacenamiento */
    }
  }, [zona]);

  useEffect(() => {
    const st = s.current;
    const soltar = () => {
      if (!st.pulsado) return;
      st.pulsado = false;
      const debajo = document.elementFromPoint(st.x, st.y) || st.objetivo;
      disparar('pointerup', st.objetivo, st.x, st.y);
      disparar('mouseup', st.objetivo, st.x, st.y);
      if (st.viaje < MAX_VIAJE_CLIC && st.objetivo && (debajo === st.objetivo || st.objetivo.contains(debajo))) {
        disparar('click', st.objetivo, st.x, st.y);
      }
      st.objetivo = null;
    };

    const baja = escucharManos((manos) => {
      const el = cursorRef.current;
      if (!el) return;
      const m = manos[0];
      if (!m) {
        soltar();
        el.style.opacity = '0.25';
        return;
      }
      el.style.opacity = '1';
      // Punto medio pulgar-índice: no salta al hacer la pinza.
      const px = (m.puntos[4].x + m.puntos[8].x) / 2;
      const py = (m.puntos[4].y + m.puntos[8].y) / 2;
      const z = zonaRef.current;
      const tx = clamp01((px - z) / (1 - 2 * z)) * window.innerWidth;
      const ty = clamp01((py - z) / (1 - 2 * z)) * window.innerHeight;
      // Suavizado adaptativo: lento = estable, rápido = responde.
      const dist = Math.hypot(tx - st.x, ty - st.y);
      const a = Math.min(0.7, 0.14 + dist / 260);
      st.x += (tx - st.x) * a;
      st.y += (ty - st.y) * a;
      el.style.transform = `translate(${st.x - 20}px, ${st.y - 20}px)`;

      // Pinza con histéresis y confirmación de 2 fotogramas para no hacer clics fantasma.
      if (!st.pulsado) {
        st.cerca = m.pinza < PINZA_ON ? st.cerca + 1 : 0;
        if (st.cerca >= 2) {
          st.pulsado = true;
          st.cerca = 0;
          st.ix = st.x;
          st.iy = st.y;
          st.viaje = 0;
          st.objetivo = document.elementFromPoint(st.x, st.y);
          disparar('pointerdown', st.objetivo, st.x, st.y);
          disparar('mousedown', st.objetivo, st.x, st.y);
          if (st.objetivo?.matches?.('input, textarea, select')) st.objetivo.focus();
        }
      } else if (m.pinza > PINZA_OFF) {
        soltar();
      } else {
        st.viaje = Math.max(st.viaje, Math.hypot(st.x - st.ix, st.y - st.iy));
        disparar('pointermove', st.objetivo, st.x, st.y);
        disparar('mousemove', st.objetivo, st.x, st.y);
      }

      const debajo = st.pulsado ? null : document.elementFromPoint(st.x, st.y);
      const clicable = !!debajo?.closest?.(CLICABLE);
      const anillo = anilloRef.current;
      if (anillo) {
        anillo.style.background = st.pulsado ? 'rgba(239,68,68,0.55)' : clicable ? 'rgba(250,204,21,0.35)' : 'rgba(255,255,255,0.15)';
        anillo.style.borderColor = st.pulsado ? '#ef4444' : clicable ? '#facc15' : '#0ea5e9';
        anillo.style.transform = st.pulsado ? 'scale(0.7)' : 'scale(1)';
      }
    });
    return () => {
      soltar();
      baja();
    };
  }, []);

  return (
    <>
      {/* Cursor */}
      <div
        ref={cursorRef}
        style={{ position: 'fixed', left: 0, top: 0, width: 40, height: 40, zIndex: 2147483000, pointerEvents: 'none', opacity: 0.25, transform: 'translate(-100px,-100px)' }}
      >
        <div
          ref={anilloRef}
          style={{ width: 40, height: 40, borderRadius: '50%', border: '4px solid #0ea5e9', boxSizing: 'border-box', boxShadow: '0 0 0 2px #fff, 0 4px 14px rgba(0,0,0,0.35)', transition: 'transform 0.1s, background 0.1s' }}
        />
        <div style={{ position: 'absolute', left: 17, top: 17, width: 6, height: 6, borderRadius: '50%', background: '#0f172a' }} />
      </div>

      {/* Panel */}
      <div
        style={{ position: 'fixed', right: 12, bottom: 12, zIndex: 2147482000, background: '#0f172a', color: '#fff', borderRadius: 14, padding: 10, boxShadow: '0 10px 30px rgba(0,0,0,0.4)', width: minimizado ? 'auto' : 236, fontFamily: 'system-ui, sans-serif' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: minimizado ? 0 : 8 }}>
          <b style={{ flex: 1, fontSize: '0.85rem' }}>✋ Control con la mano</b>
          <button onClick={() => setMinimizado((v) => !v)} title={minimizado ? 'Mostrar' : 'Minimizar'} style={btnMini}>
            {minimizado ? '▢' : '–'}
          </button>
          <button onClick={onClose} title="Apagar la cámara" style={{ ...btnMini, background: '#ef4444' }}>
            ✕
          </button>
        </div>
        {/* La vista se mantiene montada aunque esté minimizado (la cámara sigue). */}
        <div style={{ display: minimizado ? 'none' : 'block' }}>
          <VistaManos ancho={216} zona={zona} />
          {estado.estado === 'listo' && (
            <>
              <div style={{ fontSize: '0.72rem', color: '#cbd5e1', margin: '8px 0 4px', lineHeight: 1.35 }}>
                Mueve la mano para llevar el círculo. <b style={{ color: '#facc15' }}>Junta pulgar e índice</b> para hacer clic;
                mantenlos juntos y muévete para <b>dibujar o arrastrar</b>.
              </div>
              <label style={{ fontSize: '0.72rem', color: '#cbd5e1', display: 'block' }}>
                Alcance: {zona < 0.15 ? 'cerca de la cámara' : zona < 0.27 ? 'normal' : 'lejos (gesto corto)'}
                <input
                  type="range"
                  min={0.05}
                  max={0.35}
                  step={0.01}
                  value={zona}
                  onChange={(e) => setZona(parseFloat(e.target.value))}
                  style={{ width: '100%' }}
                />
              </label>
            </>
          )}
          {onAbrirQuiz && (
            <button
              onClick={onAbrirQuiz}
              style={{ marginTop: 6, width: '100%', padding: '7px 10px', borderRadius: 9, border: 'none', background: '#8b5cf6', color: '#fff', fontWeight: 800, cursor: 'pointer' }}
            >
              🎮 Quiz respondiendo con los dedos
            </button>
          )}
        </div>
      </div>
    </>
  );
}

const btnMini = { border: 'none', background: '#334155', color: '#fff', borderRadius: 6, width: 24, height: 24, cursor: 'pointer', fontWeight: 800, lineHeight: 1 };
