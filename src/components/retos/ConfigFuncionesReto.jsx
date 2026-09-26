import React, { useMemo, useState } from 'react';
import { FUNCIONES_DB } from '../../BibliotecaFunciones';
import { FunctionPlotter, renderLatex, DEFAULT_RETO_FUN, resumenFunciones } from '../../Funciones';
import { TIPOS_ELEM, BASES_ELEM, ETIQUETA_CAMPO_ELEM, paramsAleatoriosElem, construirElemental, describirElemental } from '../../RepresentacionElementales';
import { Chip, Seccion, MarcoConfig } from './ConfigChips';

const AZUL_F = '#3498db';
const VERDE_F = '#27ae60';
const fmtBase = (b) => Number.isInteger(b) ? String(b) : `1/${Math.round(1 / b)}`;

// Reto de Funciones: un ejercicio concreto de uno de los dos tipos
//  · Características desde gráfica → una función de la biblioteca + modo de respuesta
//  · Representar función elemental → tipo + números de la función
export default function ConfigFuncionesReto({ config, onAceptar, onClose }) {
    const [modo, setModo] = useState(config?.modo === 'ELEMENTALES' ? 'ELEMENTALES' : 'CARACTERISTICAS');

    // Características
    const [cfg, setCfg] = useState({ ...DEFAULT_RETO_FUN, ...(config?.modo !== 'ELEMENTALES' ? config || {} : {}) });
    const inicial = FUNCIONES_DB.find(f => f.id === Number(cfg.idFuncion));
    const [tipo, setTipo] = useState(inicial?.tipo || 'Todas');
    const tipos = useMemo(() => ['Todas', ...new Set(FUNCIONES_DB.map(f => f.tipo))], []);
    const lista = tipo === 'Todas' ? FUNCIONES_DB : FUNCIONES_DB.filter(f => f.tipo === tipo);
    const sel = FUNCIONES_DB.find(f => f.id === Number(cfg.idFuncion));

    // Representar
    const [tipoElem, setTipoElem] = useState(config?.modo === 'ELEMENTALES' ? config.tipo : 'LINEAL');
    const [p, setP] = useState(() => (config?.modo === 'ELEMENTALES' ? config.p : paramsAleatoriosElem('LINEAL')));
    const defElem = TIPOS_ELEM.find(t => t.id === tipoElem);
    const eqElem = construirElemental(tipoElem, p);
    const cambiarTipoElem = (t) => { setTipoElem(t); setP(paramsAleatoriosElem(t)); };

    const aceptar = () => {
        if (modo === 'ELEMENTALES') {
            if (eqElem.error) return;
            const c = { modo: 'ELEMENTALES', tipo: tipoElem, p: Object.fromEntries(defElem.campos.map(k => [k, Number(p[k])])) };
            onAceptar(c, resumenFunciones(c));
        } else {
            const c = { modo: 'CARACTERISTICAS', idFuncion: cfg.idFuncion, escritura: !!cfg.escritura };
            onAceptar(c, resumenFunciones(c));
        }
    };

    const inputSt = { padding: '8px 9px', borderRadius: 9, border: '1.5px solid #cbd5e1', fontSize: '0.95rem', fontWeight: 700, outline: 'none', fontFamily: 'inherit', width: '100%', boxSizing: 'border-box' };

    return (
        <MarcoConfig titulo="📐 Funciones — ejercicio del reto" color={modo === 'ELEMENTALES' ? VERDE_F : AZUL_F} onClose={onClose} onAceptar={aceptar}>
            <Seccion label="Tipo de ejercicio">
                <Chip active={modo === 'CARACTERISTICAS'} onClick={() => setModo('CARACTERISTICAS')} color={AZUL_F}>📈 Características desde gráfica</Chip>
                <Chip active={modo === 'ELEMENTALES'} onClick={() => setModo('ELEMENTALES')} color={VERDE_F}>✍️ Representar función elemental</Chip>
            </Seccion>

            {modo === 'CARACTERISTICAS' ? (<>
                <Seccion label="Tipo de función">
                    {tipos.map(t => <Chip key={t} active={tipo === t} onClick={() => setTipo(t)} color={AZUL_F}>{t}</Chip>)}
                </Seccion>

                <Seccion label={`Elige la función (${lista.length})`}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: '100%', maxHeight: 190, overflowY: 'auto' }}>
                        {lista.map(f => (
                            <button key={f.id} onClick={() => setCfg(c => ({ ...c, idFuncion: f.id }))}
                                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 11px', borderRadius: 10, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
                                    border: `2px solid ${sel?.id === f.id ? AZUL_F : '#e2e8f0'}`, background: sel?.id === f.id ? '#eaf4fc' : 'white' }}>
                                <span style={{ fontWeight: 800, color: '#94a3b8', minWidth: 34 }}>#{f.id}</span>
                                <span style={{ flex: 1, fontFamily: 'monospace', color: '#2c3e50' }}>{renderLatex(f.latex)}</span>
                                <span style={{ fontSize: '0.7rem', color: '#888' }}>{f.tipo}</span>
                            </button>
                        ))}
                    </div>
                </Seccion>

                {sel && (
                    <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 14 }}>
                        <div style={{ zoom: 0.6, pointerEvents: 'none' }}>
                            <FunctionPlotter fn={sel.fn} range={sel.range} caracteristicas={sel.caracteristicas} />
                        </div>
                    </div>
                )}

                <Seccion label="Cómo responde el alumno">
                    <Chip active={!cfg.escritura} onClick={() => setCfg(c => ({ ...c, escritura: false }))} color={AZUL_F}>🖱️ Elegir opciones</Chip>
                    <Chip active={!!cfg.escritura} onClick={() => setCfg(c => ({ ...c, escritura: true }))} color={AZUL_F}>✏️ Escribir respuesta</Chip>
                </Seccion>
            </>) : (<>
                <Seccion label="Función elemental">
                    {TIPOS_ELEM.map(t => <Chip key={t.id} active={tipoElem === t.id} onClick={() => cambiarTipoElem(t.id)} color={VERDE_F}>{t.emoji} {t.label}</Chip>)}
                </Seccion>

                <Seccion label="Números de la función">
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(96px, 1fr))', gap: 8, width: '100%' }}>
                        {defElem.campos.filter(k => k !== 'base').map(k => (
                            <label key={k} style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: '0.72rem', color: '#64748b', fontWeight: 700 }}>
                                {ETIQUETA_CAMPO_ELEM[k] || k}
                                <input type="number" step="any" value={p[k] ?? ''} onChange={e => setP(prev => ({ ...prev, [k]: e.target.value }))} style={inputSt} />
                            </label>
                        ))}
                    </div>
                    {defElem.campos.includes('base') && (
                        <div style={{ width: '100%', marginTop: 10 }}>
                            <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 700, marginBottom: 6, textAlign: 'center' }}>base</div>
                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'center' }}>
                                {BASES_ELEM[tipoElem].map(b => (
                                    <Chip key={b} active={Math.abs(Number(p.base) - b) < 1e-9} onClick={() => setP(prev => ({ ...prev, base: b }))} color={VERDE_F}>{fmtBase(b)}</Chip>
                                ))}
                            </div>
                        </div>
                    )}
                    <button onClick={() => setP(paramsAleatoriosElem(tipoElem))}
                        style={{ marginTop: 10, padding: '8px 16px', borderRadius: 20, border: `1.5px solid ${VERDE_F}`, background: 'white', color: VERDE_F, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                        🎲 Otra aleatoria
                    </button>
                </Seccion>

                <div style={{ background: eqElem.error ? '#fdecea' : '#eafaf1', color: eqElem.error ? '#c0392b' : '#14532d', borderRadius: 12, padding: '10px 14px', fontSize: '0.95rem', marginBottom: 12, textAlign: 'center', fontWeight: 700 }}>
                    {eqElem.error ? `⚠ ${eqElem.error}` : describirElemental(eqElem)}
                </div>
                <div style={{ fontSize: '0.76rem', color: '#95a5a6', textAlign: 'center' }}>
                    El alumno completa la tabla de valores y las características (asíntotas, vértice, crecimiento…) y representa la función.
                </div>
            </>)}
        </MarcoConfig>
    );
}
