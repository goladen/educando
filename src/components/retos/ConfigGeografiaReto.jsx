import React, { useState } from 'react';
import { CONTINENTES, AMBITOS_FISICO } from '../GeografiaApp';
import { Chip, Seccion, NumeroPreguntas, MarcoConfig } from './ConfigChips';

const AZULGEO = '#2563eb';
const MODOS = [['mundo', '🌍 Países'], ['provincias', '🗺️ Provincias ESP'], ['fisico', '🏔️ Geo. física'], ['banderas', '🚩 Banderas']];
const TIPOS_FISICO = [['mixto', '🌊⛰️ Mixto'], ['rios', '🌊 Ríos'], ['cordilleras', '⛰️ Cordilleras']];
const TIPOS_BANDERA = [['nombre', '🌍 Nombre del país'], ['capital', '🏛️ Capital'], ['mixto', '🎲 Mixto']];

export const DEFAULT_GEO = {
    modoJuego: 'mundo', continente: 'Europa', ambitoFisico: 'España',
    tipoFisico: 'mixto', tipoPreguntaBandera: 'nombre', modo: 'seleccionar', nPreguntas: 10,
};

export const resumenGeo = (c) => {
    const cfg = { ...DEFAULT_GEO, ...(c || {}) };
    return [
        (MODOS.find(m => m[0] === cfg.modoJuego) || [])[1] || cfg.modoJuego,
        (cfg.modoJuego === 'mundo' || cfg.modoJuego === 'banderas') && `📍 ${cfg.continente}`,
        cfg.modoJuego === 'fisico' && `📍 ${cfg.ambitoFisico} · ${cfg.tipoFisico}`,
        cfg.modoJuego === 'banderas' && `❓ ${cfg.tipoPreguntaBandera}`,
        cfg.modo === 'escribir' ? '✏️ Escribir el nombre' : '🖱️ Elegir opción',
        `🔢 ${cfg.nPreguntas} preguntas`,
    ].filter(Boolean);
};

// Configuración de un reto de Geografía (mapas, provincias, relieve y banderas)
export default function ConfigGeografiaReto({ config, onAceptar, onClose }) {
    const [cfg, setCfg] = useState({ ...DEFAULT_GEO, ...(config || {}) });
    const set = (k, v) => setCfg(c => ({ ...c, [k]: v }));

    return (
        <MarcoConfig titulo="🌍 Geografía — configuración del reto" color={AZULGEO}
            onClose={onClose} onAceptar={() => onAceptar(cfg, resumenGeo(cfg))}>
            <Seccion label="Tipo de preguntas">
                {MODOS.map(([v, l]) => <Chip key={v} active={cfg.modoJuego === v} onClick={() => set('modoJuego', v)} color={AZULGEO}>{l}</Chip>)}
            </Seccion>

            {(cfg.modoJuego === 'mundo' || cfg.modoJuego === 'banderas') && (
                <Seccion label="Zona">
                    {CONTINENTES.map(c => <Chip key={c} active={cfg.continente === c} onClick={() => set('continente', c)} color={AZULGEO}>{c}</Chip>)}
                </Seccion>
            )}

            {cfg.modoJuego === 'banderas' && (
                <Seccion label="Qué se pregunta">
                    {TIPOS_BANDERA.map(([v, l]) => <Chip key={v} active={cfg.tipoPreguntaBandera === v} onClick={() => set('tipoPreguntaBandera', v)} color={AZULGEO}>{l}</Chip>)}
                </Seccion>
            )}

            {cfg.modoJuego === 'fisico' && (
                <>
                    <Seccion label="Ámbito">
                        {AMBITOS_FISICO.map(a => <Chip key={a} active={cfg.ambitoFisico === a} onClick={() => set('ambitoFisico', a)} color={AZULGEO}>{a}</Chip>)}
                    </Seccion>
                    <Seccion label="Accidentes geográficos">
                        {TIPOS_FISICO.map(([v, l]) => <Chip key={v} active={cfg.tipoFisico === v} onClick={() => set('tipoFisico', v)} color={AZULGEO}>{l}</Chip>)}
                    </Seccion>
                </>
            )}

            <Seccion label="Cómo se responde">
                <Chip active={cfg.modo === 'seleccionar'} onClick={() => set('modo', 'seleccionar')} color={AZULGEO}>🖱️ Elegir opción</Chip>
                <Chip active={cfg.modo === 'escribir'} onClick={() => set('modo', 'escribir')} color={AZULGEO}>✏️ Escribir el nombre</Chip>
            </Seccion>
            <Seccion label="Número de preguntas">
                <NumeroPreguntas valor={cfg.nPreguntas} onChange={v => set('nPreguntas', v)} color={AZULGEO} />
            </Seccion>
            <div style={{ fontSize: '0.78rem', color: '#95a5a6', textAlign: 'center' }}>
                La puntuación que se envía a la competición es el número de aciertos.
            </div>
        </MarcoConfig>
    );
}
