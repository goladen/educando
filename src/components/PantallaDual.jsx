// ════════════════════════════════════════════════════════════════════════════
//  Pantalla dual para monitores interactivos: dos apps independientes, una por mitad,
//  que dos alumnos pueden usar A LA VEZ.
//
//  El navegador está pensado para un solo usuario, y eso rompe el uso simultáneo:
//   · Con dos dedos a la vez Chrome cree que es un gesto (pellizco / dos dedos) y no
//     genera el «click» → cada mitad sigue sus toques por pointerId y genera su propio click.
//   · Solo hay UN foco en la página: escribir en un lado le quita la casilla al otro (y el
//     teclado de Windows escribe en la última tocada) → al tocar una casilla NO se enfoca:
//     se abre un teclado táctil en esa mitad que escribe directamente en ella.
//   · El desplegable nativo (<select>) es una ventana del sistema, una sola a la vez →
//     sus opciones salen como botones en el panel de esa mitad.
//  Con ratón todo funciona como siempre (solo se tocan los eventos táctiles y de lápiz).
// ════════════════════════════════════════════════════════════════════════════
import React, { useCallback, useEffect, useRef, useState } from 'react';

const NO_TEXTO = new Set(['checkbox', 'radio', 'button', 'submit', 'reset', 'range', 'color', 'file', 'image', 'hidden']);
function campoDe(el) {
    const c = el?.closest?.('input, textarea, select');
    if (!c || c.disabled || c.readOnly) return null;
    if (c.tagName === 'INPUT' && NO_TEXTO.has((c.type || '').toLowerCase())) return null;
    return c;
}

// Cambiar el valor de forma que React lo vea (setter nativo + evento)
function ponerValor(el, valor) {
    const proto = el.tagName === 'SELECT' ? HTMLSelectElement.prototype
        : el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, valor);
    el.dispatchEvent(new Event(el.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }));
}

const FILAS_NUM = [
    ['7', '8', '9', '⌫'],
    ['4', '5', '6', 'x'],
    ['1', '2', '3', '^'],
    ['−', '0', ',', '+'],
    ['(', ')', '/', 'ABC'],
];
const FILAS_ABC = [
    ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
    ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', 'Ñ'],
    ['Z', 'X', 'C', 'V', 'B', 'N', 'M', '⌫'],
    ['123', '␣'],
];

/** Panel táctil de una mitad: teclado (casillas) u opciones (desplegables). */
function PanelCampo({ campo, onCerrar, color }) {
    const [abc, setAbc] = useState(false);
    const [, refrescar] = useState(0);
    const esSelect = campo.tagName === 'SELECT';
    const esNumero = campo.type === 'number';

    const pulsar = (k) => {
        if (!campo.isConnected) { onCerrar(); return; }
        if (k === 'ABC') { setAbc(true); return; }
        if (k === '123') { setAbc(false); return; }
        const v = String(campo.value ?? '');
        let nuevo;
        if (k === '⌫') nuevo = v.slice(0, -1);
        else if (k === 'C') nuevo = '';
        else {
            let ch = k === '␣' ? ' ' : k === '−' ? '-' : k;
            if (esNumero) {
                if (ch === ',') ch = '.';
                if (!/^[0-9.-]$/.test(ch)) return; // una casilla numérica no admite letras
                // − funciona como ± de calculadora
                nuevo = ch === '-' ? (v.startsWith('-') ? v.slice(1) : `-${v}`) : v + ch;
            } else {
                // letras: mayúscula al empezar una palabra (nombres), minúscula después
                if (abc && /\p{L}/u.test(ch) && v !== '' && !v.endsWith(' ')) ch = ch.toLowerCase();
                nuevo = v + ch;
            }
        }
        ponerValor(campo, nuevo);
        refrescar((n) => n + 1);
    };
    const intro = () => {
        if (campo.isConnected) {
            campo.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true }));
        }
        onCerrar();
    };
    // onPointerDown (no onClick): cada tecla responde a su dedo aunque el otro lado esté tocando
    const tecla = (k, extra = {}) => ({
        key: k,
        onPointerDown: (e) => { e.preventDefault(); e.stopPropagation(); pulsar(k); },
        style: {
            flex: k === '␣' ? 4 : 1, minWidth: 0, minHeight: 46, borderRadius: 9, border: '1px solid #30363d',
            background: ['⌫', 'ABC', '123'].includes(k) ? '#21262d' : '#0d1117', color: '#e6edf3',
            fontSize: abc ? '1rem' : '1.25rem', fontWeight: 700, cursor: 'pointer', touchAction: 'none', userSelect: 'none', ...extra,
        },
    });

    return (
        <div onPointerDown={(e) => e.stopPropagation()}
            style={{ flexShrink: 0, background: '#161b22', borderTop: `3px solid ${color}`, padding: 8, display: 'flex', flexDirection: 'column', gap: 6, touchAction: 'none', userSelect: 'none' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ flex: 1, minWidth: 0, fontSize: '0.8rem', color: '#8b949e', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {esSelect ? '☰ Elige una opción' : <>⌨️ Escribiendo: <b style={{ color: '#e6edf3', fontFamily: 'monospace', fontSize: '1rem' }}>{campo.value || '…'}</b></>}
                </span>
                {!esSelect && <button type="button" {...tecla('C', { flex: 'none', minHeight: 38, padding: '0 12px', fontSize: '0.85rem' })}>Borrar</button>}
                <button type="button" onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); esSelect ? onCerrar() : intro(); }}
                    style={{ minHeight: 38, padding: '0 14px', borderRadius: 9, border: 'none', background: color, color: '#fff', fontWeight: 800, cursor: 'pointer', touchAction: 'none' }}>
                    {esSelect ? '✕' : '✓ Listo'}
                </button>
            </div>
            {esSelect ? (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, maxHeight: '38vh', overflowY: 'auto' }}>
                    {Array.from(campo.options).filter((o) => !o.disabled).map((o) => (
                        <button key={o.value + o.text} type="button"
                            onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); if (campo.isConnected) ponerValor(campo, o.value); onCerrar(); }}
                            style={{ minHeight: 44, padding: '0 14px', borderRadius: 9, border: `2px solid ${campo.value === o.value ? color : '#30363d'}`, background: campo.value === o.value ? `${color}33` : '#0d1117', color: '#e6edf3', fontSize: '0.95rem', fontWeight: 700, cursor: 'pointer', touchAction: 'none' }}>
                            {o.text || '—'}
                        </button>
                    ))}
                </div>
            ) : (abc ? FILAS_ABC : FILAS_NUM).map((fila, i) => (
                <div key={i} style={{ display: 'flex', gap: 6 }}>
                    {fila.map((k) => <button type="button" {...tecla(k)}>{k === '␣' ? 'espacio' : k}</button>)}
                </div>
            ))}
        </div>
    );
}

/**
 * Una mitad. Lleva transform para que los `position: fixed` de dentro (modales) se queden en
 * ella; el contenido se desplaza en una capa interior y el teclado queda fijo abajo.
 */
function Mitad({ children, color }) {
    const toques = useRef(new Map());   // pointerId → { x, y, t, target }
    const generados = useRef([]);       // clicks generados (para no duplicar el click nativo)
    const [activo, setActivo] = useState(null); // { el, n }: n reinicia el teclado al cambiar de casilla
    const campo = activo?.el || null;
    const setCampo = useCallback((el) => setActivo((a) => (el ? { el, n: (a?.n || 0) + 1 } : null)), []);

    // Resalta la casilla activa de esta mitad
    useEffect(() => {
        if (!campo) return undefined;
        const prev = { outline: campo.style.outline, offset: campo.style.outlineOffset };
        campo.style.outline = `3px solid ${color}`;
        campo.style.outlineOffset = '2px';
        // si la casilla desaparece (cambia el ejercicio), se cierra el teclado
        const id = setInterval(() => { if (!campo.isConnected || campo.disabled) setCampo(null); }, 400);
        return () => { clearInterval(id); campo.style.outline = prev.outline; campo.style.outlineOffset = prev.offset; };
    }, [campo, color, setCampo]);

    const onPointerDownCapture = useCallback((e) => {
        if (e.pointerType === 'mouse') return;
        toques.current.set(e.pointerId, { x: e.clientX, y: e.clientY, t: Date.now(), target: e.target });
        // Sin foco nativo en las casillas (se escribe con el teclado de esta mitad)
        if (campoDe(e.target)) e.preventDefault();
    }, []);

    const onPointerUpCapture = useCallback((e) => {
        if (e.pointerType === 'mouse') return;
        const d = toques.current.get(e.pointerId);
        toques.current.delete(e.pointerId);
        if (!d || Math.hypot(e.clientX - d.x, e.clientY - d.y) > 14 || Date.now() - d.t > 900) return; // arrastre o pulsación larga
        const c = campoDe(d.target);
        if (c) {
            if (document.activeElement === c) c.blur();
            setCampo(c);
            return;
        }
        const ahora = Date.now();
        generados.current = generados.current.filter((g) => ahora - g.t < 1200);
        generados.current.push({ x: e.clientX, y: e.clientY, t: ahora });
        if (!d.target.isConnected) return;
        d.target.dispatchEvent(new MouseEvent('click', {
            bubbles: true, cancelable: true, view: window, clientX: e.clientX, clientY: e.clientY, button: 0,
        }));
    }, [setCampo]);

    const onPointerCancelCapture = useCallback((e) => { toques.current.delete(e.pointerId); }, []);

    // El click nativo que llega después de un toque ya atendido se descarta (si no, contaría doble)
    const onClickCapture = useCallback((e) => {
        if (!e.nativeEvent.isTrusted) return;
        // Chrome/Edge dicen de dónde viene el click: el táctil ya se atendió en pointerup; el de ratón pasa
        const tipo = e.nativeEvent.pointerType;
        if (tipo === 'mouse') return;
        if (tipo === 'touch' || tipo === 'pen') { e.preventDefault(); e.stopPropagation(); return; }
        // Navegadores sin pointerType en el click: se descarta el que coincide con un toque reciente
        const ahora = Date.now();
        const dup = generados.current.find((g) => ahora - g.t < 1200 && Math.hypot(e.clientX - g.x, e.clientY - g.y) < 40);
        if (dup) {
            generados.current = generados.current.filter((g) => g !== dup);
            e.preventDefault();
            e.stopPropagation();
        }
    }, []);

    return (
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative', transform: 'translateZ(0)' }}
            onPointerDownCapture={onPointerDownCapture} onPointerUpCapture={onPointerUpCapture}
            onPointerCancelCapture={onPointerCancelCapture} onClickCapture={onClickCapture}>
            {/* pan-y: se puede desplazar con un dedo, pero sin pellizco ni gestos de dos dedos */}
            <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden', touchAction: 'pan-y', overscrollBehavior: 'contain' }}>
                {children}
            </div>
            {campo && <PanelCampo key={activo.n} campo={campo} color={color} onCerrar={() => setCampo(null)} />}
        </div>
    );
}

/**
 * render(lado, { salir, pantallaCompleta }) → contenido de cada mitad.
 * onSalir: volver a una sola pantalla.
 */
export default function PantallaDual({ render, onSalir, colores = ['#9b59b6', '#3498db'] }) {
    const ref = useRef(null);
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

    return (
        <div ref={ref} style={{ position: 'fixed', inset: 0, zIndex: 5000, display: 'flex', background: '#0d1117', touchAction: 'pan-y' }}>
            {['Izquierda', 'Derecha'].map((lado, i) => (
                <React.Fragment key={lado}>
                    {i === 1 && <div aria-hidden="true" style={{ width: 6, flexShrink: 0, background: `linear-gradient(${colores[0]},${colores[1]},${colores[0]})` }} />}
                    <Mitad color={colores[i]}>{render(lado, { salir, pantallaCompleta })}</Mitad>
                </React.Fragment>
            ))}
        </div>
    );
}

/** ¿Merece la pena ofrecer la pantalla dual? (pantallas anchas: pizarra / monitor interactivo) */
export const dualDisponible = () => typeof window !== 'undefined' && window.innerWidth >= 1000;
