import React from 'react';
import { ConfigModal, DEFAULT_CONFIG, resumenFracciones } from '../../Fracciones';

// Editor de configuración de Fracciones para crear un reto (sin jugar).
export default function ConfigFraccionesReto({ config, onAceptar, onClose }) {
    return (
        <ConfigModal
            config={config || DEFAULT_CONFIG}
            onStart={(cfg) => onAceptar(cfg, resumenFracciones(cfg))}
            onClose={onClose}
            titulo="🍰 Fracciones — configuración del reto"
            textoAceptar="✔ Usar esta configuración"
        />
    );
}
