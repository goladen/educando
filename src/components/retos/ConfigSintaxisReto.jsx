import React, { useState } from 'react';
import { Chip, Seccion, MarcoConfig } from './ConfigChips';

const AZULSIN = '#3498db';
const IDIOMAS = [['ES', '🇪🇸 Español'], ['CA', '🔶 Català'], ['FR', '🇫🇷 Français']];
// Los niveles son los mismos ids en los tres idiomas (null = todos)
const NIVELES = [[null, '📚 Todos'], ['primaria', '🌱 Primaria'], ['eso', '📖 ESO'], ['bachillerato', '🎓 Bachillerato']];
const TIEMPOS = [120, 180, 300];

export const DEFAULT_SINTAXIS = { idioma: 'ES', nivel: null, duracion: 180 };

export const resumenSintaxis = (c) => {
    const cfg = { ...DEFAULT_SINTAXIS, ...(c || {}) };
    return [
        (IDIOMAS.find(i => i[0] === cfg.idioma) || [])[1] || cfg.idioma,
        (NIVELES.find(n => n[0] === (cfg.nivel ?? null)) || [])[1] || cfg.nivel,
        `⏱ ${cfg.duracion / 60} min a contrarreloj`,
    ].filter(Boolean);
};

// Configuración de un reto de Sintaxis: contrarreloj analizando frases.
// Es el modo con puntuación, así que es el comparable entre participantes.
export default function ConfigSintaxisReto({ config, onAceptar, onClose }) {
    const [cfg, setCfg] = useState({ ...DEFAULT_SINTAXIS, ...(config || {}) });
    const set = (k, v) => setCfg(c => ({ ...c, [k]: v }));

    return (
        <MarcoConfig titulo="🖍️ Sintaxis — configuración del reto" color={AZULSIN}
            onClose={onClose} onAceptar={() => onAceptar(cfg, resumenSintaxis(cfg))}>
            <div style={{ fontSize: '0.82rem', color: '#7f8c8d', textAlign: 'center', marginBottom: 16 }}>
                El reto se juega <strong>a contrarreloj</strong>: analizar el máximo de frases posible en el tiempo fijado.
            </div>
            <Seccion label="Idioma">
                {IDIOMAS.map(([v, l]) => <Chip key={v} active={cfg.idioma === v} onClick={() => set('idioma', v)} color={AZULSIN}>{l}</Chip>)}
            </Seccion>
            <Seccion label="Nivel de las frases">
                {NIVELES.map(([v, l]) => <Chip key={String(v)} active={(cfg.nivel ?? null) === v} onClick={() => set('nivel', v)} color={AZULSIN}>{l}</Chip>)}
            </Seccion>
            <Seccion label="Tiempo">
                {TIEMPOS.map(t => <Chip key={t} active={cfg.duracion === t} onClick={() => set('duracion', t)} color={AZULSIN}>{t / 60} min</Chip>)}
            </Seccion>
            <div style={{ fontSize: '0.78rem', color: '#95a5a6', textAlign: 'center' }}>
                La puntuación que se envía a la competición son los puntos conseguidos en ese tiempo.
            </div>
        </MarcoConfig>
    );
}
