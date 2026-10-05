import React from 'react';
import FichasMathWorld from './FichasMathWorld';

// Fichas de Fracciones: abre el centro de fichas de Math World con el tema
// «fracciones» preseleccionado. Las fichas antiguas de esta herramienta se leen
// igualmente (y se trasladan a la colección común al abrir «Mis fichas»).
export default function FichasFracciones(props) {
    return <FichasMathWorld tema="fracciones" {...props} />;
}
