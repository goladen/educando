// Piezas de interfaz para las ecuaciones avanzadas (tipo 'MULTI') de Ecuaciones.jsx:
// texto matemático con marcado, fracciones, entrada de varias soluciones y solución paso a paso.
import React, { useState } from 'react';
import { parseListaSoluciones, formatoSolucion, textoSoluciones, aMathRender, datosGrafica } from './ecuacionesAvanzadas';
import { renderMath } from '../utils/MathRender';
import GraficaEcuacion from './GraficaEcuacion';

// ─── Texto matemático: mismo render que las fichas (utils/MathRender) ────────
// Marcado propio ^{…} _{…} √{…} → FRAC/SQRT/^{} de MathRender: barra de fracción a
// todo el ancho y radical de una sola pieza que se estira con el radicando.
// Los pasos largos se parten por «→» para que puedan saltar de línea.
export function MathText({ v, size = '1em' }) {
    const trozos = String(v ?? '').split(/\s*→\s*/);
    return (
        <>
            {trozos.map((t, i) => (
                <React.Fragment key={i}>
                    {i > 0 && <span style={{ margin: '0 0.4em', opacity: 0.7 }}>→</span>}
                    {renderMath(aMathRender(t), false, size)}
                </React.Fragment>
            ))}
        </>
    );
}

// Elementos nuevos del ast: {t:'m', v} y {t:'mfrac', n, d}
export const esElementoAvanzado = (el) => el?.t === 'm' || el?.t === 'mfrac';
export function ElementoAvanzado({ el }) {
    if (el.t === 'm') return renderMath(aMathRender(el.v), false, '1em');
    if (el.t === 'mfrac') return renderMath(`FRAC(${aMathRender(el.n)},${aMathRender(el.d)})`, false, '1em');
    return null;
}
// Fracción de los tipos clásicos (num/den en texto)
export function FraccionMath({ num, den }) {
    return renderMath(`FRAC(${num},${den})`, false, '1em');
}

// ─── Entrada de una o varias soluciones ──────────────────────────────────────
const TECLAS = ['7', '8', '9', '⌫', '4', '5', '6', ';', '1', '2', '3', '-', '0', '.', '/', 'C'];

export function EntradaSoluciones({ eq, value, onChange, onSubmit, oscuro = false, soloTeclado = false, compacto = false, color = '#3498db', conBotonComprobar = false, autoFocus = true }) {
    const [teclado, setTeclado] = useState(soloTeclado);
    const valores = parseListaSoluciones(value);
    const etiqueta = eq?.etiqueta || 'x =';
    const instr = eq?.instruccion || (eq?.sub?.startsWith('PROB')
        ? 'Escribe el resultado (si hay varios, sepáralos con ;)'
        : 'Escribe todas las soluciones separadas por ;  (fracciones: 3/2)');
    const tx = oscuro ? 'white' : '#2c3e50';
    const suave = oscuro ? 'rgba(255,255,255,0.65)' : '#7f8c8d';
    const pulsar = (k) => {
        if (k === '⌫') onChange(value.slice(0, -1));
        else if (k === 'C') onChange('');
        else if (k === ';') onChange(value.replace(/\s*$/, '') + ' ; ');
        else onChange(value + k);
    };
    const caja = {
        minWidth: compacto ? 120 : 180, maxWidth: '100%', height: compacto ? 44 : 52, fontSize: compacto ? '1.15rem' : '1.4rem',
        textAlign: 'center', borderRadius: 10, border: `3px solid ${oscuro ? 'rgba(255,255,255,0.3)' : '#bdc3c7'}`,
        outline: 'none', background: oscuro ? 'rgba(255,255,255,0.1)' : '#f8f9fa', color: tx, fontWeight: 'bold',
        boxSizing: 'border-box', padding: '0 10px',
    };
    return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: compacto ? 6 : 10, width: '100%' }}>
            <div style={{ fontSize: compacto ? '0.72rem' : '0.82rem', color: suave, textAlign: 'center' }}>{instr}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', justifyContent: 'center', maxWidth: '100%' }}>
                <span style={{ fontSize: compacto ? '1rem' : '1.2rem', fontWeight: 'bold', color }}>{etiqueta}</span>
                {soloTeclado ? (
                    <div style={{ ...caja, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {value || <span style={{ color: '#ccc', fontSize: '0.9rem' }}>···</span>}
                    </div>
                ) : (
                    <input type="text" inputMode="text" value={value} autoFocus={autoFocus}
                        onChange={(e) => onChange(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && onSubmit && onSubmit()}
                        placeholder={eq?.grados ? '30 ; 150' : '3 ; −2'}
                        style={caja} />
                )}
                {eq?.unidad && <span style={{ color: suave, fontWeight: 'bold', fontSize: compacto ? '0.85rem' : '1rem' }}>{eq.unidad}</span>}
                {!soloTeclado && (
                    <button type="button" onClick={() => setTeclado((t) => !t)} title="Teclado en pantalla"
                        style={{ padding: '6px 10px', borderRadius: 10, border: 'none', cursor: 'pointer', background: teclado ? color : (oscuro ? 'rgba(255,255,255,0.15)' : '#ecf0f1'), color: teclado ? 'white' : tx, fontSize: '1rem' }}>
                        ⌨️
                    </button>
                )}
            </div>
            {valores.length > 0 && (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'center' }}>
                    {valores.map((v, i) => (
                        <span key={i} style={{ padding: '2px 10px', borderRadius: 20, fontSize: '0.8rem', fontWeight: 'bold', background: isFinite(v) ? (oscuro ? 'rgba(46,204,113,0.25)' : '#e8f8f0') : (oscuro ? 'rgba(231,76,60,0.3)' : '#fdecea'), color: isFinite(v) ? (oscuro ? '#a9f5c9' : '#1e8449') : '#c0392b' }}>
                            {isFinite(v) ? formatoSolucion(eq, v) : '¿?'}
                        </span>
                    ))}
                </div>
            )}
            {(teclado || soloTeclado) && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 5, width: '100%', maxWidth: 280 }}>
                    {TECLAS.map((k) => (
                        <button key={k} type="button" onClick={() => pulsar(k)}
                            style={{
                                padding: compacto ? '8px 0' : '10px 0', fontSize: '1.05rem', fontWeight: 'bold', borderRadius: 8, border: 'none', cursor: 'pointer',
                                background: k === '⌫' || k === 'C' ? '#e74c3c' : /[;\-./]/.test(k) ? '#8e44ad' : (oscuro ? 'rgba(255,255,255,0.15)' : '#ecf0f1'),
                                color: /[0-9]/.test(k) ? tx : 'white', boxShadow: '0 2px 0 rgba(0,0,0,0.1)',
                            }}>
                            {k === '-' ? '−' : k}
                        </button>
                    ))}
                </div>
            )}
            {conBotonComprobar && (
                <button type="button" onClick={onSubmit}
                    style={{ width: '100%', padding: '10px', background: color, color: 'white', border: 'none', borderRadius: 10, fontWeight: 'bold', cursor: 'pointer', fontSize: '0.95rem' }}>
                    ✓ Comprobar
                </button>
            )}
        </div>
    );
}

// ─── Solución (y resolución paso a paso) ─────────────────────────────────────
export function SolucionMulti({ eq, oscuro = false, compacto = false, pasosAbiertos = true, graficaAbierta = false }) {
    const [ver, setVer] = useState(pasosAbiertos);
    const [graf, setGraf] = useState(graficaAbierta);
    const tx = oscuro ? 'white' : '#2c3e50';
    const desc = eq?.descartadas || [];
    return (
        <div style={{ background: oscuro ? 'rgba(46,204,113,0.12)' : '#e8f8f0', border: '2px solid #27ae60', borderRadius: 12, padding: compacto ? '8px 10px' : '12px 16px', color: tx, textAlign: 'left', marginBottom: 12 }}>
            <div style={{ fontWeight: 'bold', fontSize: compacto ? '0.95rem' : '1.15rem', textAlign: 'center' }}>✅ {textoSoluciones(eq)}</div>
            {desc.length > 0 && (
                <div style={{ fontSize: '0.8rem', textAlign: 'center', color: oscuro ? '#f5b7b1' : '#c0392b', marginTop: 4 }}>
                    Se descarta{desc.length > 1 ? 'n' : ''}: {desc.map((v) => formatoSolucion(eq, v)).join(' ; ')}
                </div>
            )}
            {eq?.pasos?.length > 0 && (
                <>
                    <div style={{ textAlign: 'center', marginTop: 6 }}>
                        <button type="button" onClick={() => setVer((x) => !x)}
                            style={{ background: 'none', border: 'none', color: oscuro ? '#f1c40f' : '#2980b9', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.8rem' }}>
                            {ver ? '▲ Ocultar resolución' : '▼ Ver resolución paso a paso'}
                        </button>
                    </div>
                    {ver && (
                        <ol style={{ margin: '6px 0 0', paddingLeft: 22, fontSize: compacto ? '0.8rem' : '0.95rem', lineHeight: 1.9 }}>
                            {eq.pasos.map((p, i) => <li key={i}><MathText v={p} /></li>)}
                        </ol>
                    )}
                </>
            )}
            {!eq?.sinGrafica && (
                <div style={{ textAlign: 'center', marginTop: 4 }}>
                    <button type="button" onClick={() => setGraf((x) => !x)}
                        style={{ background: 'none', border: 'none', color: oscuro ? '#f1c40f' : '#8e44ad', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.8rem' }}>
                        {graf ? '▲ Ocultar solución gráfica' : '📈 Ver solución gráfica'}
                    </button>
                </div>
            )}
            {graf && !eq?.sinGrafica && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: 4 }}>
                    <GraficaEcuacion datos={datosGrafica(eq)} oscuro={oscuro} />
                    <div style={{ fontSize: '0.72rem', color: oscuro ? '#ccd' : '#7f8c8d', marginTop: 4, textAlign: 'center' }}>
                        Las soluciones son las abscisas (x) de los puntos donde se cortan las dos gráficas.
                    </div>
                </div>
            )}
        </div>
    );
}
