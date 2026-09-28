import React, { useState } from 'react';
import { IMPERIOS_RETO, DEFAULT_RETO_IMPERIOS, resumenImperios } from '../ImperiosGame';
import { Chip, Seccion, MarcoConfig } from './ConfigChips';

const MARRON = '#b45309';

// Reto de Imperios: un imperio concreto (o al azar, cada alumno el suyo)
export default function ConfigImperiosReto({ config, onAceptar, onClose }) {
    const [cfg, setCfg] = useState({ ...DEFAULT_RETO_IMPERIOS, ...(config || {}) });
    return (
        <MarcoConfig titulo="🏛️ Imperios — imperio del reto" color={MARRON}
            onClose={onClose} onAceptar={() => onAceptar(cfg, resumenImperios(cfg))}>
            <Seccion label="Imperio">
                <Chip active={cfg.imperioId === 'AZAR'} onClick={() => setCfg({ imperioId: 'AZAR' })} color={MARRON}>🎲 Al azar</Chip>
                {IMPERIOS_RETO.map(i => <Chip key={i.id} active={cfg.imperioId === i.id} onClick={() => setCfg({ imperioId: i.id })} color={MARRON}>{i.nombre}</Chip>)}
            </Seccion>
            <div style={{ fontSize: '0.78rem', color: '#95a5a6', textAlign: 'center' }}>
                El alumno localiza en el mapa los países del imperio y responde a las preguntas; luego envía el resultado.
            </div>
        </MarcoConfig>
    );
}
