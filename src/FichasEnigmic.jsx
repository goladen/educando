import React from 'react';
import FichasImprimibles from './fichas/FichasImprimibles';
import motorEnigmic from './fichas/motorEnigmic';

// Fichas imprimibles de Enigmic: enigmas de lógica en PDF (pistas + tablero vacío
// + tarjetas para recortar), corrección en el monitor y enlace /enigmic?ficha=ID.
export default function FichasEnigmic(props) {
    return <FichasImprimibles motor={motorEnigmic} {...props} />;
}
