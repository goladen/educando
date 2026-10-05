import React from 'react';
import FichasMathWorld from './FichasMathWorld';

// Fichas de Cálculo con Dinero: abre el centro de fichas de Math World con el tema
// «dinero» preseleccionado. Las fichas antiguas de esta herramienta se leen
// igualmente (y se trasladan a la colección común al abrir «Mis fichas»).
export default function FichasDinero(props) {
    return <FichasMathWorld tema="dinero" {...props} />;
}
