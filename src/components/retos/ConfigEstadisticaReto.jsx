import React, { useState } from 'react';
import { ESTUDIOS_RETO, DEFAULT_RETO_EST, resumenEstadistica } from '../../Estadistica';
import { Seccion, MarcoConfig } from './ConfigChips';

const AZUL_EST = '#3498db';

// Reto de Estadística: el profesor elige el estudio (conceptos → tabla → gráfico)
export default function ConfigEstadisticaReto({ config, onAceptar, onClose }) {
    const [cfg, setCfg] = useState({ ...DEFAULT_RETO_EST, ...(config || {}) });
    return (
        <MarcoConfig titulo="📊 Estadística — configuración del reto" color={AZUL_EST}
            onClose={onClose} onAceptar={() => onAceptar(cfg, resumenEstadistica(cfg))}>
            <Seccion label="Estudio estadístico">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%' }}>
                    {ESTUDIOS_RETO.map(e => (
                        <button key={e.id} onClick={() => setCfg({ estudio: e.id })}
                            style={{ textAlign: 'left', padding: '10px 13px', borderRadius: 12, cursor: 'pointer', fontFamily: 'inherit',
                                border: `2px solid ${cfg.estudio === e.id ? AZUL_EST : '#e2e8f0'}`, background: cfg.estudio === e.id ? '#eaf4fc' : 'white' }}>
                            <div style={{ fontWeight: 700, color: '#2c3e50', fontSize: '0.9rem' }}>{e.titulo}</div>
                            <div style={{ color: '#888', fontSize: '0.76rem' }}>{e.enunciado}</div>
                        </button>
                    ))}
                </div>
            </Seccion>
            <div style={{ fontSize: '0.78rem', color: '#95a5a6', textAlign: 'center' }}>
                Cada alumno recibe datos aleatorios del mismo estudio y pasa por las 3 fases.
            </div>
        </MarcoConfig>
    );
}
