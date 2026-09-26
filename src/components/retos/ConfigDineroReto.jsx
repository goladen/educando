import React from 'react';
import { ConfigModal, DEFAULT_CONFIG, resumenDinero } from '../../CalculoDinero';

// Editor de configuración de Cálculo con dinero para crear un reto (sin jugar).
export default function ConfigDineroReto({ config, onAceptar, onClose }) {
    return (
        <ConfigModal
            config={config || DEFAULT_CONFIG}
            onStart={(cfg) => onAceptar(cfg, resumenDinero(cfg))}
            onClose={onClose}
            titulo="💶 Cálculo con dinero — configuración del reto"
            textoAceptar="✔ Usar esta configuración"
        />
    );
}
