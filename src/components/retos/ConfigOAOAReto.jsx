import React, { useState } from 'react';
import { ACTIVIDADES_OAOA, DEFAULT_RETO_OAOA, resumenOAOA } from '../../MetodoOAOA';
import { Chip, Seccion, MarcoConfig } from './ConfigChips';

const TEAL = '#0d9488';

// Reto del Método OAOA: una actividad concreta y, si tiene, su modo de inicio
// En competición no se ofrece «Caminos flexibles» (es texto libre, sin puntuación)
export default function ConfigOAOAReto({ config, onAceptar, onClose, enCompeticion = false }) {
    const [cfg, setCfg] = useState(() => {
        const c = { ...DEFAULT_RETO_OAOA, ...(config || {}) };
        return enCompeticion && c.actividad === 'paths' ? DEFAULT_RETO_OAOA : c;
    });
    const act = ACTIVIDADES_OAOA.find(a => a.id === cfg.actividad) || ACTIVIDADES_OAOA[0];
    const elegir = (id) => { const a = ACTIVIDADES_OAOA.find(x => x.id === id); setCfg({ actividad: id, modo: a.modos ? a.modos[0][0] : null }); };

    return (
        <MarcoConfig titulo="🧮 Método OAOA — actividad del reto" color={TEAL}
            onClose={onClose} onAceptar={() => onAceptar(cfg, resumenOAOA(cfg))}>
            <Seccion label="Actividad">
                {ACTIVIDADES_OAOA.filter(a => !enCompeticion || a.id !== 'paths').map(a => <Chip key={a.id} active={cfg.actividad === a.id} onClick={() => elegir(a.id)} color={TEAL}>{a.label}</Chip>)}
            </Seccion>
            {act.modos && (
                <Seccion label="Empieza en">
                    {act.modos.map(([v, l]) => <Chip key={v} active={cfg.modo === v} onClick={() => setCfg(c => ({ ...c, modo: v }))} color={TEAL}>{l}</Chip>)}
                </Seccion>
            )}
            <div style={{ fontSize: '0.78rem', color: '#95a5a6', textAlign: 'center' }}>
                El alumno entra directamente en la actividad y, al terminar, envía el recopilatorio con el botón «📤 Enviar».
            </div>
        </MarcoConfig>
    );
}
