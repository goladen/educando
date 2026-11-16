// ════════════════════════════════════════════════════════════════════════════
//  Juego en pantalla dual (Pasapalabra, Burbujas/Test y Pikatron) para el monitor interactivo:
//  el mismo recurso abierto DOS veces, una en cada mitad, cada una con su propia configuración
//  (hoja, modo, juego) y su propia partida.
//
//  Cada mitad es un <iframe> de la propia web (/?r=ID&m=MODO&dual=0|1) → su propia ventana:
//  sus 100vw/100vh, su teclado (window.keydown de Pikatron), sus temporizadores, sonidos y modales.
//  Así lo que pasa en un lado no afecta al otro.
//  Dentro del iframe, App monta el juego en <MarcoMitadDual>, que reutiliza la Mitad de
//  PantallaDual: con dos dedos a la vez (uno en cada lado) Chrome no genera «click», y solo hay
//  un foco de teclado en toda la página → cada mitad genera sus clicks y tiene su teclado táctil.
//
//  El recurso pasa al iframe por window.__piktDual (mismo origen): llega tal cual se abrió
//  (hojas filtradas, orden de una ficha…), sin volver a leerlo de Firestore.
// ════════════════════════════════════════════════════════════════════════════
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Mitad, dualDisponible } from './PantallaDual';

const LADOS = ['Izquierda', 'Derecha'];
const COLORES = ['#9b59b6', '#3498db'];

/** ¿Esta página es una de las dos mitades de un juego dual? */
export const esMitadDual = () => {
    try { return new URLSearchParams(window.location.search).has('dual'); } catch { return false; }
};

/** Recurso que la ventana principal deja a sus dos mitades (copia: otro «realm»). */
export function recursoDeVentanaDual() {
    try {
        if (window.parent === window) return null;
        const r = window.parent.__piktDual?.recurso;
        return r ? JSON.parse(JSON.stringify(r)) : null;
    } catch { return null; }
}

// Juegos que se pueden elegir en cada mitad según el tipo de recurso (valor de m= en la URL)
function juegosDe(recurso) {
    if (recurso?.tipoJuego === 'PASAPALABRA') return [{ id: 'PASAPALABRA', label: '🔤 Pasapalabra' }];
    return [{ id: 'BURBUJAS', label: '🫧 Burbujas / Test' }, { id: 'PIKATRON', label: '🚀 Pikatron' }];
}

function urlMitad(recurso, modo, i, version) {
    const p = new URLSearchParams();
    p.set('r', recurso.id || 'dual');
    if (modo && modo !== 'PASAPALABRA') p.set('m', modo);
    p.set('dual', String(i));
    p.set('v', String(version)); // cambia al reiniciar → el iframe se carga de nuevo
    return `${window.location.origin}/?${p.toString()}`;
}

// Botones de la barra: responden en pointerdown (con dos dedos a la vez no llega el click)
function BotonBarra({ onPulsar, children, title, activo, color = '#30363d' }) {
    return (
        <button type="button" title={title}
            onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); onPulsar(); }}
            style={{
                padding: '4px 10px', borderRadius: 8, cursor: 'pointer', fontWeight: 700, fontSize: '0.8rem',
                border: `1px solid ${activo ? color : '#30363d'}`, background: activo ? `${color}44` : '#0d1117',
                color: activo ? '#fff' : '#c9d1d9', whiteSpace: 'nowrap', touchAction: 'none', userSelect: 'none',
            }}>
            {children}
        </button>
    );
}

/** Capa a pantalla completa con las dos mitades. */
export default function JuegoDual({ recurso, modoInicial, onSalir }) {
    const ref = useRef(null);
    const juegos = juegosDe(recurso);
    const modo0 = juegos.some((j) => j.id === modoInicial) ? modoInicial : juegos[0].id;
    const [lados, setLados] = useState(() => [{ modo: modo0, v: 0 }, { modo: modo0, v: 0 }]);
    const [completa, setCompleta] = useState(false);

    // El recurso para las dos mitades, antes de que se carguen los iframes
    useState(() => { window.__piktDual = { recurso }; });
    useEffect(() => {
        window.__piktDual = { recurso };
        return () => { if (window.__piktDual?.recurso === recurso) delete window.__piktDual; };
    }, [recurso]);

    useEffect(() => {
        const alCambiar = () => setCompleta(!!document.fullscreenElement);
        document.addEventListener('fullscreenchange', alCambiar);
        return () => document.removeEventListener('fullscreenchange', alCambiar);
    }, []);

    const pantallaCompleta = useCallback(() => {
        try {
            if (document.fullscreenElement) document.exitFullscreen?.();
            else ref.current?.requestFullscreen?.();
        } catch { /* sin soporte */ }
    }, []);
    const salir = useCallback(() => {
        try { if (document.fullscreenElement) document.exitFullscreen?.(); } catch { /* nada */ }
        onSalir?.();
    }, [onSalir]);

    const cambiar = (i, cambios) => setLados((ls) => ls.map((l, j) => (j === i ? { ...l, ...cambios, v: l.v + 1 } : l)));

    return createPortal(
        <div ref={ref} style={{ position: 'fixed', inset: 0, zIndex: 2147483000, display: 'flex', background: '#0d1117', fontFamily: "'Segoe UI', sans-serif" }}>
            {LADOS.map((lado, i) => (
                <React.Fragment key={lado}>
                    {i === 1 && <div aria-hidden="true" style={{ width: 6, flexShrink: 0, background: `linear-gradient(${COLORES[0]},${COLORES[1]},${COLORES[0]})` }} />}
                    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 8px', background: '#161b22', borderBottom: `3px solid ${COLORES[i]}`, flexWrap: 'wrap' }}>
                            {i === 0 && <BotonBarra onPulsar={salir} title="Cerrar las dos mitades y volver a una sola pantalla">⇤ 1 pantalla</BotonBarra>}
                            <span style={{ color: COLORES[i], fontWeight: 800, fontSize: '0.8rem', marginRight: 4 }}>{i === 0 ? '◧' : '◨'} {lado}</span>
                            {juegos.length > 1 && juegos.map((j) => (
                                <BotonBarra key={j.id} activo={lados[i].modo === j.id} color={COLORES[i]}
                                    title={`Jugar a ${j.label} en este lado`}
                                    onPulsar={() => { if (lados[i].modo !== j.id) cambiar(i, { modo: j.id }); }}>
                                    {j.label}
                                </BotonBarra>
                            ))}
                            <span style={{ flex: 1 }} />
                            <BotonBarra onPulsar={() => cambiar(i, {})} title="Empezar de nuevo solo en este lado">↻ Reiniciar</BotonBarra>
                            {i === 1 && <BotonBarra onPulsar={pantallaCompleta} title="Pantalla completa (las dos mitades)">{completa ? '⤡ Salir' : '⛶ Completa'}</BotonBarra>}
                        </div>
                        <iframe
                            key={`${lados[i].modo}-${lados[i].v}`}
                            src={urlMitad(recurso, lados[i].modo, i, lados[i].v)}
                            title={`${lado}: ${juegos.find((j) => j.id === lados[i].modo)?.label || 'juego'}`}
                            allow="autoplay; clipboard-write; serial"
                            style={{ flex: 1, minHeight: 0, width: '100%', border: 'none', background: '#1e272e', display: 'block' }}
                        />
                    </div>
                </React.Fragment>
            ))}
        </div>,
        document.body,
    );
}

/**
 * Botón «◧◨ Pantalla dual» para las pantallas de inicio de los juegos.
 * No sale dentro de una mitad, en pantallas estrechas ni sin recurso.
 */
export function BotonPantallaDual({ recurso, modo, style }) {
    const [abierto, setAbierto] = useState(false);
    if (!recurso || esMitadDual() || !dualDisponible()) return null;
    return (
        <>
            <button type="button" onClick={() => setAbierto(true)}
                title="Divide la pantalla en dos: cada lado juega su propia partida con su configuración (monitor interactivo)"
                style={{
                    width: '100%', padding: '11px', marginBottom: '12px', borderRadius: '30px', cursor: 'pointer',
                    border: '1.5px solid #9b59b6', background: 'rgba(155,89,182,0.18)', color: '#e8d5f2',
                    fontWeight: 700, fontSize: '0.95rem', ...style,
                }}>
                ◧◨ Pantalla dual (2 a la vez)
            </button>
            {abierto && <JuegoDual recurso={recurso} modoInicial={modo} onSalir={() => setAbierto(false)} />}
        </>
    );
}

/** Dentro del iframe: el juego ocupa la mitad con sus toques y su teclado táctil. */
export function MarcoMitadDual({ lado, children }) {
    const i = String(lado) === '1' ? 1 : 0;
    // Sin barras de desplazamiento de la página: el desplazamiento lo lleva la mitad
    useEffect(() => {
        document.documentElement.style.overflow = 'hidden';
        document.body.style.overflow = 'hidden';
    }, []);
    return (
        <div style={{ position: 'fixed', inset: 0, display: 'flex', background: '#1e272e' }}>
            <Mitad color={COLORES[i]} tecladoInicial="abc" abrirAlEnfocar>{children}</Mitad>
        </div>
    );
}
