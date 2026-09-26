import React, { useState } from 'react';
import { MODOS_SISTEMAS, DIFICULTADES_SISTEMAS, MODOS_CON_DIFICULTAD, MODOS_CON_METODO, DEFAULT_RETO_SIS, resumenSistemas } from '../../EcuacionSistemas';
import { Chip, Seccion, NumeroPreguntas, MarcoConfig } from './ConfigChips';

const MORADO = '#6c5ce7';

// Reto de Sistemas de ecuaciones: tipo, método, dificultad y nº de ejercicios
export default function ConfigSistemasReto({ config, onAceptar, onClose }) {
    const [cfg, setCfg] = useState({ ...DEFAULT_RETO_SIS, ...(config || {}) });
    const set = (k, v) => setCfg(c => ({ ...c, [k]: v }));

    return (
        <MarcoConfig titulo="🚀 Sistemas de ecuaciones — configuración del reto" color={MORADO}
            onClose={onClose} onAceptar={() => onAceptar(cfg, resumenSistemas(cfg))}>
            <Seccion label="Tipo de ejercicio">
                {MODOS_SISTEMAS.map(m => <Chip key={m.id} active={cfg.modo === m.id} onClick={() => set('modo', m.id)} color={MORADO}>{m.label}</Chip>)}
            </Seccion>
            {MODOS_CON_METODO.includes(cfg.modo) && (
                <Seccion label="Método">
                    <Chip active={cfg.subMode === 'reduccion'} onClick={() => set('subMode', 'reduccion')} color={MORADO}>⚡ Reducción</Chip>
                    <Chip active={cfg.subMode === 'sustitucion'} onClick={() => set('subMode', 'sustitucion')} color={MORADO}>💎 Sustitución</Chip>
                </Seccion>
            )}
            {MODOS_CON_DIFICULTAD.includes(cfg.modo) && (
                <Seccion label="Dificultad">
                    {DIFICULTADES_SISTEMAS.map(d => <Chip key={d.id} active={cfg.dificultad === d.id} onClick={() => set('dificultad', d.id)} color={d.color}>{d.label}</Chip>)}
                </Seccion>
            )}
            <Seccion label="Número de ejercicios">
                <NumeroPreguntas valor={cfg.n} onChange={v => set('n', v)} opciones={[3, 5, 8, 10]} color={MORADO} />
            </Seccion>
            <div style={{ fontSize: '0.78rem', color: '#95a5a6', textAlign: 'center' }}>
                Cuenta cada ejercicio terminado (resuelto o con la solución revelada); la puntuación son los aciertos.
            </div>
        </MarcoConfig>
    );
}
