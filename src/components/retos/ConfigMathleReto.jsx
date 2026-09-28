import React, { useState } from 'react';
import { OPERACIONES_MATHLE, DEFAULT_RETO_MATHLE, resumenMathle } from '../../MathWordleGame';
import { Chip, Seccion, MarcoConfig } from './ConfigChips';

const VERDE_M = '#538d4e';

// Reto de MathLe: operación y cifras por número (todos adivinan con las mismas reglas)
export default function ConfigMathleReto({ config, onAceptar, onClose }) {
    const [cfg, setCfg] = useState({ ...DEFAULT_RETO_MATHLE, ...(config || {}) });
    return (
        <MarcoConfig titulo="🧮 MathLe — configuración del reto" color={VERDE_M}
            onClose={onClose} onAceptar={() => onAceptar(cfg, resumenMathle(cfg))}>
            <Seccion label="Operación">
                {OPERACIONES_MATHLE.map(([v, l]) => <Chip key={v} active={cfg.operacion === v} onClick={() => setCfg(c => ({ ...c, operacion: v }))} color={VERDE_M}>{l}</Chip>)}
            </Seccion>
            <Seccion label="Cifras por número">
                {[2, 3, 4].map(n => <Chip key={n} active={cfg.cifras === n} onClick={() => setCfg(c => ({ ...c, cifras: n }))} color={VERDE_M}>{n} cifras</Chip>)}
            </Seccion>
            <div style={{ fontSize: '0.78rem', color: '#95a5a6', textAlign: 'center' }}>
                Cada alumno recibe una operación aleatoria con estas reglas; se envían el tiempo y los intentos.
            </div>
        </MarcoConfig>
    );
}
