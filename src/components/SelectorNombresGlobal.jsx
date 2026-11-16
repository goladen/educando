// Selector de nombres GLOBAL (montado una vez en App): si el dispositivo tiene un grupo en uso
// (utils/gruposDispositivo.js), al tocar un campo de «nombre» de cualquier juego (Enviar al profesor,
// rankings, mandos micro:bit…) aparece una lista con los alumnos del grupo para elegir con un toque.
// Rellena también el campo «curso/clase» vacío del mismo formulario con el nombre del grupo.
//
// Detecta los campos por placeholder/etiqueta. Forzar: data-nombres-grupo="si" | "no" en el <input>,
// o data-sin-nombres en un contenedor.
import React, { useEffect, useRef, useState, lazy, Suspense } from 'react';
import { useGruposDispositivo } from '../utils/gruposDispositivo';
import { auth } from '../firebase';

const Gestor = lazy(() => import('./GruposDispositivo'));

const SI = /(\bnombre\b|\bname\b|alumn|apellid|^mando \d+$|jugador)/i;
const NO = /(profe|país|pais|grupo|curso|clase|equipo|sala|proyecto|tema|lista|recurso|t[ií]tulo|circuito|conjunto|columna|autor|buscar|email|correo|ciudad|localidad|archivo|hoja|categor|empresa|producto|del juego|personaje|narraci|tablero|planeta|animal|elemento|palabra|país|c[oó]digo|contraseña|password|comunidad|miembro)/i;

function etiquetaDe(el) {
    const partes = [el.placeholder, el.getAttribute('aria-label'), el.name, el.id];
    try { if (el.labels && el.labels[0]) partes.push(el.labels[0].textContent); } catch { /* */ }
    return partes.filter(Boolean).join(' ').trim();
}

export function esCampoNombre(el) {
    if (!el || el.tagName !== 'INPUT') return false;
    const t = (el.type || 'text').toLowerCase();
    if (!['text', 'search', ''].includes(t) || el.readOnly || el.disabled) return false;
    const forzado = el.dataset?.nombresGrupo;
    if (forzado === 'si') return true;
    if (forzado === 'no' || el.closest('[data-sin-nombres]')) return false;
    const e = etiquetaDe(el);
    return SI.test(e) && !NO.test(e);
}

const ponerValor = (el, v) => {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setter.call(el, v);
    el.dispatchEvent(new Event('input', { bubbles: true }));
};

// Campo «curso / clase» vacío del mismo formulario o modal
function campoCurso(el) {
    let cont = el.closest('form, [role="dialog"]');
    if (!cont) { cont = el; for (let i = 0; i < 5 && cont.parentElement; i++) cont = cont.parentElement; }
    return [...cont.querySelectorAll('input')].find(x => x !== el && !x.value && /(curso|clase|grupo)/i.test(etiquetaDe(x)) && !/(nombre del|profe|c[oó]digo)/i.test(etiquetaDe(x)));
}

export default function SelectorNombresGlobal() {
    const { activo } = useGruposDispositivo();
    const [campo, setCampo] = useState(null);
    const [rect, setRect] = useState(null);
    const [filtro, setFiltro] = useState('');
    const [gestor, setGestor] = useState(false);
    const [oculto, setOculto] = useState(() => { try { return sessionStorage.getItem('pikt_selector_nombres_off') === '1'; } catch { return false; } });
    const panel = useRef(null);

    useEffect(() => {
        // Sin grupo en uso solo se ofrece al profe con sesión (en el móvil de un alumno no aparece nada)
        if (oculto) { setCampo(null); return undefined; }
        const alFoco = (e) => { if (esCampoNombre(e.target) && (activo || auth.currentUser)) { setCampo(e.target); setFiltro(e.target.value || ''); setRect(e.target.getBoundingClientRect()); } };
        const alSalir = (e) => {
            setTimeout(() => {
                const a = document.activeElement;
                if (panel.current && panel.current.contains(a)) return;
                if (a !== e.target) setCampo(c => (c === e.target ? null : c));
            }, 120);
        };
        const alEscribir = (e) => { if (e.target === campo) setFiltro(e.target.value || ''); };
        document.addEventListener('focusin', alFoco);
        document.addEventListener('focusout', alSalir);
        document.addEventListener('input', alEscribir, true);
        return () => { document.removeEventListener('focusin', alFoco); document.removeEventListener('focusout', alSalir); document.removeEventListener('input', alEscribir, true); };
    }, [activo, oculto, campo]);

    // Recolocar con scroll / cambio de tamaño; cerrar si el campo desaparece
    useEffect(() => {
        if (!campo) return undefined;
        const mover = () => { if (!document.body.contains(campo)) { setCampo(null); return; } setRect(campo.getBoundingClientRect()); };
        const id = setInterval(mover, 400);
        window.addEventListener('scroll', mover, true); window.addEventListener('resize', mover);
        return () => { clearInterval(id); window.removeEventListener('scroll', mover, true); window.removeEventListener('resize', mover); };
    }, [campo]);

    if (gestor) return <Suspense fallback={null}><Gestor onClose={() => setGestor(false)} /></Suspense>;
    if (!campo || !rect) return null;
    if (!activo) {
        return (
            <div ref={panel} onMouseDown={e => e.preventDefault()} style={{ position: 'fixed', left: Math.max(8, rect.left), top: rect.bottom + 4, zIndex: 2147481000, display: 'flex', gap: 4, fontFamily: 'inherit' }}>
                <button onClick={() => { setCampo(null); setGestor(true); }} style={{ background: '#0d9488', color: 'white', border: 'none', borderRadius: 999, padding: '5px 12px', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer', boxShadow: '0 4px 12px rgba(0,0,0,0.25)' }}>👥 Usar un grupo de mi comunidad</button>
                <button onClick={() => { setCampo(null); setOculto(true); try { sessionStorage.setItem('pikt_selector_nombres_off', '1'); } catch { /* */ } }} title="No mostrar más en esta sesión" style={{ ...mini, borderRadius: 999 }}>✕</button>
            </div>
        );
    }

    // Filtra mientras se escribe; si no coincide nada (p. ej. «Mando 3» o un nombre ya puesto), se ven todos
    const f = filtro.trim().toLowerCase();
    const coinciden = f ? activo.alumnos.filter(n => n.toLowerCase().includes(f) && n.toLowerCase() !== f) : [];
    const nombres = coinciden.length ? coinciden : activo.alumnos;
    if (!nombres.length) return null;

    const elegir = (n) => {
        ponerValor(campo, n);
        const c = campoCurso(campo);
        if (c) ponerValor(c, activo.curso || activo.nombre);
        setCampo(null);
    };
    const ancho = Math.min(Math.max(rect.width, 280), window.innerWidth - 16);
    const izq = Math.max(8, Math.min(rect.left, window.innerWidth - ancho - 8));
    const abajo = window.innerHeight - rect.bottom;
    const arriba = abajo < 220 && rect.top > abajo;
    const pos = arriba ? { bottom: window.innerHeight - rect.top + 4 } : { top: rect.bottom + 4 };

    return (
        <div ref={panel} onMouseDown={e => e.preventDefault()} style={{
            position: 'fixed', left: izq, width: ancho, ...pos, maxHeight: Math.min(260, arriba ? rect.top - 12 : abajo - 12), overflowY: 'auto',
            zIndex: 2147481000, background: 'white', color: '#1f2937', borderRadius: 14, boxShadow: '0 12px 34px rgba(0,0,0,0.3)', border: '2px solid #0d9488',
            fontFamily: "'Nunito', 'Segoe UI', system-ui, sans-serif", padding: 8, boxSizing: 'border-box',
        }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, fontSize: '0.78rem', fontWeight: 800, color: '#0f766e' }}>
                <span style={{ flex: 1 }}>👥 {activo.nombre} · toca tu nombre</span>
                <button onClick={() => { setCampo(null); setGestor(true); }} title="Cambiar de grupo" style={mini}>⚙️</button>
                <button onClick={() => { setCampo(null); setOculto(true); try { sessionStorage.setItem('pikt_selector_nombres_off', '1'); } catch { /* */ } }} title="No mostrar más en esta sesión" style={mini}>✕</button>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                {nombres.map(n => (
                    <button key={n} onClick={() => elegir(n)} style={{ padding: '6px 10px', borderRadius: 9, border: '1px solid #99f6e4', background: '#f0fdfa', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.9rem', fontWeight: 700, color: '#134e4a' }}>{n}</button>
                ))}
            </div>
        </div>
    );
}
const mini = { background: '#f1f5f9', border: 'none', borderRadius: 8, cursor: 'pointer', padding: '2px 7px', fontSize: '0.8rem' };
