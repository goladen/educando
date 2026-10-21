import React, { useEffect, useRef, useState } from 'react';

// Pizarra pequeña de borrador para escribir debajo de un ejercicio.
// Ocupa todo el ancho del contenedor y una altura baja. El lienzo es transparente
// sobre una cuadrícula CSS, así la goma no borra la cuadrícula.
const COLORES = ['#0f172a', '#2563eb', '#dc2626', '#16a34a'];

export function BotonLapiz({ abierta, onClick, style }) {
  return (
    <button type="button" onClick={onClick} title={abierta ? 'Ocultar pizarra' : 'Abrir pizarra para hacer cuentas'}
      style={{ width: 34, height: 34, borderRadius: 10, border: `2px solid ${abierta ? '#6366f1' : '#cbd5e1'}`, background: abierta ? '#eef2ff' : 'white',
        cursor: 'pointer', fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, flexShrink: 0, ...style }}>
      ✏️
    </button>
  );
}

export default function PizarraEjercicio({ altura = 150 }) {
  const wrapRef = useRef(null);
  const canvasRef = useRef(null);
  const dibujando = useRef(null); // { x, y } último punto
  const [color, setColor] = useState(COLORES[0]);
  const [goma, setGoma] = useState(false);
  const [grosor, setGrosor] = useState(3);

  // Ajusta el lienzo al ancho del contenedor conservando lo dibujado
  useEffect(() => {
    const wrap = wrapRef.current, cv = canvasRef.current;
    if (!wrap || !cv) return undefined;
    const ajustar = () => {
      const dpr = window.devicePixelRatio || 1;
      const w = Math.max(1, Math.round(wrap.clientWidth));
      if (cv.width === Math.round(w * dpr) && cv.height === Math.round(altura * dpr)) return;
      const copia = document.createElement('canvas');
      copia.width = cv.width; copia.height = cv.height;
      if (cv.width && cv.height) copia.getContext('2d').drawImage(cv, 0, 0);
      cv.width = Math.round(w * dpr); cv.height = Math.round(altura * dpr);
      cv.style.width = `${w}px`; cv.style.height = `${altura}px`;
      const ctx = cv.getContext('2d');
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      if (copia.width && copia.height) ctx.drawImage(copia, 0, 0);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    ajustar();
    const ro = new ResizeObserver(ajustar);
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [altura]);

  const punto = (e) => {
    const r = canvasRef.current.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const trazo = (a, b, presion = 0.5) => {
    const ctx = canvasRef.current.getContext('2d');
    ctx.globalCompositeOperation = goma ? 'destination-out' : 'source-over';
    ctx.strokeStyle = color;
    ctx.lineWidth = goma ? 22 : grosor * (0.6 + presion * 0.8);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
  };

  const onDown = (e) => {
    e.preventDefault();
    canvasRef.current.setPointerCapture?.(e.pointerId);
    const p = punto(e);
    dibujando.current = p;
    trazo(p, { x: p.x + 0.01, y: p.y }, e.pressure || 0.5);
  };
  const onMove = (e) => {
    if (!dibujando.current) return;
    e.preventDefault();
    const p = punto(e);
    trazo(dibujando.current, p, e.pressure || 0.5);
    dibujando.current = p;
  };
  const onUp = () => { dibujando.current = null; };

  const borrarTodo = () => {
    const cv = canvasRef.current;
    const ctx = cv.getContext('2d');
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, cv.width, cv.height); ctx.restore();
  };

  const btn = (activo) => ({ height: 26, minWidth: 26, borderRadius: 7, border: `2px solid ${activo ? '#6366f1' : '#e2e8f0'}`, background: activo ? '#eef2ff' : 'white',
    cursor: 'pointer', fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 6px', color: '#334155' });

  return (
    <div style={{ width: '100%', marginTop: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
        {COLORES.map((c) => (
          <button key={c} type="button" onClick={() => { setColor(c); setGoma(false); }} title="Color"
            style={{ width: 22, height: 22, borderRadius: '50%', background: c, cursor: 'pointer', padding: 0,
              border: !goma && color === c ? '3px solid #a5b4fc' : '2px solid white', boxShadow: '0 0 0 1px #cbd5e1' }} />
        ))}
        <span style={{ width: 1, height: 20, background: '#e2e8f0', margin: '0 2px' }} />
        {[2, 3, 5].map((g) => (
          <button key={g} type="button" onClick={() => { setGrosor(g); setGoma(false); }} title="Grosor" style={btn(!goma && grosor === g)}>
            <span style={{ width: g * 2, height: g * 2, borderRadius: '50%', background: '#334155' }} />
          </button>
        ))}
        <button type="button" onClick={() => setGoma((v) => !v)} title="Goma" style={btn(goma)}>🧽 Goma</button>
        <button type="button" onClick={borrarTodo} title="Borrar todo" style={btn(false)}>🗑️ Borrar</button>
      </div>
      <div ref={wrapRef} style={{ width: '100%', height: altura + 4, borderRadius: 10, border: '2px solid #cbd5e1', overflow: 'hidden', boxSizing: 'border-box',
        backgroundColor: '#fffef7', backgroundImage: 'linear-gradient(#e0e7ff 1px, transparent 1px), linear-gradient(90deg, #e0e7ff 1px, transparent 1px)', backgroundSize: '20px 20px' }}>
        <canvas ref={canvasRef} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} onPointerLeave={onUp}
          style={{ display: 'block', touchAction: 'none', cursor: goma ? 'cell' : 'crosshair' }} />
      </div>
    </div>
  );
}
