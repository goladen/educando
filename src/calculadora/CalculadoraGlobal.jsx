// Botón 🧮 de la Casio fx-82MS interactiva SIEMPRE a mano en cualquier parte de
// Matemáticas (Math World, Primaria, fichas, cada app…) y de Física y Química
// (menú, simuladores, cambio de unidades…). Se monta una sola vez en main.jsx y
// mira la URL; si la app ya pinta su propio BotonCalculadora (data-calc-local),
// este se oculta para no duplicarlo.
import React, { lazy, Suspense, useEffect, useState } from 'react';

const BotonCalculadora = lazy(() => import('./BotonCalculadora'));

// Rutas (sin la barra inicial) donde tiene que estar la calculadora
const RUTAS_FISICA = /^(fisica(\/.*)?|fyq|fisica-y-quimica)$/;
const RUTAS_MATES = /^(math_world|mates|matematicas|primaria(\/.*)?|fichas(\/.*)?|calculo|fracciones|geometrix|ecuaciones|funciones|álgebra|algebra|polinomios|estadística|estadistica|probabilidad|potencias(_raices)?|ecuacion_sistemas|sistemas|dinero|geometría_analítica|geometria_analitica|pizarras_?verticales|feria|unidades)$/;

const zonaDe = (path) => (RUTAS_FISICA.test(path) ? 'fisica' : RUTAS_MATES.test(path) ? 'mates' : null);
const rutaActual = () => {
    try { return decodeURIComponent(window.location.pathname).replace(/^\/+|\/+$/g, '').toLowerCase(); } catch { return ''; }
};

const BLOQUES = {
    fisica: ['cientifica', 'potencias', 'constantes', 'trigonometria', 'combinadas'],
    mates: ['combinadas', 'fracciones', 'potencias', 'cientifica', 'trigonometria'],
};

export default function CalculadoraGlobal() {
    const [estado, setEstado] = useState({ zona: null, local: false });
    useEffect(() => {
        const mirar = () => {
            const zona = zonaDe(rutaActual());
            const local = !!document.querySelector('[data-calc-local]');
            setEstado((e) => (e.zona === zona && e.local === local ? e : { zona, local }));
        };
        mirar();
        // pushState no avisa: además del popstate se mira cada poco (es muy barato)
        const t = setInterval(mirar, 800);
        window.addEventListener('popstate', mirar);
        return () => { clearInterval(t); window.removeEventListener('popstate', mirar); };
    }, []);
    if (!estado.zona || estado.local) return null;
    return (
        <Suspense fallback={null}>
            <BotonCalculadora global bloques={BLOQUES[estado.zona]} app={estado.zona === 'fisica' ? 'FISICA' : 'MATES'} />
        </Suspense>
    );
}
