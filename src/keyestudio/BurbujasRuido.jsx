// 🫧 Burbujas que reaccionan al ruido (sonómetro por radio): con calma suben despacio y rectas; con
// ruido suben deprisa, tiemblan, se hacen más pequeñas y aparecen más. `nivel` 0-100 y `color` (#rrggbb)
// del semáforo.
import React, { useEffect, useRef } from 'react';

const MAX = 60;

export default function BurbujasRuido({ nivel = 0, color = '#22c55e', alto = 90 }) {
  const lienzo = useRef(null);
  const datos = useRef({ nivel, color });
  datos.current = { nivel, color };

  useEffect(() => {
    const cv = lienzo.current;
    if (!cv) return undefined;
    const g = cv.getContext('2d');
    let w = 0, h = 0, raf = 0, ultimo = performance.now();
    let suave = datos.current.nivel; // el nivel llega a saltos: se suaviza para que no dé tirones
    const burbujas = [];
    const nueva = (abajo) => ({
      x: Math.random() * w, y: abajo ? h + Math.random() * 20 : Math.random() * h,
      r: 2 + Math.random() * 6, fase: Math.random() * 6.28, vel: 0.6 + Math.random() * 0.8,
    });
    const medir = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = cv.clientWidth || 1; h = cv.clientHeight || 1;
      cv.width = w * dpr; cv.height = h * dpr;
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    const ro = new ResizeObserver(medir);
    ro.observe(cv);
    medir();
    const frame = (ahora) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.05, (ahora - ultimo) / 1000); ultimo = ahora;
      suave += (datos.current.nivel - suave) * Math.min(1, dt * 4);
      const a = Math.max(0, Math.min(1, suave / 100)); // agitación 0-1
      const col = datos.current.color;
      const cuantas = Math.round(10 + a * (MAX - 10));
      while (burbujas.length < cuantas) burbujas.push(nueva(burbujas.length > 8));
      if (burbujas.length > cuantas) burbujas.length = cuantas;

      g.clearRect(0, 0, w, h);
      const fondo = g.createLinearGradient(0, 0, 0, h);
      fondo.addColorStop(0, 'rgba(15,23,42,0.2)');
      fondo.addColorStop(1, col + '33');
      g.fillStyle = fondo;
      g.fillRect(0, 0, w, h);

      // Superficie del agua: ola más alta y rápida cuanto más ruido
      g.beginPath();
      g.moveTo(0, 0);
      for (let x = 0; x <= w; x += 6) g.lineTo(x, 4 + Math.sin(x * 0.05 + ahora * (0.002 + a * 0.012)) * (1 + a * 5));
      g.lineTo(w, 0);
      g.fillStyle = 'rgba(2,6,23,0.55)';
      g.fill();

      const subida = 12 + a * a * 150; // px/s
      const vaiven = 1.5 + a * 14;
      const temblor = a > 0.5 ? (a - 0.5) * 6 : 0;
      for (const b of burbujas) {
        b.fase += dt * (1.5 + a * 9);
        b.y -= subida * b.vel * dt;
        const x = b.x + Math.sin(b.fase) * vaiven + (Math.random() - 0.5) * temblor;
        const r = b.r * (1 - a * 0.45);
        if (b.y < -r) Object.assign(b, nueva(true));
        g.beginPath();
        g.arc(x, b.y, r, 0, 6.2832);
        g.fillStyle = col + '40';
        g.fill();
        g.lineWidth = 1.2;
        g.strokeStyle = col + 'cc';
        g.stroke();
        g.beginPath();
        g.arc(x - r * 0.35, b.y - r * 0.35, r * 0.28, 0, 6.2832);
        g.fillStyle = 'rgba(255,255,255,0.7)';
        g.fill();
      }
    };
    raf = requestAnimationFrame(frame);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, []);

  return <canvas ref={lienzo} style={{ display: 'block', width: '100%', height: alto, borderRadius: 10, background: '#020617' }} aria-hidden="true" />;
}
