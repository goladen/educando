import React from 'react';
import { CATEGORIAS, generarEnigma, textoPista, ETIQUETA_CASILLA, EnigmaPizarra } from '../EnigmicLogic';

// ─────────────────────────────────────────────────────────────────────────────
//  Motor de ENIGMIC para las fichas imprimibles (ver FichasImprimibles.jsx)
//  Cada apartado es un enigma completo (tablero + pistas + solución única).
//  La hoja del alumno lleva las pistas, el tablero vacío y, al final, las
//  tarjetas para RECORTAR y colocar en las casillas.
//  Firestore: fichas_enigmic · enlace público: /enigmic?ficha=ID
// ─────────────────────────────────────────────────────────────────────────────

const MORADO = '#4a148c';
const TINTA = '#2c3e50';

const TIPOS = {
    en: { label: '🇬🇧 English', color: '#1565C0' },
    fr: { label: '🇫🇷 Français', color: '#7c3aed' },
    ca: { label: '🌐 Català', color: '#0d9488' },
    es: { label: '🇪🇸 Español', color: '#c0392b' },
};

// Enunciado del ejercicio, en el idioma que se estudia
const TITULOS = {
    en: 'Read the clues, cut out the cards and place each one in the right square.',
    fr: 'Lis les indices, découpe les cartes et place chacune à la bonne place.',
    ca: 'Llegeix les pistes, retalla les targetes i col·loca cada una a la casella correcta.',
    es: 'Lee las pistas, recorta las tarjetas y coloca cada una en su casilla.',
};

const CORTAR = {
    en: '✂️ Cut out and place',
    fr: '✂️ Découpe et place',
    ca: '✂️ Retalla i col·loca',
    es: '✂️ Recorta y coloca',
};

const SOLUCION = { en: 'Solution', fr: 'Solution', ca: 'Solució', es: 'Solución' };

// Tamaños de tablero disponibles: «casillas × categorías» (el primero es el de partida)
const TABLEROS = [
    ['5x3', '5 casillas × 3 categorías'],
    ['5x2', '5 casillas × 2 categorías'],
    ['5x4', '5 casillas × 4 categorías'],
    ['5x5', '5 × 5 (tipo Einstein)'],
    ['6x3', '6 casillas × 3 categorías'],
    ['6x4', '6 casillas × 4 categorías'],
];

const leerTablero = (txt) => {
    const [N, K] = String(txt || '5x3').split('x').map(Number);
    return { N: N || 5, K: K || 3 };
};

const NIVEL_ID = ['FACIL', 'MEDIO', 'DIFICIL'];

// Las profesiones siempre están (es el vocabulario que más se trabaja);
// el resto de categorías se sortean.
const elegirCats = (K) => {
    const resto = CATEGORIAS.map(c => c.id).filter(id => id !== 'PROFESIONES');
    for (let i = resto.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [resto[i], resto[j]] = [resto[j], resto[i]]; }
    return ['PROFESIONES', ...resto].slice(0, K);
};

const generarApartados = (ej, n, existentes = []) => {
    const { N, K } = leerTablero(ej.catProb);
    const nivel = NIVEL_ID[(ej.nivel || 2) - 1] || 'MEDIO';
    const out = [];
    for (let i = 0; i < n; i++) {
        out.push({
            lang: ej.tipo || 'en',
            nivel,
            enigma: generarEnigma({ N, catIds: elegirCats(K), nivel }),
        });
    }
    return out;
};

/* ─── Tablero (vacío / resuelto / revelado por filas) ──────────────────────── */

const Tablero = ({ ap, size = '1rem', filasResueltas = 0 }) => {
    const e = ap.enigma;
    const lang = ap.lang || 'en';
    const celda = `calc(${size} * 3.4)`;          // alto de casilla (sitio para la tarjeta)
    const fuente = `calc(${size} * 0.78)`;
    return (
        <div style={{ display: 'grid', gridTemplateColumns: `calc(${size} * 7.5) repeat(${e.N}, 1fr)`, gap: 3, width: '100%' }}>
            <div />
            {Array.from({ length: e.N }, (_, p) => (
                <div key={p} style={{
                    textAlign: 'center', fontWeight: 800, color: MORADO, fontSize: fuente,
                    padding: '3px 0', border: `1px solid ${MORADO}`, borderRadius: 4, background: '#f6f0fb',
                }}>{ETIQUETA_CASILLA[lang]} {p + 1}</div>
            ))}
            {e.cats.map((cat, c) => (
                <React.Fragment key={cat.id}>
                    <div style={{
                        display: 'flex', alignItems: 'center', gap: 4, padding: '2px 5px', minHeight: celda,
                        border: `1px solid ${MORADO}`, borderRadius: 4, background: '#f6f0fb',
                        fontWeight: 800, color: MORADO, fontSize: fuente, lineHeight: 1.1,
                    }}>
                        <span>{cat.emoji}</span><span>{cat.nombre[lang]}</span>
                    </div>
                    {Array.from({ length: e.N }, (_, p) => {
                        const visible = c < filasResueltas;
                        const it = visible ? cat.items[e.pos[c].indexOf(p)] : null;
                        return (
                            <div key={p} style={{
                                minHeight: celda, border: `1.5px solid ${TINTA}`, borderRadius: 4,
                                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                                gap: 1, background: visible ? '#eafaf1' : 'white', textAlign: 'center', padding: 2,
                            }}>
                                {it && <>
                                    <span style={{ fontSize: `calc(${size} * 1.25)`, lineHeight: 1 }}>{it.emoji}</span>
                                    <span style={{ fontSize: `calc(${size} * 0.68)`, fontWeight: 700, color: TINTA, lineHeight: 1.05 }}>{it[lang].lbl}</span>
                                </>}
                            </div>
                        );
                    })}
                </React.Fragment>
            ))}
        </div>
    );
};

/* ─── Tarjetas para recortar ───────────────────────────────────────────────── */

const Recortables = ({ ap, size = '1rem' }) => {
    const e = ap.enigma;
    const lang = ap.lang || 'en';
    // Las tarjetas de cada categoría se presentan desordenadas (no en el orden de la solución)
    const orden = (cat) => cat.items.map((it, i) => ({ it, i })).sort((a, b) => (a.it.id < b.it.id ? -1 : 1));
    return (
        <div style={{ marginTop: `calc(${size} * 0.9)`, paddingTop: `calc(${size} * 0.5)`, borderTop: `2px dashed ${MORADO}` }}>
            <div style={{ fontSize: `calc(${size} * 0.78)`, fontWeight: 800, color: MORADO, marginBottom: 4 }}>
                {CORTAR[lang]}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {e.cats.map(cat => (
                    <div key={cat.id} style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
                        <span style={{ fontSize: `calc(${size} * 0.68)`, fontWeight: 800, color: MORADO, width: `calc(${size} * 7)`, lineHeight: 1.1 }}>
                            {cat.emoji} {cat.nombre[lang]}
                        </span>
                        {orden(cat).map(({ it, i }) => (
                            <div key={i} style={{
                                border: `1.5px dashed ${TINTA}`, borderRadius: 4, background: 'white',
                                padding: '2px 5px', minWidth: `calc(${size} * 3.1)`,
                                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0,
                            }}>
                                <span style={{ fontSize: `calc(${size} * 1.2)`, lineHeight: 1.1 }}>{it.emoji}</span>
                                <span style={{ fontSize: `calc(${size} * 0.62)`, fontWeight: 700, color: TINTA, lineHeight: 1.05, textAlign: 'center' }}>{it[lang].lbl}</span>
                            </div>
                        ))}
                    </div>
                ))}
            </div>
        </div>
    );
};

/* ─── Enunciado (pistas + tablero vacío + recortables) ─────────────────────── */

const Enunciado = ({ ap, size = '1rem' }) => {
    const e = ap.enigma;
    const lang = ap.lang || 'en';
    if (!e) return null;
    return (
        <div style={{ width: '100%' }}>
            <ol style={{ margin: `0 0 calc(${size} * 0.6)`, paddingLeft: `calc(${size} * 1.4)`, color: TINTA }}>
                {e.clues.map((cl, i) => (
                    <li key={i} style={{ fontSize: `calc(${size} * 0.82)`, lineHeight: 1.45, fontWeight: 600, marginBottom: 1 }}>
                        {textoPista(cl, e.cats, lang)}
                    </li>
                ))}
            </ol>
            <Tablero ap={ap} size={size} filasResueltas={0} />
            <Recortables ap={ap} size={size} />
        </div>
    );
};

const Solucion = ({ ap, size = '1.1rem' }) => {
    if (!ap.enigma) return null;
    return (
        <div style={{ width: '100%' }}>
            <div style={{ fontSize: `calc(${size} * 0.72)`, fontWeight: 800, color: '#27ae60', marginBottom: 3 }}>
                ✅ {SOLUCION[ap.lang || 'en']}
            </div>
            <Tablero ap={ap} size={size} filasResueltas={ap.enigma.K} />
        </div>
    );
};

// En el monitor (modo pizarra) se revela una fila por clic
const Revelado = ({ ap, vis, size = '1.2rem' }) => {
    if (!ap.enigma || !vis) return null;
    return (
        <div style={{ marginTop: 10 }}>
            <div style={{ fontSize: `calc(${size} * 0.6)`, fontWeight: 800, color: '#27ae60', marginBottom: 4 }}>
                ✅ {SOLUCION[ap.lang || 'en']} ({Math.min(vis, ap.enigma.K)}/{ap.enigma.K})
            </div>
            <Tablero ap={ap} size={size} filasResueltas={vis} />
        </div>
    );
};

// En el monitor no se pinta la ficha: se juega el enigma (mismo tablero y mismo
// selector que Enigmic), para resolverlo con la clase mientras tienen el papel.
const PizarraApartado = ({ ap, size, vis, max }) => (
    <EnigmaPizarra enigma={ap.enigma} lang={ap.lang || 'en'} size={size} solucion={max > 0 && vis >= max} />
);

export const motorEnigmic = {
    coleccion: 'fichas_enigmic',
    ruta: '/enigmic',
    nombre: 'Fichas de Enigmic',
    tituloFicha: 'Enigmas de lógica',
    emoji: '🕵️',
    volver: 'Enigmic',
    tipos: TIPOS,
    titulos: TITULOS,
    ejercicioInicial: { tipo: 'en', nivel: 2, n: 1 },
    ejercicioNuevo: { tipo: 'en', nivel: 2, n: 1 },
    // Un enigma por fila y sin espacio en blanco extra: el tablero ya es la respuesta
    layout: () => ({ cols: 1, alto: 0 }),
    maxApartados: () => 3,
    generarApartados,
    usaNivel: () => true,
    categorias: () => TABLEROS,
    esTexto: () => true,
    sizeHoja: () => '1rem',
    Enunciado,
    Solucion,
    pasosMax: (ap) => ap.enigma?.K || 1,
    Revelado,
    PizarraApartado,
};

export default motorEnigmic;
