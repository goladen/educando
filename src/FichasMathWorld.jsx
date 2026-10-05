import React, { useMemo } from 'react';
import FichasImprimibles from './fichas/FichasImprimibles';
import { motorConTema } from './fichas/motorMathWorld';

// ─────────────────────────────────────────────────────────────────────────────
//  📚 FICHAS DE MATH WORLD — centro único de fichas imprimibles de matemáticas
//  (todas las herramientas de Math World y Primaria). Ruta pública /fichas.
//  `tema` preselecciona un tema (al abrirlo desde Fracciones, Cálculo, Dinero…).
// ─────────────────────────────────────────────────────────────────────────────
export default function FichasMathWorld({ tema = null, ...props }) {
    const motor = useMemo(() => motorConTema(tema), [tema]);
    return <FichasImprimibles motor={motor} {...props} />;
}
