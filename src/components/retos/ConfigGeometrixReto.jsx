import React from 'react';
import { ConfigGeometrixModal, resumenConfigGeo } from '../../Geometrix';

// Editor de configuración de Geometrix para crear un reto (sin jugar).
// Se carga con React.lazy desde ModalElegirHerramienta para no meter el juego
// (three.js incluido) en el bundle del panel del profesor.
export default function ConfigGeometrixReto({ config, onAceptar, onClose }) {
    return (
        <ConfigGeometrixModal
            config={config}
            titulo="📐 Geometrix — configuración del reto"
            textoAceptar="✔ Usar esta configuración"
            onAceptar={(cfg) => onAceptar(cfg, resumenConfigGeo(cfg))}
            onClose={onClose}
        />
    );
}
