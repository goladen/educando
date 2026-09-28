import React, { useState } from 'react';
import { JUEGOS_DIVISIBILIDAD, DEFAULT_RETO_DIVIS, resumenDivisibilidad } from '../../Divisibilidad';
import { Chip, Seccion, MarcoConfig } from './ConfigChips';

const MORADO_D = '#7B1FA2';

// Reto de Divisibilidad (Primaria): un minijuego concreto
// En competición solo los minijuegos con puntuación (primos, múltiplos, divisores)
const CON_PUNTOS = ['primes', 'multiples', 'divisors'];

export default function ConfigDivisibilidadReto({ config, onAceptar, onClose, enCompeticion = false }) {
    const [cfg, setCfg] = useState(() => {
        const c = { ...DEFAULT_RETO_DIVIS, ...(config || {}) };
        return enCompeticion && !CON_PUNTOS.includes(c.juego) ? { juego: 'primes' } : c;
    });
    return (
        <MarcoConfig titulo="🔢 Divisibilidad — minijuego del reto" color={MORADO_D}
            onClose={onClose} onAceptar={() => onAceptar(cfg, resumenDivisibilidad(cfg))}>
            <Seccion label="Minijuego">
                {JUEGOS_DIVISIBILIDAD.filter(([v]) => !enCompeticion || CON_PUNTOS.includes(v)).map(([v, l]) => <Chip key={v} active={cfg.juego === v} onClick={() => setCfg({ juego: v })} color={MORADO_D}>{l}</Chip>)}
            </Seccion>
            <div style={{ fontSize: '0.78rem', color: '#95a5a6', textAlign: 'center' }}>
                Primos, múltiplos y divisores tienen puntuación y «Enviar al profesor»; la criba, la tabla y «Descubre» son de exploración.
            </div>
        </MarcoConfig>
    );
}
