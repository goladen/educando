// Panel flotante para jugar con el cuerpo: vista de la cámara + indicador de
// dirección/salto + «Centrar». Avisa al juego solo cuando cambia algo:
//   onDir(-1 | 0 | 1) al cambiar la dirección, onSalto() al despegar.
import React, { useEffect, useRef, useState } from 'react';
import { escucharControlCuerpo, leerSensibilidadSalto, leerModoDireccion } from './controlCuerpo.js';
import { escucharEstadoPose, reintentarPose, getVideoPose, CONEXIONES_POSE } from './poseVision.js';

export default function PanelControlCuerpo({ onDir, onSalto, onCerrar, ancho = 200, style }) {
  const canvasRef = useRef(null);
  const ctrl = useRef(null);
  const cb = useRef({ onDir, onSalto });
  cb.current = { onDir, onSalto };
  const [estado, setEstado] = useState({ estado: 'apagado', error: '' });
  const [vista, setVista] = useState({ presente: false, dir: 0 });
  const [saltoVisto, setSaltoVisto] = useState(0);
  const [sensibilidad, setSensibilidad] = useState(leerSensibilidadSalto);
  const [modoDir, setModoDir] = useState(leerModoDireccion);

  useEffect(() => escucharEstadoPose(setEstado), []);

  useEffect(() => {
    let dirPrev = 0;
    let tUi = 0;
    ctrl.current = escucharControlCuerpo((g, persona) => {
      if (g.dir !== dirPrev) {
        dirPrev = g.dir;
        cb.current.onDir?.(g.dir);
      }
      if (g.salto) {
        cb.current.onSalto?.();
        setSaltoVisto(performance.now());
      }
      const ahora = performance.now();
      if (ahora - tUi > 100) {
        tUi = ahora;
        setVista((v) => (v.presente === g.presente && v.dir === g.dir ? v : { presente: g.presente, dir: g.dir }));
      }
      dibujar(persona);
    });
    return () => {
      ctrl.current?.baja();
      cb.current.onDir?.(0);
    };
  }, []);

  function dibujar(persona) {
    const cv = canvasRef.current;
    const v = getVideoPose();
    if (!cv || !v) return;
    const ctx = cv.getContext('2d');
    const { width: w, height: h } = cv;
    ctx.save();
    ctx.translate(w, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(v, 0, 0, w, h);
    ctx.restore();
    if (!persona) return;
    const p = persona.puntos;
    ctx.strokeStyle = '#22c55e';
    ctx.lineWidth = 3;
    CONEXIONES_POSE.forEach(([a, b]) => {
      if (p[a].v < 0.5 || p[b].v < 0.5) return;
      ctx.beginPath();
      ctx.moveTo(p[a].x * w, p[a].y * h);
      ctx.lineTo(p[b].x * w, p[b].y * h);
      ctx.stroke();
    });
  }

  const saltando = performance.now() - saltoVisto < 500;
  const flecha = (d, txt) => (
    <span style={{ fontSize: '1.3rem', fontWeight: 900, color: vista.dir === d ? '#22c55e' : 'rgba(255,255,255,0.25)' }}>{txt}</span>
  );

  return (
    <div
      style={{
        width: ancho,
        background: 'rgba(15,23,42,0.88)',
        borderRadius: 12,
        padding: 6,
        boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
        fontFamily: 'system-ui, sans-serif',
        ...style,
      }}
    >
      <div style={{ position: 'relative' }}>
        <canvas ref={canvasRef} width={320} height={180} style={{ width: '100%', borderRadius: 8, display: 'block', background: '#000' }} />
        {estado.estado !== 'listo' && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: estado.estado === 'error' ? '#fca5a5' : '#e2e8f0', fontSize: '0.72rem', fontWeight: 700, textAlign: 'center', padding: 6 }}>
            {estado.estado === 'error' ? `⚠️ ${estado.error}` : '⏳ Encendiendo la cámara…'}
            {estado.estado === 'error' && (
              <button onClick={reintentarPose} style={{ marginTop: 4, border: 'none', borderRadius: 6, padding: '2px 8px', fontWeight: 700, cursor: 'pointer' }}>
                Reintentar
              </button>
            )}
          </div>
        )}
        {saltando && <div style={{ position: 'absolute', top: 4, left: '50%', transform: 'translateX(-50%)', background: '#f59e0b', color: '#000', borderRadius: 6, padding: '1px 8px', fontWeight: 900, fontSize: '0.8rem' }}>¡SALTO!</div>}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 4, gap: 4 }}>
        {flecha(-1, '◀')}
        <span style={{ color: vista.presente ? (vista.dir === 0 ? '#22c55e' : '#94a3b8') : '#fca5a5', fontSize: '0.68rem', fontWeight: 800, textAlign: 'center' }}>
          {!vista.presente ? 'No te veo' : vista.dir === 0 ? 'Quieto' : vista.dir > 0 ? 'Derecha' : 'Izquierda'}
        </span>
        {flecha(1, '▶')}
      </div>
      <div style={{ display: 'flex', gap: 4, marginTop: 4, alignItems: 'center' }}>
        <select
          value={modoDir}
          onChange={(e) => {
            setModoDir(e.target.value);
            ctrl.current?.setModoDireccion(e.target.value);
          }}
          title="Cómo se elige la dirección"
          style={{ flex: 1, fontSize: '0.66rem', borderRadius: 5, padding: '2px 2px', fontWeight: 700 }}
        >
          <option value="brazos">Andar: estira un brazo</option>
          <option value="cabeza">Andar: gira la cabeza</option>
        </select>
        {modoDir === 'cabeza' && (
          <button
            onClick={() => ctrl.current?.centrar()}
            title="Mira de frente a la cámara y pulsa"
            style={{ border: 'none', borderRadius: 6, padding: '4px 6px', fontWeight: 800, fontSize: '0.66rem', cursor: 'pointer', background: '#2563eb', color: '#fff' }}
          >
            🎯 Centrar
          </button>
        )}
        {onCerrar && (
          <button onClick={onCerrar} style={{ border: 'none', borderRadius: 6, padding: '4px 8px', fontWeight: 800, fontSize: '0.7rem', cursor: 'pointer', background: '#475569', color: '#fff' }}>
            ✕
          </button>
        )}
      </div>
      <label style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4, color: '#e2e8f0', fontSize: '0.66rem', fontWeight: 700 }}>
        Salto:
        <select
          value={sensibilidad}
          onChange={(e) => {
            setSensibilidad(e.target.value);
            ctrl.current?.setSensibilidadSalto(e.target.value);
          }}
          style={{ flex: 1, fontSize: '0.66rem', borderRadius: 5, padding: '1px 2px' }}
        >
          <option value="alta">muy sensible</option>
          <option value="normal">normal</option>
          <option value="baja">hay que saltar alto</option>
        </select>
      </label>
      <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.6rem', marginTop: 4, lineHeight: 1.3, textAlign: 'center' }}>
        {modoDir === 'brazos'
          ? 'Brazo derecho estirado → derecha · izquierdo → izquierda · brazos abajo → quieto · salta de verdad para saltar'
          : 'Gira la cabeza para andar · salta de verdad para saltar'}
      </div>
    </div>
  );
}
