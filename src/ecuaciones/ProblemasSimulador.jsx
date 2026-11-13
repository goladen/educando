// ─────────────────────────────────────────────────────────────────────────────
//  Panel «🧮 Problemas con ecuaciones» dentro de los simuladores de física.
//  Problemas del tema del simulador (problemasCiencias.js), con la misma entrada,
//  corrección, resolución paso a paso y solución gráfica que la app Ecuaciones.
//  También da acceso a la calculadora Casio y a la ficha PDF del simulador.
// ─────────────────────────────────────────────────────────────────────────────
import React, { lazy, Suspense, useMemo, useState } from 'react';
import { plantillasPara, generarDesdePlantilla, TIPOS_ECU } from './problemasCiencias';
import { comprobarMulti } from './ecuacionesAvanzadas';
import { EntradaSoluciones, SolucionMulti } from './UIEcuaciones';
import { sonidoCorrecto, sonidoIncorrecto } from '../utils/sonidosFeedback';

const CalculadoraFlotante = lazy(() => import('../calculadora/CalculadoraInteractiva').then((m) => ({ default: m.CalculadoraFlotante })));

export default function ProblemasSimulador({ simKey, simNombre, onClose, onFicha }) {
    const plantillas = useMemo(() => plantillasPara({ sim: simKey }), [simKey]);
    const tiposDisp = useMemo(() => [...new Set(plantillas.map((p) => p.ecu))], [plantillas]);
    const [tipo, setTipo] = useState(null);
    const nuevo = (t = tipo) => {
        const pls = plantillas.filter((p) => !t || p.ecu === t);
        return generarDesdePlantilla(pls[Math.floor(Math.random() * pls.length)]);
    };
    const [eq, setEq] = useState(() => nuevo(null));
    const [resp, setResp] = useState('');
    const [estado, setEstado] = useState(null); // null | 'mal' | 'bien' | 'visto'
    const [marcador, setMarcador] = useState({ bien: 0, total: 0 });
    const [calc, setCalc] = useState(false);
    const [clave, setClave] = useState(0);

    const siguiente = (t = tipo) => { setEq(nuevo(t)); setResp(''); setEstado(null); setClave((k) => k + 1); };
    const comprobar = () => {
        if (estado === 'bien' || estado === 'visto' || !resp.trim()) return;
        const ok = comprobarMulti(eq, resp);
        try { if (ok) sonidoCorrecto(); else sonidoIncorrecto(); } catch { /* sin sonido */ }
        setEstado(ok ? 'bien' : 'mal');
        setMarcador((m) => ({ bien: m.bien + (ok ? 1 : 0), total: m.total + (estado === 'mal' ? 0 : 1) }));
    };
    const chip = (on) => ({ padding: '5px 10px', borderRadius: 16, border: '2px solid #0891b2', background: on ? '#0891b2' : 'white', color: on ? 'white' : '#0891b2', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.75rem' });
    const btn = (bg, color = 'white') => ({ padding: '10px 14px', borderRadius: 12, border: 'none', background: bg, color, fontWeight: 800, cursor: 'pointer', fontSize: '0.9rem' });
    const resuelto = estado === 'bien' || estado === 'visto';

    return (
        <div style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: 'min(460px, 100vw)', zIndex: 10005, background: '#f8fafc', boxShadow: '-10px 0 30px rgba(0,0,0,0.35)', display: 'flex', flexDirection: 'column', color: '#1e293b' }}>
            <div style={{ background: 'linear-gradient(135deg,#0891b2,#0e7490)', color: 'white', padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 900, fontSize: '1.05rem' }}>🧮 Problemas con ecuaciones</div>
                    <div style={{ fontSize: '0.78rem', opacity: 0.85 }}>{simNombre} · ✅ {marcador.bien}/{marcador.total}</div>
                </div>
                <button onClick={() => setCalc((c) => !c)} title="Calculadora" style={{ ...btn('rgba(255,255,255,0.18)'), padding: '6px 10px' }}>🧮</button>
                {onFicha && <button onClick={onFicha} title="Ficha PDF" style={{ ...btn('rgba(255,255,255,0.18)'), padding: '6px 10px' }}>🖨️</button>}
                <button onClick={onClose} title="Cerrar" style={{ ...btn('#e74c3c'), padding: '6px 10px' }}>✕</button>
            </div>
            <div style={{ padding: '10px 12px', display: 'flex', gap: 6, flexWrap: 'wrap', borderBottom: '1px solid #e2e8f0', background: 'white' }}>
                <button onClick={() => { setTipo(null); siguiente(null); }} style={chip(!tipo)}>Todas</button>
                {tiposDisp.map((k) => <button key={k} onClick={() => { setTipo(k); siguiente(k); }} style={chip(tipo === k)}>{TIPOS_ECU[k]}</button>)}
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: 14 }}>
                <div style={{ background: 'white', borderRadius: 14, padding: 14, boxShadow: '0 2px 10px rgba(0,0,0,0.06)', borderLeft: '5px solid #0891b2', lineHeight: 1.55, fontSize: '0.98rem' }}>
                    <div style={{ fontSize: '0.72rem', color: '#0891b2', fontWeight: 800, marginBottom: 4 }}>Ecuación {eq.tipoEcu}</div>
                    {eq.ast[0].v}
                </div>
                <div style={{ marginTop: 14 }}>
                    {!resuelto && (
                        <EntradaSoluciones key={clave} eq={eq} value={resp} onChange={(v) => { setResp(v); if (estado === 'mal') setEstado(null); }} onSubmit={comprobar} color="#0891b2" compacto />
                    )}
                    {estado === 'mal' && <div style={{ textAlign: 'center', color: '#c0392b', fontWeight: 800, marginTop: 8 }}>❌ No es correcto. Revisa el planteamiento o mira la solución.</div>}
                    {estado === 'bien' && <div style={{ textAlign: 'center', color: '#1e8449', fontWeight: 900, fontSize: '1.1rem', marginBottom: 8 }}>✅ ¡Correcto!</div>}
                    {resuelto && <SolucionMulti key={'s' + clave} eq={eq} />}
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                    {!resuelto && <button onClick={() => { setEstado('visto'); setMarcador((m) => ({ ...m, total: m.total + (estado === 'mal' ? 0 : 1) })); }} style={{ ...btn('#f39c12'), flex: 1 }}>👁️ Ver solución</button>}
                    {!resuelto && <button onClick={comprobar} style={{ ...btn('#27ae60'), flex: 2 }}>✓ Comprobar</button>}
                    {resuelto && <button onClick={() => siguiente()} style={{ ...btn('#0891b2'), flex: 1 }}>Siguiente problema →</button>}
                </div>
            </div>
            {calc && (
                <Suspense fallback={null}>
                    <CalculadoraFlotante onClose={() => setCalc(false)} inicial={{ x: 12, y: 80 }} />
                </Suspense>
            )}
        </div>
    );
}
