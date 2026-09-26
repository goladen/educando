import React, { useState } from 'react';
import { TIPOS_POT, DEFAULT_RETO_POT, resumenPotencias } from '../../PotenciasRaices';
import { Chip, Seccion, NumeroPreguntas, MarcoConfig } from './ConfigChips';

const AZUL_POT = '#0ea5e9';

// Reto de Potencias y Raíces: una ficha con N ejercicios de cada tipo elegido
export default function ConfigPotenciasReto({ config, onAceptar, onClose }) {
    const [cfg, setCfg] = useState({ ...DEFAULT_RETO_POT, ...(config || {}) });
    const toggle = (id) => setCfg(c => {
        const tipos = c.tipos.includes(id) ? c.tipos.filter(t => t !== id) : [...c.tipos, id];
        return tipos.length ? { ...c, tipos } : c;
    });

    return (
        <MarcoConfig titulo="⚡ Potencias y Raíces — configuración del reto" color={AZUL_POT}
            onClose={onClose} onAceptar={() => onAceptar(cfg, resumenPotencias(cfg))}>
            <Seccion label="Tipos de ejercicio">
                {TIPOS_POT.map(t => <Chip key={t.id} active={cfg.tipos.includes(t.id)} onClick={() => toggle(t.id)} color={AZUL_POT}>{t.label}</Chip>)}
            </Seccion>
            <Seccion label="Ejercicios de cada tipo">
                <NumeroPreguntas valor={cfg.n} onChange={v => setCfg(c => ({ ...c, n: Math.min(v, 15) }))} opciones={[2, 3, 4, 6]} color={AZUL_POT} />
            </Seccion>
            <div style={{ fontSize: '0.78rem', color: '#95a5a6', textAlign: 'center' }}>
                Total: {cfg.n * cfg.tipos.length} ejercicios en una sola ficha · se corrige una vez y se envía.
            </div>
        </MarcoConfig>
    );
}
