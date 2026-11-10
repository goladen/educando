// PolyInput.jsx — construir un polinomio con botones +/− por grado (Álgebra · Math World)
// value: coeficientes ascendentes; onChange recibe una función (prev => next), como un setState.
// grande: añade botones ±10 para coeficientes grandes.
import React, { useRef } from 'react';
import { polyStr } from './motorFactorizacion';

const SUP = { 2: '²', 3: '³', 4: '⁴', 5: '⁵' };
const lit = d => d === 0 ? '1' : d === 1 ? 'x' : `x${SUP[d] || `^${d}`}`;

export default function PolyInput({ value, onChange, maxDeg = 4, grande = false, disabled = false }) {
    const bump = (d, delta) => { onChange(prev => { const a = [...prev]; while (a.length <= d) a.push(0); a[d] = a[d] + delta; return a; }); };
    const reset = () => onChange(() => Array(maxDeg + 1).fill(0));

    const holdRef = useRef(null);
    const startHold = (d, delta) => {
        bump(d, delta);
        holdRef.current = setTimeout(() => { holdRef.current = setInterval(() => bump(d, delta), 60); }, 350);
    };
    const stopHold = () => { clearTimeout(holdRef.current); clearInterval(holdRef.current); holdRef.current = null; };

    const btnS = (bg, small) => ({ padding: small ? '3px 6px' : '5px 9px', borderRadius: 7, border: 'none', color: 'white', cursor: disabled ? 'default' : 'pointer', fontWeight: 700, fontSize: small ? '0.7rem' : '0.78rem', minWidth: 40, background: bg, userSelect: 'none', touchAction: 'none', opacity: disabled ? 0.4 : 1 });
    const holdProps = (d, delta) => disabled ? {} : ({
        onPointerDown: (e) => { e.currentTarget.setPointerCapture(e.pointerId); startHold(d, delta); },
        onPointerUp: stopHold, onPointerLeave: stopHold, onPointerCancel: stopHold,
    });

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center' }}>
            <div style={{ background: '#0d1117', borderRadius: 10, padding: '9px 22px', fontWeight: 700, fontSize: '1.15rem', color: '#f39c12', minWidth: 200, textAlign: 'center', border: '2px solid rgba(243,156,18,0.3)', minHeight: 42, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Georgia,serif' }}>
                {polyStr(value)}
            </div>
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', justifyContent: 'center' }}>
                {Array.from({ length: maxDeg + 1 }, (_, i) => maxDeg - i).map(d => (
                    <div key={d} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                        {grande && <button style={btnS('#1e8449', true)} disabled={disabled} {...holdProps(d, 10)}>+10{d ? lit(d) : ''}</button>}
                        <button style={btnS('#27ae60')} disabled={disabled} {...holdProps(d, 1)}>+{lit(d)}</button>
                        <button style={btnS('#c0392b')} disabled={disabled} {...holdProps(d, -1)}>−{lit(d)}</button>
                        {grande && <button style={btnS('#922b21', true)} disabled={disabled} {...holdProps(d, -10)}>−10{d ? lit(d) : ''}</button>}
                    </div>
                ))}
                <div style={{ display: 'flex', alignItems: 'center' }}>
                    <button style={btnS('#566573')} disabled={disabled} onClick={reset}>Reset</button>
                </div>
            </div>
        </div>
    );
}
