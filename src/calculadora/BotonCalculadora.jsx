// Botón flotante 🧮 de las apps de Math World: abre la Casio fx-82MS INTERACTIVA
// (se puede calcular con ella mientras se trabaja) y, desde ella, «📘 Retos» abre
// «Uso de la calculadora» con los bloques que corresponden a cada app.
// Ligero: la calculadora y los retos se cargan con lazy.
import React, { lazy, Suspense, useState } from 'react';
import { APPS_CALCULADORA } from './appsCalculadora';

const UsoCalculadora = lazy(() => import('./UsoCalculadora'));
const CalculadoraFlotante = lazy(() => import('./CalculadoraInteractiva').then((m) => ({ default: m.CalculadoraFlotante })));

export default function BotonCalculadora({ app, bloques }) {
    const [calc, setCalc] = useState(false);
    const [retos, setRetos] = useState(false);
    const lista = bloques || APPS_CALCULADORA[app]?.bloques;
    if (!lista?.length) return null;

    return (
        <>
            <button
                onClick={() => setCalc((c) => !c)}
                title="Calculadora Casio fx-82MS"
                aria-label="Calculadora"
                style={{
                    position: 'fixed', left: 14, bottom: 14, zIndex: 100000,
                    width: 46, height: 46, borderRadius: '50%', border: '2px solid #fff',
                    background: calc ? '#115e59' : '#0f766e', color: '#fff', fontSize: 22, cursor: 'pointer',
                    boxShadow: '0 4px 14px #0004', opacity: 0.88,
                }}
            >🧮</button>
            {calc && (
                <Suspense fallback={null}>
                    <CalculadoraFlotante onClose={() => setCalc(false)} onRetos={() => { setCalc(false); setRetos(true); }} />
                </Suspense>
            )}
            {retos && (
                <div style={{ position: 'fixed', inset: 0, zIndex: 100001, background: '#0007', display: 'flex', alignItems: 'stretch', justifyContent: 'center' }}
                    onClick={e => { if (e.target === e.currentTarget) setRetos(false); }}>
                    <div style={{ position: 'relative', width: '100%', maxWidth: 1200, margin: 'min(3vh, 20px) auto', borderRadius: 18, overflow: 'auto', background: '#eef6f4' }}>
                        <Suspense fallback={<div style={{ padding: 40, textAlign: 'center', fontWeight: 800, color: '#0f766e' }}>Cargando calculadora…</div>}>
                            <UsoCalculadora embebido appOrigen={app} bloques={lista} onExit={() => setRetos(false)} />
                        </Suspense>
                    </div>
                </div>
            )}
        </>
    );
}
