import React, { useState } from 'react';
import { TIPOS_RETO_GEO, ETIQUETA_CAMPO, paramsAleatorios, construirEjercicio, describirEjercicio, resumenGeoAnalitica } from '../../Funciones2';
import { Chip, Seccion, MarcoConfig } from './ConfigChips';

const AZUL_G = '#3498db';

// Reto de Geometría analítica: UN ejercicio concreto con los números del profesor
export default function ConfigGeoAnaliticaReto({ config, onAceptar, onClose }) {
    const [tipo, setTipo] = useState(config?.tipo || 'DOS_PUNTOS');
    const [p, setP] = useState(() => config?.p || paramsAleatorios(config?.tipo || 'DOS_PUNTOS'));
    const def = TIPOS_RETO_GEO.find(t => t.id === tipo);
    const eq = construirEjercicio(tipo, p);

    const cambiarTipo = (t) => { setTipo(t); setP(paramsAleatorios(t)); };
    const aceptar = () => {
        if (eq.error) return;
        const cfg = { tipo, p: Object.fromEntries(def.campos.map(k => [k, Number(p[k])])) };
        onAceptar(cfg, resumenGeoAnalitica(cfg, true));
    };

    return (
        <MarcoConfig titulo="∫ Geometría analítica — ejercicio del reto" color={AZUL_G} onClose={onClose} onAceptar={aceptar}>
            <Seccion label="Tipo de ejercicio">
                {TIPOS_RETO_GEO.map(t => <Chip key={t.id} active={tipo === t.id} onClick={() => cambiarTipo(t.id)} color={AZUL_G}>{t.emoji} {t.label}</Chip>)}
            </Seccion>

            <Seccion label="Números del ejercicio">
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(96px, 1fr))', gap: 8, width: '100%' }}>
                    {def.campos.map(k => (
                        <label key={k} style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: '0.72rem', color: '#64748b', fontWeight: 700 }}>
                            {ETIQUETA_CAMPO[k] || k}
                            <input type="number" step="any" value={p[k] ?? ''} onChange={e => setP(prev => ({ ...prev, [k]: e.target.value }))}
                                style={{ padding: '8px 9px', borderRadius: 9, border: '1.5px solid #cbd5e1', fontSize: '0.95rem', fontWeight: 700, outline: 'none', fontFamily: 'inherit', width: '100%', boxSizing: 'border-box' }} />
                        </label>
                    ))}
                </div>
                <button onClick={() => setP(paramsAleatorios(tipo))}
                    style={{ marginTop: 10, padding: '8px 16px', borderRadius: 20, border: `1.5px solid ${AZUL_G}`, background: 'white', color: AZUL_G, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                    🎲 Otro aleatorio
                </button>
            </Seccion>

            <div style={{ background: eq.error ? '#fdecea' : '#eaf4fc', color: eq.error ? '#c0392b' : '#1e3a5f', borderRadius: 12, padding: '10px 14px', fontSize: '0.86rem', marginBottom: 12, lineHeight: 1.5 }}>
                {eq.error ? `⚠ ${eq.error}` : <><strong>Vista previa:</strong> {describirEjercicio(eq, true)}</>}
            </div>
            <div style={{ fontSize: '0.76rem', color: '#95a5a6', textAlign: 'center' }}>
                La solución (tras la flecha) solo la ves tú. Todos los alumnos resuelven exactamente este ejercicio.
            </div>
        </MarcoConfig>
    );
}
