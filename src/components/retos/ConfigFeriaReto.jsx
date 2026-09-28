import React, { useState } from 'react';
import { MODOS_FERIA, OPS_FERIA, TIPOS_NUM_FERIA, DEFAULT_RETO_FERIA, resumenFeria } from '../../FeriaMates';
import { Chip, Seccion, MarcoConfig } from './ConfigChips';

const NARANJA_F = '#e67e22';

// Reto de la Feria del Cálculo: modo de juego + tipo de números, operaciones y tiempo
export default function ConfigFeriaReto({ config, onAceptar, onClose }) {
    const [cfg, setCfg] = useState({ ...DEFAULT_RETO_FERIA, ...(config || {}) });
    const set = (k, v) => setCfg(c => ({ ...c, [k]: v }));
    const toggleOp = (op) => setCfg(c => {
        const tiposOp = c.tiposOp.includes(op) ? c.tiposOp.filter(o => o !== op) : [...c.tiposOp, op];
        return tiposOp.length ? { ...c, tiposOp } : c;
    });

    return (
        <MarcoConfig titulo="🎡 Feria del Cálculo — configuración del reto" color={NARANJA_F}
            onClose={onClose} onAceptar={() => onAceptar(cfg, resumenFeria(cfg))}>
            <Seccion label="Modo de juego">
                {MODOS_FERIA.map(([v, l]) => <Chip key={v} active={cfg.modo === v} onClick={() => set('modo', v)} color={NARANJA_F}>{l}</Chip>)}
            </Seccion>
            {cfg.modo !== 'tiron' ? (<>
                <Seccion label="Tipo de números">
                    {TIPOS_NUM_FERIA.map(([v, l]) => <Chip key={v} active={cfg.tipoNum === v} onClick={() => set('tipoNum', v)} color={NARANJA_F}>{l}</Chip>)}
                </Seccion>
                <Seccion label="Operaciones">
                    {OPS_FERIA.map(([v, l]) => <Chip key={v} active={cfg.tiposOp.includes(v)} onClick={() => toggleOp(v)} color={NARANJA_F}>{l}</Chip>)}
                </Seccion>
                <Seccion label="Tiempo por pregunta">
                    {[8, 10, 14, 20].map(t => <Chip key={t} active={Number(cfg.tiempoPregunta) === t} onClick={() => set('tiempoPregunta', t)} color={NARANJA_F}>{t} s</Chip>)}
                </Seccion>
                <div style={{ fontSize: '0.78rem', color: '#95a5a6', textAlign: 'center' }}>
                    {cfg.modo === 'globos' ? 'Partida de 2 minutos; al terminar el alumno envía sus puntos.' : 'Modo para 2 jugadores en la misma pantalla (no envía resultados).'}
                </div>
            </>) : (
                <div style={{ fontSize: '0.8rem', color: '#95a5a6', textAlign: 'center' }}>El tirón de cuerda se abre directamente con sus propios ajustes.</div>
            )}
        </MarcoConfig>
    );
}
