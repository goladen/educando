// Vista previa de la webcam en espejo con el esqueleto de las manos encima.
// `colorMano(mano, i)` decide el color de cada mano (por defecto verde/azul) y
// `lineaCentral` dibuja la división izquierda/derecha del modo 2 jugadores.
import React, { useEffect, useRef, useState } from 'react';
import { escucharManos, escucharEstadoManos, getVideoManos, reintentarManos, CONEXIONES_MANO } from './manosVision.js';

const COLORES_DEF = ['#22c55e', '#3b82f6'];

export function useEstadoManos() {
  const [e, setE] = useState({ estado: 'apagado', error: '' });
  useEffect(() => escucharEstadoManos(setE), []);
  return e;
}

export function AvisoEstadoManos({ estado, oscuro = false }) {
  if (estado.estado === 'listo') return null;
  const color = oscuro ? '#e2e8f0' : '#334155';
  if (estado.estado === 'error')
    return (
      <div style={{ color: '#ef4444', fontSize: '0.8rem', fontWeight: 700, textAlign: 'center' }}>
        ⚠️ {estado.error}
        <div>
          <button
            onClick={reintentarManos}
            style={{ marginTop: 6, padding: '4px 10px', borderRadius: 8, border: 'none', background: '#ef4444', color: '#fff', fontWeight: 700, cursor: 'pointer' }}
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  return (
    <div style={{ color, fontSize: '0.8rem', fontWeight: 700, textAlign: 'center' }}>
      ⏳ Preparando la cámara y el reconocimiento de manos…
    </div>
  );
}

export default function VistaManos({ ancho = 220, colorMano, lineaCentral = false, zona = 0, style }) {
  const canvasRef = useRef(null);
  const estado = useEstadoManos();

  useEffect(
    () =>
      escucharManos((manos) => {
        const cv = canvasRef.current;
        const v = getVideoManos();
        if (!cv || !v) return;
        const w = cv.width;
        const h = cv.height;
        const ctx = cv.getContext('2d');
        ctx.save();
        ctx.translate(w, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(v, 0, 0, w, h);
        ctx.restore();
        if (zona > 0) {
          // Zona activa del cursor: lo de fuera se oscurece.
          ctx.fillStyle = 'rgba(0,0,0,0.35)';
          ctx.fillRect(0, 0, w, h * zona);
          ctx.fillRect(0, h * (1 - zona), w, h * zona);
          ctx.fillRect(0, h * zona, w * zona, h * (1 - 2 * zona));
          ctx.fillRect(w * (1 - zona), h * zona, w * zona, h * (1 - 2 * zona));
        }
        if (lineaCentral) {
          ctx.strokeStyle = 'rgba(255,255,255,0.8)';
          ctx.setLineDash([6, 6]);
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(w / 2, 0);
          ctx.lineTo(w / 2, h);
          ctx.stroke();
          ctx.setLineDash([]);
        }
        manos.forEach((m, i) => {
          const col = colorMano ? colorMano(m, i) : COLORES_DEF[i % 2];
          ctx.strokeStyle = col;
          ctx.fillStyle = col;
          ctx.lineWidth = 2.5;
          CONEXIONES_MANO.forEach(([a, b]) => {
            ctx.beginPath();
            ctx.moveTo(m.puntos[a].x * w, m.puntos[a].y * h);
            ctx.lineTo(m.puntos[b].x * w, m.puntos[b].y * h);
            ctx.stroke();
          });
          m.puntos.forEach((p) => {
            ctx.beginPath();
            ctx.arc(p.x * w, p.y * h, 2.5, 0, Math.PI * 2);
            ctx.fill();
          });
        });
      }),
    [colorMano, lineaCentral, zona]
  );

  const v = getVideoManos();
  const aspecto = v && v.videoHeight ? v.videoWidth / v.videoHeight : 16 / 9;
  const alto = Math.round(ancho / aspecto);

  return (
    <div style={{ width: ancho, ...style }}>
      <canvas
        ref={canvasRef}
        width={ancho * 2}
        height={alto * 2}
        style={{ width: ancho, height: alto, borderRadius: 10, background: '#0f172a', display: estado.estado === 'listo' ? 'block' : 'none' }}
      />
      {estado.estado !== 'listo' && (
        <div style={{ width: ancho, minHeight: alto, borderRadius: 10, background: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 10, boxSizing: 'border-box' }}>
          <AvisoEstadoManos estado={estado} oscuro />
        </div>
      )}
    </div>
  );
}
