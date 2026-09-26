import React, { useState, Suspense, lazy } from 'react';
import { X, RefreshCw, Wrench } from 'lucide-react';
import { crearRutaReto } from '../utils/retoLink';

const AZUL = '#1565C0';

// ─── Herramientas de Math World que se pueden añadir ya configuradas ──────────
// Para añadir una nueva: una entrada aquí + su editor en ./retos/ConfigXxx.jsx
// (recibe { config, onAceptar(cfg, resumen), onClose }).
export const HERRAMIENTAS_RETO = [
    {
        id: 'CALCULO', label: 'Cálculo Mental', emoji: '🧠', color: '#E91E63', ruta: '/calculo',
        desc: 'Operaciones a contrarreloj o por número de ejercicios · rango, tipos de números y operaciones a elegir',
    },
    {
        id: 'GEOMETRIX', label: 'Geometrix', emoji: '📐', color: '#009688', ruta: '/geometrix',
        desc: 'Áreas, perímetros y volúmenes · figuras 2D y 3D, modo fórmulas o regla, nº de ejercicios',
    },
    {
        id: 'FRACCIONES', label: 'Fracciones', emoji: '🍰', color: '#7b1fa2', ruta: '/fracciones',
        desc: 'Identificar, simplificar, operar, potencias y raíces · nivel y tiempo o nº de ejercicios',
    },
    {
        id: 'ECUACIONES', label: 'Ecuaciones', emoji: '🧮', color: '#3498db', ruta: '/ecuaciones',
        desc: 'Primer y segundo grado, paréntesis, denominadores y enunciados · rango y tiempo',
    },
    {
        id: 'POTENCIAS_RAICES', label: 'Potencias y Raíces', emoji: '⚡', color: '#0ea5e9', ruta: '/potencias_raices',
        desc: 'Ficha de potencias, propiedades, raíces y notación científica · tipos y nº de ejercicios',
    },
    {
        id: 'ECUACION_SISTEMAS', label: 'Sistemas de ecuaciones', emoji: '🚀', color: '#6c5ce7', ruta: '/ecuacion_sistemas',
        desc: '2x2, fracciones, Gauss 3x3, método gráfico o problemas · método, dificultad y nº de ejercicios',
    },
    {
        id: 'POLINOMIOS', label: 'Álgebra', emoji: '✖️', color: '#9b59b6', ruta: '/polinomios',
        desc: 'Monomios, polinomios, Ruffini, identidades notables y factorización · módulos y nº de ejercicios',
    },
    {
        id: 'DINERO', label: 'Cálculo con dinero', emoji: '💶', color: '#16a085', ruta: '/dinero',
        desc: 'Pagar, la vuelta, precio total y por unidad, IVA, rebajas y lista de la compra',
    },
    {
        id: 'ESTADISTICA', label: 'Estadística', emoji: '📊', color: '#3498db', ruta: '/estadistica',
        desc: 'Un estudio estadístico en 3 fases: conceptos, tabla de frecuencias y gráfico',
    },
    {
        id: 'FUNCIONES', label: 'Funciones', emoji: '📐', color: '#3498db', ruta: '/funciones',
        desc: 'Un ejercicio concreto: características desde la gráfica o representar una función elemental',
    },
    {
        id: 'GEOMETRÍA_ANALÍTICA', label: 'Geometría analítica', emoji: '∫', color: '#3498db', ruta: '/geometria_analitica',
        desc: 'Un ejercicio concreto de rectas, vectores o parábolas con los números que elijas',
    },
    {
        id: 'LISTENING', label: 'Listening', emoji: '🎧', color: '#8E44AD', ruta: '/?juego=listening',
        desc: 'Un audio concreto en inglés o francés · elegir entre opciones o escribir las palabras',
    },
    {
        id: 'IRREGULAR_VERBS', label: 'Irregular Verbs', emoji: '📝', color: '#0369a1', ruta: '/irregular_verbs',
        desc: 'Test de verbos irregulares · nivel o verbos concretos, columnas y tiempo',
    },
    {
        id: 'SINTAXIS', label: 'Sintaxis', emoji: '🖍️', color: '#3498db', ruta: '/?juego=sintaxis',
        desc: 'Analizar frases a contrarreloj · español, català o français, por nivel y tiempo',
    },
    {
        id: 'BIOLOGIA', label: 'Biología', emoji: '🔬', color: '#16a34a', ruta: '/?juego=biologia',
        desc: 'Anatomía sobre la silueta · huesos, músculos y sistemas, eligiendo o escribiendo',
    },
    {
        id: 'GEOGRAFIA', label: 'Geografía', emoji: '🌍', color: '#2563eb', ruta: '/?juego=geografia',
        desc: 'Países, provincias, relieve y banderas · por continente y nº de preguntas',
    },
];

const EDITORES = {
    CALCULO: lazy(() => import('./retos/ConfigCalculoReto')),
    GEOMETRIX: lazy(() => import('./retos/ConfigGeometrixReto')),
    FRACCIONES: lazy(() => import('./retos/ConfigFraccionesReto')),
    ECUACIONES: lazy(() => import('./retos/ConfigEcuacionesReto')),
    POTENCIAS_RAICES: lazy(() => import('./retos/ConfigPotenciasReto')),
    ECUACION_SISTEMAS: lazy(() => import('./retos/ConfigSistemasReto')),
    POLINOMIOS: lazy(() => import('./retos/ConfigAlgebraReto')),
    DINERO: lazy(() => import('./retos/ConfigDineroReto')),
    ESTADISTICA: lazy(() => import('./retos/ConfigEstadisticaReto')),
    FUNCIONES: lazy(() => import('./retos/ConfigFuncionesReto')),
    GEOMETRÍA_ANALÍTICA: lazy(() => import('./retos/ConfigGeoAnaliticaReto')),
    LISTENING: lazy(() => import('./retos/ConfigListeningReto')),
    IRREGULAR_VERBS: lazy(() => import('./retos/ConfigVerbosReto')),
    SINTAXIS: lazy(() => import('./retos/ConfigSintaxisReto')),
    BIOLOGIA: lazy(() => import('./retos/ConfigBiologiaReto')),
    GEOGRAFIA: lazy(() => import('./retos/ConfigGeografiaReto')),
};

export const herramientaPorId = (id) => HERRAMIENTAS_RETO.find(h => h.id === id) || null;

/**
 * Elegir una herramienta y configurarla. Devuelve por `onElegir` los campos que
 * hay que guardar: la ruta ya lleva la configuración dentro (?reto=…), así que
 * todos los participantes juegan exactamente igual.
 */
export default function ModalElegirHerramienta({ tituloReto = '', configInicial = null, herramientaInicial = null, compId = null, catId = null, onElegir, onClose }) {
    const [sel, setSel] = useState(herramientaInicial ? herramientaPorId(herramientaInicial) : null);

    if (sel) {
        const Editor = EDITORES[sel.id];
        const aceptar = (cfg, resumen) => onElegir({
            herramientaId: sel.id,
            herramientaTitulo: sel.label,
            herramientaRuta: crearRutaReto(sel.ruta, cfg, { titulo: tituloReto, compId, catId }),
            herramientaResumen: resumen || [],
            herramientaConfig: cfg,
        });
        return (
            <Suspense fallback={<div style={st.overlay}><div style={{ ...st.panel, textAlign: 'center' }}><RefreshCw size={24} style={{ animation: 'spin 1s linear infinite', color: AZUL }} /><div style={{ marginTop: 10, color: '#7f8c8d' }}>Cargando {sel.label}…</div><style>{`@keyframes spin{100%{transform:rotate(360deg)}}`}</style></div></div>}>
                <Editor config={configInicial} onAceptar={aceptar} onClose={() => (herramientaInicial ? onClose() : setSel(null))} />
            </Suspense>
        );
    }

    return (
        <div style={st.overlay} onClick={onClose}>
            <div style={st.panel} onClick={e => e.stopPropagation()}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <div style={{ fontWeight: 800, color: '#2c3e50', fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Wrench size={19} color={AZUL} /> Añadir una herramienta
                    </div>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#95a5a6' }}><X size={20} /></button>
                </div>
                <p style={{ color: '#7f8c8d', fontSize: '0.86rem', margin: '0 0 16px', lineHeight: 1.5 }}>
                    Elige una herramienta y configúrala (tiempo, tipos de números, operaciones…).
                    Todos los participantes la abrirán con <strong>esa misma configuración</strong>.
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {HERRAMIENTAS_RETO.map(h => (
                        <button key={h.id} onClick={() => setSel(h)}
                            style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '13px 16px', background: 'white', border: `2px solid ${h.color}`, borderRadius: 14, cursor: 'pointer', textAlign: 'left', width: '100%', fontFamily: 'inherit' }}>
                            <div style={{ background: h.color, borderRadius: 12, width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.4rem', flexShrink: 0 }}>{h.emoji}</div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontWeight: 700, color: '#2c3e50', fontSize: '0.98rem' }}>{h.label}</div>
                                <div style={{ color: '#888', fontSize: '0.8rem' }}>{h.desc}</div>
                            </div>
                            <span style={{ color: h.color, fontSize: '1.3rem' }}>›</span>
                        </button>
                    ))}
                </div>
                <div style={{ marginTop: 14, fontSize: '0.78rem', color: '#95a5a6' }}>
                    Poco a poco se irán añadiendo aquí el resto de herramientas de Math World.
                </div>
            </div>
        </div>
    );
}

const st = {
    overlay: { position: 'fixed', inset: 0, zIndex: 6000, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 },
    panel: { background: 'white', borderRadius: 20, width: '100%', maxWidth: 480, padding: 24, boxShadow: '0 20px 50px rgba(0,0,0,0.25)', maxHeight: '90vh', overflowY: 'auto', fontFamily: "'Segoe UI', sans-serif" },
};
