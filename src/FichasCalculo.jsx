import React from 'react';
import FichasImprimibles from './fichas/FichasImprimibles';
import { motorCalculo } from './fichas/motorCalculo';

// Fichas imprimibles de Cálculo Mental: motor común (fichas/FichasImprimibles.jsx)
// con el motor de cálculo. Se carga en diferido desde CalculoMental.jsx.
export default function FichasCalculo(props) {
    return <FichasImprimibles motor={motorCalculo} {...props} />;
}
