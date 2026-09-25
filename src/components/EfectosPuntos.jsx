import React, { useState, useCallback, useRef, useEffect } from 'react';

/* =====================================================================
 *  EFECTOS DE PUNTUACIÓN
 *  Capa de partículas que estalla donde se pulsa al sumar o restar puntos.
 *  Estilos: EXPLOSION (chispas + destello), CORAZONES, RAYOS y MIX (al azar).
 *  Todo es CSS: sin librerías, sin canvas y sin coste cuando no hay efectos.
 *
 *  Uso:
 *     const efx = useEfectosPuntos();
 *     efx.lanzar(x, y, { ok: true, texto: '+$200', estilo: 'MIX' });
 *     <CapaEfectos efectos={efx.efectos} />
 * ===================================================================== */

export const ESTILOS_EFECTO = [
    { id: 'MIX', label: '🎁 Sorpresa (al azar)' },
    { id: 'EXPLOSION', label: '💥 Explosión' },
    { id: 'CORAZONES', label: '❤️ Corazones' },
    { id: 'RAYOS', label: '⚡ Rayos' },
    { id: 'NINGUNO', label: '🚫 Sin efectos' },
];

const DURACION = 1400;   // ms que vive cada estallido

const COLORES_OK = ['#f5c518', '#2ecc71', '#4dd0e1', '#ffffff', '#ff9f43'];
const COLORES_MAL = ['#e74c3c', '#7f8c8d', '#c0392b', '#95a5a6'];
const CORAZONES = ['❤️', '💖', '💗', '💛', '💚', '💙'];

const aleatorio = (a, b) => a + Math.random() * (b - a);

/** Genera las partículas de un estallido concreto. */
function crearParticulas(estilo, ok) {
    const paleta = ok ? COLORES_OK : COLORES_MAL;

    if (!ok) {
        // Fallo: pequeña nube gris que cae, sin fuegos artificiales.
        return Array.from({ length: 9 }, () => ({
            clase: 'efxParticula',
            contenido: null,
            color: paleta[Math.floor(Math.random() * paleta.length)],
            tam: aleatorio(6, 11),
            dx: aleatorio(-55, 55),
            dy: aleatorio(10, 70),
            rot: 0,
            ang: 0,
            delay: aleatorio(0, 120),
        }));
    }

    if (estilo === 'CORAZONES') {
        return Array.from({ length: 12 }, () => ({
            clase: 'efxCorazon',
            contenido: CORAZONES[Math.floor(Math.random() * CORAZONES.length)],
            color: null,
            tam: aleatorio(18, 34),
            dx: aleatorio(-90, 90),
            dy: aleatorio(-150, -70),
            rot: aleatorio(-40, 40),
            ang: 0,
            delay: aleatorio(0, 260),
        }));
    }

    if (estilo === 'RAYOS') {
        const rayos = Array.from({ length: 10 }, (_, i) => ({
            clase: 'efxRayo',
            contenido: null,
            color: i % 2 ? '#ffffff' : '#f5c518',
            tam: aleatorio(52, 96),
            dx: 0, dy: 0, rot: 0,
            ang: (360 / 10) * i + aleatorio(-9, 9),
            delay: aleatorio(0, 110),
        }));
        const chispas = Array.from({ length: 6 }, () => ({
            clase: 'efxCorazon',
            contenido: '⚡',
            color: null,
            tam: aleatorio(16, 28),
            dx: aleatorio(-80, 80),
            dy: aleatorio(-120, -50),
            rot: aleatorio(-30, 30),
            ang: 0,
            delay: aleatorio(60, 300),
        }));
        return [...rayos, ...chispas];
    }

    // EXPLOSION (por defecto)
    return Array.from({ length: 22 }, () => {
        const a = Math.random() * Math.PI * 2;
        const d = aleatorio(55, 145);
        return {
            clase: 'efxParticula',
            contenido: null,
            color: paleta[Math.floor(Math.random() * paleta.length)],
            tam: aleatorio(5, 12),
            dx: Math.cos(a) * d,
            dy: Math.sin(a) * d - 20,
            rot: 0,
            ang: 0,
            delay: aleatorio(0, 90),
        };
    });
}

/** Hook que gestiona la cola de estallidos y los limpia solos. */
export function useEfectosPuntos() {
    const [efectos, setEfectos] = useState([]);
    const temporizadores = useRef([]);

    useEffect(() => () => temporizadores.current.forEach(clearTimeout), []);

    const lanzar = useCallback((x, y, { ok = true, texto = '', estilo = 'MIX' } = {}) => {
        if (estilo === 'NINGUNO') return;
        const real = estilo === 'MIX'
            ? ['EXPLOSION', 'CORAZONES', 'RAYOS'][Math.floor(Math.random() * 3)]
            : estilo;
        const id = Date.now() + Math.random();
        const efecto = {
            id, x, y, ok, texto, estilo: real,
            particulas: crearParticulas(real, ok),
        };
        setEfectos(es => [...es, efecto]);
        const t = setTimeout(() => setEfectos(es => es.filter(e => e.id !== id)), DURACION);
        temporizadores.current.push(t);
    }, []);

    /** Atajo: lanza el efecto centrado en el elemento que se ha pulsado. */
    const lanzarDesdeEvento = useCallback((ev, opciones) => {
        let x = window.innerWidth / 2, y = window.innerHeight / 2;
        const el = ev?.currentTarget;
        if (el && el.getBoundingClientRect) {
            const r = el.getBoundingClientRect();
            x = r.left + r.width / 2;
            y = r.top + r.height / 2;
        }
        lanzar(x, y, opciones);
    }, [lanzar]);

    return { efectos, lanzar, lanzarDesdeEvento };
}

/** Capa visual. No intercepta clics: se puede montar encima de todo. */
export function CapaEfectos({ efectos, zIndex = 10050 }) {
    if (!efectos.length) return null;

    return (
        <div style={{ position: 'fixed', inset: 0, zIndex, pointerEvents: 'none', overflow: 'hidden' }}>
            {efectos.map(e => (
                <div key={e.id} style={{ position: 'absolute', left: e.x, top: e.y, width: 0, height: 0 }}>

                    {/* Destello y anillo de choque (solo al sumar) */}
                    {e.ok && (
                        <>
                            <span style={{
                                position: 'absolute', left: -45, top: -45, width: 90, height: 90, borderRadius: '50%',
                                background: e.estilo === 'CORAZONES'
                                    ? 'radial-gradient(circle, rgba(255,120,180,0.85), rgba(255,120,180,0) 70%)'
                                    : 'radial-gradient(circle, rgba(255,255,255,0.9), rgba(245,197,24,0) 70%)',
                                animation: `efxDestello ${DURACION * 0.45}ms ease-out forwards`,
                            }} />
                            <span style={{
                                position: 'absolute', left: -30, top: -30, width: 60, height: 60, borderRadius: '50%',
                                border: `3px solid ${e.estilo === 'CORAZONES' ? '#ff6b9d' : '#f5c518'}`,
                                animation: `efxAnillo ${DURACION * 0.6}ms cubic-bezier(0.2,0.8,0.3,1) forwards`,
                            }} />
                        </>
                    )}

                    {/* Partículas */}
                    {e.particulas.map((p, i) => {
                        const base = {
                            position: 'absolute',
                            animationDelay: `${p.delay}ms`,
                            animationFillMode: 'forwards',
                            animationTimingFunction: 'cubic-bezier(0.15, 0.7, 0.3, 1)',
                        };

                        if (p.clase === 'efxRayo') {
                            return (
                                <span key={i} style={{
                                    ...base,
                                    left: 0, top: -2, width: p.tam, height: 4, borderRadius: 3,
                                    background: `linear-gradient(90deg, ${p.color}, rgba(255,255,255,0))`,
                                    transformOrigin: '0% 50%',
                                    '--ang': `${p.ang}deg`,
                                    animationName: 'efxRayo',
                                    animationDuration: `${DURACION * 0.6}ms`,
                                }} />
                            );
                        }

                        if (p.clase === 'efxCorazon') {
                            return (
                                <span key={i} style={{
                                    ...base,
                                    left: 0, top: 0, fontSize: p.tam, lineHeight: 1,
                                    transform: 'translate(-50%, -50%)',
                                    '--dx': `${p.dx}px`, '--dy': `${p.dy}px`, '--rot': `${p.rot}deg`,
                                    animationName: 'efxCorazon',
                                    animationDuration: `${DURACION}ms`,
                                }}>{p.contenido}</span>
                            );
                        }

                        return (
                            <span key={i} style={{
                                ...base,
                                left: -p.tam / 2, top: -p.tam / 2, width: p.tam, height: p.tam,
                                borderRadius: '50%', background: p.color,
                                boxShadow: e.ok ? `0 0 8px ${p.color}` : 'none',
                                '--dx': `${p.dx}px`, '--dy': `${p.dy}px`,
                                animationName: 'efxParticula',
                                animationDuration: `${DURACION * 0.8}ms`,
                            }} />
                        );
                    })}

                    {/* Puntos ganados / perdidos */}
                    {e.texto && (
                        <span style={{
                            position: 'absolute', left: 0, top: 0, transform: 'translate(-50%, -50%)',
                            whiteSpace: 'nowrap', fontWeight: 900, fontFamily: "'Segoe UI', sans-serif",
                            fontSize: 'clamp(1.3rem, 3.4vw, 2.3rem)',
                            color: e.ok ? '#f5c518' : '#ff6b6b',
                            textShadow: '0 3px 10px rgba(0,0,0,0.75), 0 0 20px rgba(0,0,0,0.5)',
                            animation: `efxTexto ${DURACION}ms cubic-bezier(0.15, 0.85, 0.3, 1) forwards`,
                        }}>{e.texto}</span>
                    )}
                </div>
            ))}

            <style>{`
                @keyframes efxParticula {
                    0%   { transform: translate(0, 0) scale(1); opacity: 1; }
                    100% { transform: translate(var(--dx), var(--dy)) scale(0.15); opacity: 0; }
                }
                @keyframes efxCorazon {
                    0%   { transform: translate(-50%, -50%) scale(0.3); opacity: 0; }
                    18%  { transform: translate(calc(-50% + var(--dx) * 0.18), calc(-50% - 14px)) scale(1.15); opacity: 1; }
                    100% { transform: translate(calc(-50% + var(--dx)), calc(-50% + var(--dy))) scale(0.85) rotate(var(--rot)); opacity: 0; }
                }
                @keyframes efxRayo {
                    0%   { transform: rotate(var(--ang)) scaleX(0); opacity: 0; }
                    30%  { transform: rotate(var(--ang)) scaleX(1); opacity: 1; }
                    100% { transform: rotate(var(--ang)) scaleX(1.6); opacity: 0; }
                }
                @keyframes efxDestello {
                    0%   { transform: scale(0.2); opacity: 0.95; }
                    100% { transform: scale(3); opacity: 0; }
                }
                @keyframes efxAnillo {
                    0%   { transform: scale(0.2); opacity: 0.9; }
                    100% { transform: scale(2.8); opacity: 0; }
                }
                @keyframes efxTexto {
                    0%   { transform: translate(-50%, -50%) scale(0.5); opacity: 0; }
                    22%  { transform: translate(-50%, -80%) scale(1.3); opacity: 1; }
                    100% { transform: translate(-50%, -190%) scale(1); opacity: 0; }
                }
                @media (prefers-reduced-motion: reduce) {
                    @keyframes efxParticula { 0%, 100% { opacity: 0; } }
                    @keyframes efxCorazon   { 0%, 100% { opacity: 0; } }
                    @keyframes efxRayo      { 0%, 100% { opacity: 0; } }
                }
            `}</style>
        </div>
    );
}

export default CapaEfectos;
