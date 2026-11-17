// Retos de la web (Sudoku, Conecta los puntos, El juego de las luces, MathLe) para la pestaña de juegos de
// Pizarras verticales (JuegosMagia.jsx). Se abren a pantalla completa con React.lazy (no se cargan hasta elegirlos).
import React, { lazy, Suspense, useEffect } from 'react';

const Retos = lazy(() => import('../Retos'));
const MathWordleGame = lazy(() => import('../MathWordleGame'));

export const RETOS_WEB = [
    {
        id: 'SUDOKU', emoji: '🔢', nombre: 'Sudoku', color: '#2563eb',
        desc: 'Cuadrículas de varios tamaños y dificultades.',
        aula: 'Pide que expliquen en la pizarra por qué una casilla solo puede llevar un número (descarte por fila, columna y caja).',
    },
    {
        id: 'CONECTA', emoji: '🔗', nombre: 'Conecta los puntos', color: '#16a34a',
        desc: 'Une las parejas del mismo color sin cruzar caminos y llenando el tablero.',
        aula: 'Buen arranque: empezad por los puntos de las esquinas y los bordes, que tienen menos caminos posibles.',
    },
    {
        id: 'SWITCHON', emoji: '💡', nombre: 'El juego de las luces', color: '#f59e0b',
        desc: 'Cada interruptor cambia varias luces: enciéndelas todas.',
        aula: 'Pregunta: ¿importa el orden en que se pulsan? ¿Sirve de algo pulsar dos veces el mismo? (No: cada pulsación se «deshace» con otra).',
    },
    {
        id: 'MATHLE', emoji: '🟩', nombre: 'MathLe', color: '#1565c0',
        desc: 'Adivina la operación oculta con las pistas de colores (como Wordle, con números).',
        aula: 'Que cada grupo anote qué deduce de cada intento: cifras que sobran, cifras que faltan y por qué no puede ser otra.',
    },
];

const btn = (bg, color = 'white', extra = {}) => ({
    background: bg, color, border: 'none', borderRadius: 10, padding: '9px 14px', fontWeight: 700,
    cursor: 'pointer', fontSize: '0.88rem', fontFamily: 'inherit', ...extra,
});

export function PantallaJuego({ id, usuario, onClose }) {
    useEffect(() => {
        const prev = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = prev; };
    }, []);
    return (
        // zIndex por encima de Pizarras verticales (9999). Crea su propio contexto de apilamiento,
        // así que los «position: fixed» internos de los juegos quedan dentro de esta capa.
        <div style={{ position: 'fixed', inset: 0, zIndex: 10040, background: '#0f141d', overflowY: 'auto' }}>
            <Suspense fallback={<div style={{ color: 'white', padding: 40, textAlign: 'center', fontFamily: 'system-ui' }}>Cargando…</div>}>
                {id === 'MATHLE'
                    ? <MathWordleGame usuario={usuario} onExit={onClose} />
                    : <Retos initialGame={id} usuario={usuario} onExit={onClose} />}
            </Suspense>
            <button onClick={onClose} style={btn('rgba(239,68,68,0.92)', 'white', { position: 'fixed', left: 12, bottom: 12, zIndex: 20000, boxShadow: '0 4px 12px rgba(0,0,0,0.35)' })}>✕ Volver a Pizarras</button>
        </div>
    );
}
