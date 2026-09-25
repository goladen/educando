import React, { useState } from 'react';
import { SYSTEM_LABEL, SYSTEM_EMOJI } from '../BiologiaApp';
import { Chip, Seccion, NumeroPreguntas, MarcoConfig } from './ConfigChips';

const VERDE = '#16a34a';
const NIVELES = [['basico', 'Básico'], ['medio', 'Medio'], ['pro', 'Avanzado']];

export const DEFAULT_BIO = { modoJuego: 'cuerpo', nivel: 'basico', modo: 'seleccionar', nPreguntas: 10 };

export const resumenBio = (c) => {
    const cfg = { ...DEFAULT_BIO, ...(c || {}) };
    const conNivel = cfg.modoJuego === 'musculos' || cfg.modoJuego === 'huesos';
    return [
        `${SYSTEM_EMOJI[cfg.modoJuego] || '🔬'} ${SYSTEM_LABEL[cfg.modoJuego] || cfg.modoJuego}`,
        conNivel && `⭐ ${(NIVELES.find(n => n[0] === cfg.nivel) || [])[1] || cfg.nivel}`,
        cfg.modo === 'escribir' ? '✏️ Escribir el nombre' : '🖱️ Elegir opción',
        `🔢 ${cfg.nPreguntas} preguntas`,
    ].filter(Boolean);
};

// Configuración de un reto de Biología (preguntas de anatomía sobre la silueta)
export default function ConfigBiologiaReto({ config, onAceptar, onClose }) {
    const [cfg, setCfg] = useState({ ...DEFAULT_BIO, ...(config || {}) });
    const set = (k, v) => setCfg(c => ({ ...c, [k]: v }));
    const conNivel = cfg.modoJuego === 'musculos' || cfg.modoJuego === 'huesos';

    return (
        <MarcoConfig titulo="🔬 Biología — configuración del reto" color={VERDE}
            onClose={onClose} onAceptar={() => onAceptar(cfg, resumenBio(cfg))}>
            <Seccion label="Sistema / parte del cuerpo">
                {Object.keys(SYSTEM_LABEL).map(m => (
                    <Chip key={m} active={cfg.modoJuego === m} onClick={() => set('modoJuego', m)} color={VERDE}>
                        {SYSTEM_EMOJI[m]} {SYSTEM_LABEL[m]}
                    </Chip>
                ))}
            </Seccion>
            {conNivel && (
                <Seccion label="Nivel">
                    {NIVELES.map(([v, l]) => <Chip key={v} active={cfg.nivel === v} onClick={() => set('nivel', v)} color={VERDE}>{l}</Chip>)}
                </Seccion>
            )}
            <Seccion label="Cómo se responde">
                <Chip active={cfg.modo === 'seleccionar'} onClick={() => set('modo', 'seleccionar')} color={VERDE}>🖱️ Elegir opción</Chip>
                <Chip active={cfg.modo === 'escribir'} onClick={() => set('modo', 'escribir')} color={VERDE}>✏️ Escribir el nombre</Chip>
            </Seccion>
            <Seccion label="Número de preguntas">
                <NumeroPreguntas valor={cfg.nPreguntas} onChange={v => set('nPreguntas', v)} color={VERDE} />
            </Seccion>
            <div style={{ fontSize: '0.78rem', color: '#95a5a6', textAlign: 'center' }}>
                La puntuación que se envía a la competición es el número de aciertos.
            </div>
        </MarcoConfig>
    );
}
