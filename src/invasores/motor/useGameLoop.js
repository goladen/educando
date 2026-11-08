// Bucle de juego compartido por las dos variantes: requestAnimationFrame + dt, ejecuta el motor
// de cada jugador, entrega los eventos al reducer y fuerza el repintado de los sprites.
import { useEffect, useState } from 'react';

export function useGameLoop({ activo, varianteRef, mundosRef, inputsRef, jugadoresRef, ctxDe, onEventos, onMundo }) {
  const [, setFrame] = useState(0);

  useEffect(() => {
    if (!activo) return undefined;
    let raf = 0;
    let prev = performance.now();
    const tick = (t) => {
      const dt = Math.min((t - prev) / 1000, 0.05); // tope: si la pestaña estuvo oculta no hay saltos
      prev = t;
      const variante = varianteRef.current;
      for (const j of jugadoresRef.current) {
        if (j.eliminado) continue;
        const ctx = ctxDe(j);
        const anterior = mundosRef.current[j.id];
        if (!anterior) continue;
        const { mundo, eventos } = variante.step(anterior, dt, inputsRef.current[j.id], j, ctx);
        mundosRef.current[j.id] = mundo;
        onMundo?.(j.id, mundo, anterior);
        if (eventos.length) onEventos(j.id, eventos, ctx.pregunta);
      }
      setFrame((f) => (f + 1) % 1000000);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activo]);
}
