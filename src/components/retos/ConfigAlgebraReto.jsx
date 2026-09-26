import React, { useState } from 'react';
import { MODULOS_ALGEBRA, DEFAULT_RETO_ALG, resumenAlgebra } from '../../Algebra';
import { Chip, Seccion, NumeroPreguntas, MarcoConfig } from './ConfigChips';

const MORADO = '#9b59b6';

// Reto de Álgebra: módulos disponibles y nº de ejercicios a completar
export default function ConfigAlgebraReto({ config, onAceptar, onClose }) {
    const [cfg, setCfg] = useState({ ...DEFAULT_RETO_ALG, ...(config || {}) });
    const toggle = (id) => setCfg(c => {
        const modulos = c.modulos.includes(id) ? c.modulos.filter(m => m !== id) : [...c.modulos, id];
        return modulos.length ? { ...c, modulos } : c;
    });

    return (
        <MarcoConfig titulo="✖️ Álgebra — configuración del reto" color={MORADO}
            onClose={onClose} onAceptar={() => onAceptar(cfg, resumenAlgebra(cfg))}>
            <Seccion label="Módulos disponibles">
                {MODULOS_ALGEBRA.map(m => <Chip key={m.id} active={cfg.modulos.includes(m.id)} onClick={() => toggle(m.id)} color={MORADO}>{m.label}</Chip>)}
            </Seccion>
            <Seccion label="Ejercicios a completar">
                <NumeroPreguntas valor={cfg.n} onChange={v => setCfg(c => ({ ...c, n: v }))} opciones={[5, 10, 15, 20]} color={MORADO} />
            </Seccion>
            <div style={{ fontSize: '0.78rem', color: '#95a5a6', textAlign: 'center' }}>
                El alumno solo ve estos módulos; al llegar al nº de ejercicios puede enviar el resultado (puntuación = aciertos).
            </div>
        </MarcoConfig>
    );
}
