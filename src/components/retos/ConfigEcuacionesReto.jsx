import React from 'react';
import { ConfigModal, DEFAULT_CONFIG, resumenEcuaciones } from '../../Ecuaciones';

// Editor de configuración de Ecuaciones para crear un reto (sin jugar).
export default function ConfigEcuacionesReto({ config, onAceptar, onClose }) {
    return (
        <ConfigModal
            config={config || DEFAULT_CONFIG}
            onStart={(cfg) => onAceptar(cfg, resumenEcuaciones(cfg))}
            onClose={onClose}
            titulo="🧮 Ecuaciones — configuración del reto"
            textoAceptar="✔ Usar esta configuración"
            modoReto
        />
    );
}
