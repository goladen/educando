import React, { useState } from 'react';
import { MISIONES_RETO_PA, DEFAULT_RETO_PA, resumenPerimetroArea } from '../../PerimetroArea';
import { Chip, Seccion, MarcoConfig } from './ConfigChips';

const VERDE_PA = '#2E7D32';

// Reto de Perímetros y Áreas (Primaria · Geometría): una misión de 5 niveles
export default function ConfigPerimetroAreaReto({ config, onAceptar, onClose }) {
    const [cfg, setCfg] = useState({ ...DEFAULT_RETO_PA, ...(config || {}) });
    return (
        <MarcoConfig titulo="📏 Perímetros y Áreas — misión del reto" color={VERDE_PA}
            onClose={onClose} onAceptar={() => onAceptar(cfg, resumenPerimetroArea(cfg))}>
            <Seccion label="Misión">
                {MISIONES_RETO_PA.map(([v, l]) => <Chip key={v} active={Number(cfg.mision) === v} onClick={() => setCfg({ mision: v })} color={VERDE_PA}>{l}</Chip>)}
            </Seccion>
            <div style={{ fontSize: '0.78rem', color: '#95a5a6', textAlign: 'center' }}>
                El alumno supera los 5 niveles de la misión y envía el resultado.
            </div>
        </MarcoConfig>
    );
}
