// Botón flotante 🧮 que abre «Uso de la calculadora» con los bloques que
// corresponden a cada app de Math World. Ligero: el contenido se carga con lazy.
import React, { lazy, Suspense, useState } from 'react';
import { APPS_CALCULADORA } from './appsCalculadora';

const UsoCalculadora = lazy(() => import('./UsoCalculadora'));

export default function BotonCalculadora({ app, bloques }) {
    const [abierto, setAbierto] = useState(false);
    const lista = bloques || APPS_CALCULADORA[app]?.bloques;
    if (!lista?.length) return null;

    return (
        <>
            <button
                onClick={() => setAbierto(true)}
                title="Uso de la calculadora (Casio fx-82MS)"
                aria-label="Uso de la calculadora"
                style={{
                    position: 'fixed', left: 14, bottom: 14, zIndex: 100000,
                    width: 46, height: 46, borderRadius: '50%', border: '2px solid #fff',
                    background: '#0f766e', color: '#fff', fontSize: 22, cursor: 'pointer',
                    boxShadow: '0 4px 14px #0004', opacity: 0.88,
                }}
            >🧮</button>
            {abierto && (
                <div style={{ position: 'fixed', inset: 0, zIndex: 100001, background: '#0007', display: 'flex', alignItems: 'stretch', justifyContent: 'center' }}
                    onClick={e => { if (e.target === e.currentTarget) setAbierto(false); }}>
                    <div style={{ position: 'relative', width: '100%', maxWidth: 1200, margin: 'min(3vh, 20px) auto', borderRadius: 18, overflow: 'auto', background: '#eef6f4' }}>
                        <Suspense fallback={<div style={{ padding: 40, textAlign: 'center', fontWeight: 800, color: '#0f766e' }}>Cargando calculadora…</div>}>
                            <UsoCalculadora embebido appOrigen={app} bloques={lista} onExit={() => setAbierto(false)} />
                        </Suspense>
                    </div>
                </div>
            )}
        </>
    );
}
