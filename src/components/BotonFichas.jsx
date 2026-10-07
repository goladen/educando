import React, { useState, lazy, Suspense } from 'react';

// ─────────────────────────────────────────────────────────────────────────────
//  Botón «🖨️ Fichas para imprimir» para usar DENTRO de una herramienta.
//  Abre el centro de fichas encima de la herramienta (sin salir de ella):
//    materia: 'biologia' | 'geografia' | 'sintaxis' | 'musica'  → FichasMaterias
//    tema:    tema de Math World ('geometria', 'ecuaciones'…)   → FichasMathWorld
//    app:     herramienta con motor propio ('enigmic')          → FichasEnigmic
//  Con `abiertoInicial` (y opcionalmente `fichaPublicaId`) no pinta el botón:
//  abre directamente el centro de fichas, para enlaces <ruta>?ficha=ID.
// ─────────────────────────────────────────────────────────────────────────────
const FichasMaterias = lazy(() => import('../FichasMaterias'));
const FichasMathWorld = lazy(() => import('../FichasMathWorld'));
const APPS_FICHAS = { enigmic: lazy(() => import('../FichasEnigmic')) };

export default function BotonFichas({ materia = null, tema = null, app = null, fichaPublicaId = null, abiertoInicial = false, onCerrar = null, color = '#7b1fa2', texto = '🖨️ Fichas para imprimir', subtexto = 'PDF para repartir y corrección en la pizarra', style = {} }) {
    const [abierto, setAbierto] = useState(abiertoInicial);
    const FichasApp = app ? APPS_FICHAS[app] : null;
    const cerrar = () => { setAbierto(false); onCerrar?.(); };
    const isMobile = typeof window !== 'undefined' && window.innerWidth <= 700;
    return (
        <>
            {!abiertoInicial && <button onClick={() => setAbierto(true)} title="Crear o abrir fichas imprimibles"
                style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderRadius: 16, border: `2px solid ${color}`, background: 'white', color: '#2c3e50', cursor: 'pointer', textAlign: 'left', boxShadow: '0 3px 10px rgba(0,0,0,0.08)', fontFamily: 'inherit', width: '100%', boxSizing: 'border-box', ...style }}>
                <span style={{ background: color, color: 'white', borderRadius: 12, width: 42, height: 42, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.4rem', flexShrink: 0 }}>🖨️</span>
                <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: 'block', fontWeight: 900, fontSize: '0.98rem' }}>{texto.replace(/^🖨️\s*/, '')}</span>
                    {subtexto && <span style={{ display: 'block', fontSize: '0.78rem', color: '#888', fontWeight: 600 }}>{subtexto}</span>}
                </span>
                <span style={{ color, fontSize: '1.3rem', fontWeight: 900 }}>›</span>
            </button>}
            {abierto && (
                <div style={{ position: 'fixed', inset: 0, zIndex: 9000, background: '#eef2f7', overflowY: 'auto', padding: 15, boxSizing: 'border-box', fontFamily: "'Segoe UI', Tahoma, sans-serif", textAlign: 'left' }}>
                    <Suspense fallback={<div style={{ textAlign: 'center', color, fontWeight: 800, padding: 40 }}>Cargando fichas…</div>}>
                        {FichasApp
                            ? <FichasApp isMobile={isMobile} fichaPublicaId={fichaPublicaId} onSalir={cerrar} />
                            : materia
                                ? <FichasMaterias materia={materia} isMobile={isMobile} fichaPublicaId={fichaPublicaId} onSalir={cerrar} />
                                : <FichasMathWorld tema={tema} isMobile={isMobile} fichaPublicaId={fichaPublicaId} onSalir={cerrar} />}
                    </Suspense>
                </div>
            )}
        </>
    );
}
