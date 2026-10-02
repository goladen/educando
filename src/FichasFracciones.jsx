import React from 'react';
import FichasImprimibles from './fichas/FichasImprimibles';
import { motorFracciones } from './fichas/motorFracciones';

// Fichas imprimibles de Fracciones: motor común (fichas/FichasImprimibles.jsx)
// con el motor de fracciones. Se carga en diferido desde Fracciones.jsx.
export default function FichasFracciones(props) {
    return <FichasImprimibles motor={motorFracciones} {...props} />;
}
