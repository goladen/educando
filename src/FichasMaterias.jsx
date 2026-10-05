import React, { useMemo } from 'react';
import FichasImprimibles from './fichas/FichasImprimibles';
import { motorMateria } from './fichas/motorMaterias';

// ─────────────────────────────────────────────────────────────────────────────
//  Fichas imprimibles de una MATERIA (biologia · geografia · sintaxis · musica):
//  mismo centro que Math World (colecciones listas, galería, PDF, pizarra).
//  Rutas públicas: /fichas/<materia>
// ─────────────────────────────────────────────────────────────────────────────
export default function FichasMaterias({ materia, ...props }) {
    const motor = useMemo(() => motorMateria(materia), [materia]);
    if (!motor) return <div style={{ padding: 40, textAlign: 'center' }}>Materia no disponible.</div>;
    return <FichasImprimibles key={materia} motor={motor} {...props} />;
}
