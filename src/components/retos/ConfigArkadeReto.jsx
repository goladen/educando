import React, { useState } from 'react';
import { JUEGOS_ARKADE, DEFAULT_RETO_ARKADE, resumenArkade } from '../../MiniArcade/ArkadeHub';
import { Chip, Seccion, MarcoConfig } from './ConfigChips';

const MORADO_A = '#8e44ad';

// Enlace a un minijuego concreto de Arkade y, si tiene, su modo (dificultad / jugadores)
export default function ConfigArkadeReto({ config, onAceptar, onClose }) {
    const [cfg, setCfg] = useState({ ...DEFAULT_RETO_ARKADE, ...(config || {}) });
    const juego = JUEGOS_ARKADE.find(j => j.id === cfg.juego) || JUEGOS_ARKADE[0];
    const elegir = (id) => { const j = JUEGOS_ARKADE.find(x => x.id === id); setCfg({ juego: id, modo: j.modos ? j.modos[0][0] : null }); };

    return (
        <MarcoConfig titulo="🕹️ Arkade — ¿qué minijuego compartes?" color={MORADO_A} textoAceptar="✔ Crear enlace"
            onClose={onClose} onAceptar={() => onAceptar(cfg, resumenArkade(cfg))}>
            <Seccion label="Minijuego">
                {JUEGOS_ARKADE.map(j => <Chip key={j.id} active={cfg.juego === j.id} onClick={() => elegir(j.id)} color={MORADO_A}>{j.label}</Chip>)}
            </Seccion>
            {juego.modos && (
                <Seccion label={juego.id === 'PONG' ? 'Jugadores' : 'Dificultad'}>
                    {juego.modos.map(([v, l]) => <Chip key={v} active={cfg.modo === v} onClick={() => setCfg(c => ({ ...c, modo: v }))} color={MORADO_A}>{l}</Chip>)}
                </Seccion>
            )}
            <div style={{ fontSize: '0.78rem', color: '#95a5a6', textAlign: 'center' }}>
                El enlace abre directamente ese minijuego{juego.modos ? ' con ese modo' : ''}.
            </div>
        </MarcoConfig>
    );
}
