import React from 'react';
import { claveCelda } from '../utils/calculoColumna';

// ─────────────────────────────────────────────────────────────────────────────
//  Dibuja una operación en columna (rejilla de utils/calculoColumna.js).
//  modo: 'vacio'       → para imprimir (casillas en blanco, cuadrícula suave)
//        'solucion'    → casillas rellenas en rojo hasta el paso `vis`
//        'interactivo' → el alumno escribe (valores, estados, sel, onSel)
//  Todo va con posiciones absolutas para que html2canvas lo pase bien a PDF.
// ─────────────────────────────────────────────────────────────────────────────

const COLORES_ESTADO = {
    ok: { bg: '#e8f5e9', borde: '#66bb6a', txt: '#2e7d32' },
    mal: { bg: '#ffebee', borde: '#e53935', txt: '#c62828' },
    vacio: { bg: '#fff8e1', borde: '#ffb300', txt: '#2c3e50' },
    pista: { bg: '#e3f2fd', borde: '#42a5f5', txt: '#1565c0' },
};

export default function OperacionColumna({
    lay, celda = 28, modo = 'vacio', vis = Infinity, cuadricula = true,
    valores = {}, estados = {}, sel = null, onSel, colorSol = '#c0392b',
}) {
    const x = [0]; lay.anchos.forEach((w, i) => x.push(x[i] + w * celda));
    const y = [0]; lay.altos.forEach((h, i) => y.push(y[i] + h * celda));
    const fuente = Math.round(celda * 0.66);
    const interactivo = modo === 'interactivo';

    return (
        <div style={{ position: 'relative', width: x[x.length - 1], height: y[y.length - 1], flexShrink: 0, fontFamily: "'Segoe UI', Tahoma, sans-serif", fontVariantNumeric: 'tabular-nums', userSelect: 'none' }}>
            {lay.lineas.map((l, i) => (l.h ? (
                <div key={`l${i}`} style={{ position: 'absolute', left: x[l.c0] + 1, width: x[l.c1 + 1] - x[l.c0] - 2, top: y[l.r + 1] - (l.tenue ? 1 : 1.5), height: 0, borderTop: l.tenue ? '1.5px dashed #b0bec5' : '2.5px solid #2c3e50' }} />
            ) : (
                <div key={`l${i}`} style={{ position: 'absolute', left: x[l.c] - 1.5, top: y[l.r0] + 2, height: y[l.r1 + 1] - y[l.r0] - 2, width: 0, borderLeft: '2.5px solid #2c3e50' }} />
            )))}
            {lay.celdas.map((cel) => {
                const k = claveCelda(cel);
                const base = { position: 'absolute', left: x[cel.c], top: y[cel.r], width: lay.anchos[cel.c] * celda, height: lay.altos[cel.r] * celda, display: 'flex', alignItems: 'center', justifyContent: 'center', boxSizing: 'border-box' };
                const pequena = cel.tipo === 'llevada';
                if (cel.tipo === 'fijo') {
                    return <div key={k} style={{ ...base, fontSize: fuente, fontWeight: 800, color: cel.tenue ? '#b0bec5' : '#2c3e50' }}>{cel.v}</div>;
                }
                const txtSol = pequena ? (cel.mas ? `+${cel.v}` : cel.v) : cel.v;
                if (!interactivo) {
                    const mostrar = modo === 'solucion' && (cel.paso || 0) <= vis;
                    const caja = cuadricula && !pequena;
                    return (
                        <div key={k} style={{ ...base, padding: 2 }}>
                            <div style={{ width: '100%', height: '100%', borderRadius: 4, border: caja ? '1px dashed #cfd8dc' : 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: pequena ? Math.round(celda * 0.4) : fuente, fontWeight: 900, color: pequena ? '#1e88e5' : colorSol }}>
                                {mostrar ? txtSol : ''}
                            </div>
                        </div>
                    );
                }
                const est = COLORES_ESTADO[estados[k]];
                const activa = sel === k;
                const val = valores[k] || '';
                return (
                    <div key={k} style={{ ...base, padding: pequena ? '1px 3px' : 2 }}>
                        <button type="button" onClick={() => onSel?.(k)}
                            style={{
                                width: '100%', height: '100%', padding: 0, borderRadius: pequena ? 4 : 6, cursor: 'pointer', fontFamily: 'inherit',
                                border: activa ? '2.5px solid #E91E63' : `1.5px ${pequena ? 'dotted' : 'solid'} ${est?.borde || (pequena ? '#90caf9' : '#b0bec5')}`,
                                background: activa ? '#fce4ec' : est?.bg || (pequena ? 'transparent' : 'white'),
                                boxShadow: activa ? '0 0 0 3px rgba(233,30,99,0.18)' : 'none',
                                fontSize: pequena ? Math.round(celda * 0.42) : fuente, fontWeight: 900, lineHeight: 1,
                                color: pequena ? '#1e88e5' : est?.txt || '#2c3e50', touchAction: 'manipulation',
                            }}>
                            {pequena && cel.mas && val ? `+${val}` : val}
                        </button>
                    </div>
                );
            })}
        </div>
    );
}
