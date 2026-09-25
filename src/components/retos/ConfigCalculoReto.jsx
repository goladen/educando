import React from 'react';
import { ConfigModal, DEFAULT_CONFIG, resumenConfig } from '../../CalculoMental';

// Editor de configuración de Cálculo Mental para crear un reto (sin jugar).
// Se carga con React.lazy desde ModalElegirHerramienta para no meter el juego
// entero en el bundle del panel del profesor.
export default function ConfigCalculoReto({ config, onAceptar, onClose }) {
    return (
        <ConfigModal
            config={config || DEFAULT_CONFIG}
            onStart={(cfg) => onAceptar(cfg, resumenConfig(cfg))}
            onClose={onClose}
            textoAceptar="✔ Usar esta configuración"
            ocultarCompartir
        />
    );
}
