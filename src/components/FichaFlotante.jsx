import React, { lazy, Suspense, useEffect, useId, useMemo, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { tienePdf } from './BotonPdfRecurso';

// ─────────────────────────────────────────────────────────────────────────────
//  Botón «🖨️ Ficha PDF» ARRIBA A LA IZQUIERDA (debajo del «← Volver» habitual; a la derecha lo tapaba el aviso de modo alumno), solo ANTES de jugar (menús, elegir
//  recurso, configurar partida). En cuanto empieza la partida desaparece: nadie
//  imprime mientras juega y así no tapa controles (mandos micro:bit, 🧮…).
//    recurso → ficha en papel de ese recurso (ModalPdfRecurso: test, rosco, sopa…)
//    tema    → centro de fichas de Math World con ese tema preseleccionado
//    materia → fichas de Biología / Geografía / Lengua / Música
//    arriba  → separación del borde superior (64 por defecto, para no pisar el «← Volver» de arriba a la izquierda)
//
//  ¿Cuándo se considera que «ha empezado el juego»? (estado global, vale para todos)
//    · un clic en un botón tipo «Jugar / Empezar / Comenzar / Start…»
//    · un clic sobre el lienzo del juego (<canvas>), pantalla completa o bloqueo del ratón
//    · alAbrir="usar": el primer clic en cualquier sitio (herramientas como las de Math World)
//    · una pantalla previa con su propio botón se cierra (p. ej. «Preparar partida» → juego)
//  Vuelve a aparecer al salir del juego (cuando ya no queda ningún botón montado).
// ─────────────────────────────────────────────────────────────────────────────
const ModalPdfRecurso = lazy(() => import('./ModalPdfRecurso'));
const BotonFichas = lazy(() => import('./BotonFichas'));

const RE_EMPEZAR = /\b(jugar|juega|empezar|empieza|comenzar|comienza|iniciar|inicia|start|play|go)\b|¡a por|▶|🚀/i;

// ── Estado global: solo se ve UN botón (el último montado) y ninguno si ya se juega ──
const store = { activos: [], jugando: false };
const oyentes = new Set();
const avisar = () => oyentes.forEach((f) => f());
const suscribir = (f) => { oyentes.add(f); return () => oyentes.delete(f); };
const visibleId = () => (store.jugando ? null : store.activos[store.activos.length - 1] || null);
const empezarJuego = () => { if (!store.jugando) { store.jugando = true; avisar(); } };

export default function FichaFlotante({ recurso = null, tema = null, materia = null, alAbrir = 'jugar', arriba = 64, color = '#6D28D9', texto = 'Ficha PDF' }) {
    const [abierto, setAbierto] = useState(false);
    const id = useId();
    const conRecurso = useMemo(() => !!recurso && tienePdf(recurso), [recurso]);
    const hayAlgo = conRecurso || !!tema || !!materia;

    useEffect(() => {
        if (!hayAlgo) return undefined;
        store.activos = [...store.activos.filter((x) => x !== id), id];
        avisar();
        return () => {
            store.activos = store.activos.filter((x) => x !== id);
            // Si se cierra una pantalla previa pero sigue el juego abierto → ha empezado la partida.
            // Si ya no queda ninguno → se ha salido del juego: listo para el siguiente.
            store.jugando = store.activos.length > 0;
            avisar();
        };
    }, [hayAlgo, id]);

    const visible = useSyncExternalStore(suscribir, visibleId) === id;

    // Detectar el inicio de la partida mientras el botón está a la vista
    useEffect(() => {
        if (!visible) return undefined;
        const alPulsar = (e) => {
            const t = e.target;
            if (!(t instanceof Element) || t.closest('[data-ficha-flotante]')) return;
            if (alAbrir === 'usar') { empezarJuego(); return; }
            if (t.closest('canvas')) { empezarJuego(); return; }
            const boton = t.closest('button, [role="button"], a');
            if (boton && RE_EMPEZAR.test(boton.textContent || boton.getAttribute('aria-label') || '')) empezarJuego();
        };
        const alPantalla = () => { if (document.fullscreenElement || document.pointerLockElement) empezarJuego(); };
        document.addEventListener('pointerdown', alPulsar, true);
        document.addEventListener('fullscreenchange', alPantalla);
        document.addEventListener('pointerlockchange', alPantalla);
        return () => {
            document.removeEventListener('pointerdown', alPulsar, true);
            document.removeEventListener('fullscreenchange', alPantalla);
            document.removeEventListener('pointerlockchange', alPantalla);
        };
    }, [visible, alAbrir]);

    if (!hayAlgo || (!visible && !abierto)) return null;

    const titulo = conRecurso
        ? `Crear la ficha en PDF de «${recurso.titulo || 'este recurso'}» para imprimir`
        : 'Crear fichas en PDF de este tema para imprimir';

    return (
        <>
            {visible && createPortal(
                <button type="button" data-ficha-flotante className="no-print" onClick={() => setAbierto(true)} title={titulo}
                    style={{
                        position: 'fixed', top: arriba, left: 12, zIndex: 100000,
                        display: 'flex', alignItems: 'center', gap: 7, padding: '9px 14px 9px 11px',
                        borderRadius: 999, border: '2px solid #fff', background: color, color: '#fff',
                        fontWeight: 900, fontSize: '0.86rem', cursor: 'pointer', whiteSpace: 'nowrap',
                        fontFamily: "'Segoe UI', Tahoma, sans-serif", boxShadow: '0 4px 14px #0004',
                    }}>
                    <span style={{ fontSize: '1.1rem' }}>🖨️</span>{texto}
                </button>,
                document.body,
            )}

            {/* Capa propia por encima de los juegos a pantalla completa (zIndex 9999…) */}
            {abierto && createPortal(
                <div data-ficha-flotante className="no-print" style={{ position: 'fixed', inset: 0, zIndex: 100002 }} onClick={(e) => e.stopPropagation()}>
                    <Suspense fallback={<div style={{ position: 'fixed', inset: 0, background: '#0007', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800 }}>Cargando fichas…</div>}>
                        {conRecurso
                            ? <ModalPdfRecurso recurso={recurso} onClose={() => setAbierto(false)} />
                            : <BotonFichas abiertoInicial tema={tema} materia={materia} onCerrar={() => setAbierto(false)} />}
                    </Suspense>
                </div>,
                document.body,
            )}
        </>
    );
}
