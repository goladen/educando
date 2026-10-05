import React from 'react';
import FichasMathWorld from './FichasMathWorld';

// Fichas de Cálculo Mental: abre el centro de fichas de Math World con el tema
// «calculo» preseleccionado. Las fichas antiguas de esta herramienta se leen
// igualmente (y se trasladan a la colección común al abrir «Mis fichas»).
export default function FichasCalculo(props) {
    return <FichasMathWorld tema="calculo" {...props} />;
}
