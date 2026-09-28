import React, { useState } from 'react';
import { JUEGOS_LOGICA, DEFAULT_RETO_LOGICA, resumenLogica } from '../../Retos';
import { Chip, Seccion, MarcoConfig } from './ConfigChips';

const NARANJA = '#f39c12';

// Reto de la Sala de Retos: un juego de lógica y un nivel concretos
export default function ConfigLogicaReto({ config, onAceptar, onClose }) {
    const [cfg, setCfg] = useState({ ...DEFAULT_RETO_LOGICA, ...(config || {}) });
    const juego = JUEGOS_LOGICA.find(j => j.id === cfg.juego) || JUEGOS_LOGICA[0];
    const cambiarJuego = (id) => { const j = JUEGOS_LOGICA.find(x => x.id === id); setCfg({ juego: id, nivel: j.niveles[0][0] }); };

    return (
        <MarcoConfig titulo="🧠 Juegos de lógica — configuración del reto" color={NARANJA}
            onClose={onClose} onAceptar={() => onAceptar(cfg, resumenLogica(cfg))}>
            <Seccion label="Juego">
                {JUEGOS_LOGICA.map(j => <Chip key={j.id} active={cfg.juego === j.id} onClick={() => cambiarJuego(j.id)} color={NARANJA}>{j.label}</Chip>)}
            </Seccion>
            <Seccion label={cfg.juego === 'SUDOKU' ? 'Dificultad' : 'Nivel'}>
                {juego.niveles.map(([v, l]) => <Chip key={v} active={String(cfg.nivel) === String(v)} onClick={() => setCfg(c => ({ ...c, nivel: v }))} color={NARANJA}>{l}</Chip>)}
            </Seccion>
            <div style={{ fontSize: '0.78rem', color: '#95a5a6', textAlign: 'center' }}>
                Al superarlo, el alumno envía el resultado con el tiempo empleado (menos tiempo = más puntos).
            </div>
        </MarcoConfig>
    );
}
