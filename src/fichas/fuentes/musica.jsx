// ─────────────────────────────────────────────────────────────────────────────
//  Fuente de MÚSICA para las fichas: lectura de notas en el pentagrama,
//  figuras y duración, compases, intervalos, instrumentos y términos musicales.
//  Pentagrama y figuras se dibujan en SVG (salen en el PDF y en la pizarra).
// ─────────────────────────────────────────────────────────────────────────────
import React from 'react';
import { pick } from '../fuenteTexto';

const barajar = (a) => [...a].sort(() => Math.random() - 0.5);
const opciones = (correcta, pool, n = 4) => barajar([correcta, ...barajar([...new Set(pool)].filter(x => x !== correcta)).slice(0, n - 1)]);
const NOMBRES = ['Do', 'Re', 'Mi', 'Fa', 'Sol', 'La', 'Si'];

// Clave de sol: líneas del pentagrama en y = 20, 32, 44, 56, 68 (Mi4 en la 1.ª línea)
const NOTAS_PENTA = [
    { n: 'Do', y: 80 }, { n: 'Re', y: 74 }, { n: 'Mi', y: 68 }, { n: 'Fa', y: 62 }, { n: 'Sol', y: 56 }, { n: 'La', y: 50 }, { n: 'Si', y: 44 },
    { n: 'Do', y: 38 }, { n: 'Re', y: 32 }, { n: 'Mi', y: 26 }, { n: 'Fa', y: 20 }, { n: 'Sol', y: 14 }, { n: 'La', y: 8 },
];
const FIGURAS = {
    redonda: { t: 4, nombre: 'redonda' }, blanca: { t: 2, nombre: 'blanca' }, negra: { t: 1, nombre: 'negra' },
    corchea: { t: 0.5, nombre: 'corchea' }, semicorchea: { t: 0.25, nombre: 'semicorchea' },
    blancaP: { t: 3, nombre: 'blanca con puntillo' }, negraP: { t: 1.5, nombre: 'negra con puntillo' },
};
const N = (x) => String(x).replace('.', ',');
// Dónde está la nota: «En la 2.ª línea», «En el 3.er espacio», «Encima de la 5.ª línea»…
const posicion = (y) => {
    if (y >= 80 || y <= 8) return 'En una línea adicional';
    if (y === 74) return 'Debajo de la 1.ª línea';
    if (y === 14) return 'Encima de la 5.ª línea';
    if ((y - 20) % 12 === 0) return `En la ${5 - (y - 20) / 12}.ª línea`;
    return `En el ${5 - Math.ceil((y - 20) / 12)}.º espacio`;
};

// ── Dibujos ──────────────────────────────────────────────────────────────────
const Pentagrama = ({ children, ancho = 130, alto = 92 }) => (
    <svg width={ancho} height={alto} viewBox={`0 0 ${ancho} ${alto}`} style={{ display: 'block' }}>
        {[20, 32, 44, 56, 68].map(y => <line key={y} x1="4" x2={ancho - 4} y1={y} y2={y} stroke="#2c3e50" strokeWidth="1.3" />)}
        <text x="6" y="70" fontSize="56" fontFamily="'Segoe UI Symbol','Noto Music','Bravura',serif" fill="#2c3e50">𝄞</text>
        {children}
    </svg>
);
const Cabeza = ({ x, y, hueca }) => (
    <ellipse cx={x} cy={y} rx="7.5" ry="5.2" transform={`rotate(-20 ${x} ${y})`} fill={hueca ? 'white' : '#111'} stroke="#111" strokeWidth={hueca ? 2 : 1} />
);
const Nota = ({ y }) => {
    const x = 84, arriba = y >= 44;
    return (
        <g>
            {y >= 80 && <line x1={x - 13} x2={x + 13} y1={80} y2={80} stroke="#2c3e50" strokeWidth="1.3" />}
            {y <= 8 && <line x1={x - 13} x2={x + 13} y1={8} y2={8} stroke="#2c3e50" strokeWidth="1.3" />}
            <Cabeza x={x} y={y} />
            <line x1={arriba ? x + 7 : x - 7} x2={arriba ? x + 7 : x - 7} y1={y} y2={arriba ? y - 30 : y + 30} stroke="#111" strokeWidth="1.6" />
        </g>
    );
};
const Figura = ({ tipo, x }) => {
    const y = 50, hueca = ['redonda', 'blanca', 'blancaP'].includes(tipo), plica = tipo !== 'redonda';
    const banderas = tipo === 'corchea' ? 1 : tipo === 'semicorchea' ? 2 : 0;
    return (
        <g>
            <Cabeza x={x} y={y} hueca={hueca} />
            {plica && <line x1={x + 7} x2={x + 7} y1={y} y2={12} stroke="#111" strokeWidth="1.6" />}
            {Array.from({ length: banderas }).map((_, i) => (
                <path key={i} d={`M ${x + 7} ${12 + i * 8} q 10 6 9 18`} fill="none" stroke="#111" strokeWidth="2" />
            ))}
            {tipo.endsWith('P') && <circle cx={x + 15} cy={y} r="2.4" fill="#111" />}
        </g>
    );
};
const Visual = ({ ap }) => {
    const v = ap.v;
    if (v.tipo === 'nota') return <Pentagrama><Nota y={v.y} /></Pentagrama>;
    const ancho = 30 + v.figs.length * 38;
    return (
        <svg width={ancho} height={70} viewBox={`0 0 ${ancho} 70`} style={{ display: 'block' }}>
            {v.figs.map((f, i) => <Figura key={i} tipo={f} x={22 + i * 38} />)}
            {v.figs.length > 1 && v.figs.slice(0, -1).map((_, i) => <text key={i} x={22 + i * 38 + 22} y="56" fontSize="16" fill="#95a5a6">+</text>)}
        </svg>
    );
};

// ── Datos ────────────────────────────────────────────────────────────────────
const INSTRUMENTOS = [
    ['violín', 'Cuerda frotada'], ['viola', 'Cuerda frotada'], ['violonchelo', 'Cuerda frotada'], ['contrabajo', 'Cuerda frotada'],
    ['guitarra', 'Cuerda pulsada'], ['arpa', 'Cuerda pulsada'], ['laúd', 'Cuerda pulsada'], ['bandurria', 'Cuerda pulsada'],
    ['piano', 'Cuerda percutida'], ['flauta travesera', 'Viento madera'], ['clarinete', 'Viento madera'], ['oboe', 'Viento madera'],
    ['fagot', 'Viento madera'], ['saxofón', 'Viento madera'], ['flauta dulce', 'Viento madera'], ['trompeta', 'Viento metal'],
    ['trombón', 'Viento metal'], ['trompa', 'Viento metal'], ['tuba', 'Viento metal'], ['timbal', 'Percusión'], ['xilófono', 'Percusión'],
    ['caja', 'Percusión'], ['platillos', 'Percusión'], ['triángulo', 'Percusión'], ['castañuelas', 'Percusión'], ['bombo', 'Percusión'],
];
const FAMILIAS = [...new Set(INSTRUMENTOS.map(i => i[1]))];
const TERMINOS = [
    ['piano (p)', 'Suave'], ['forte (f)', 'Fuerte'], ['mezzoforte (mf)', 'Medio fuerte'], ['pianissimo (pp)', 'Muy suave'],
    ['fortissimo (ff)', 'Muy fuerte'], ['crescendo', 'Aumentando la intensidad'], ['diminuendo', 'Disminuyendo la intensidad'],
    ['allegro', 'Rápido'], ['adagio', 'Lento'], ['andante', 'Velocidad de paseo'], ['presto', 'Muy rápido'], ['largo', 'Muy lento'],
    ['accelerando', 'Acelerando'], ['ritardando', 'Frenando poco a poco'], ['legato', 'Ligado'], ['staccato', 'Picado (notas cortas)'],
];
const INTERVALOS = ['2.ª', '3.ª', '4.ª', '5.ª', '6.ª', '7.ª', '8.ª'];

// Figuras que suman exactamente t tiempos
const figurasQueSuman = (t, max = 4, permitidas = ['blanca', 'negra', 'corchea', 'blancaP', 'negraP', 'redonda']) => {
    for (let i = 0; i < 200; i++) {
        const figs = []; let r = t;
        while (r > 0 && figs.length < max) {
            const f = pick(permitidas.filter(k => FIGURAS[k].t <= r));
            if (!f) break;
            figs.push(f); r -= FIGURAS[f].t;
        }
        if (Math.abs(r) < 1e-9 && figs.length >= 2) return figs;
    }
    return t === 2 ? ['negra', 'negra'] : t === 3 ? ['negra', 'negra', 'negra'] : ['blanca', 'negra', 'negra'];
};

export const MUSICA = {
    id: 'musica', nombre: 'Música', emoji: '🎵', color: '#5E35B1', etapas: ['primaria', 'eso'],
    desc: 'Notas en el pentagrama, figuras, compases, intervalos, instrumentos y términos',
    Visual,
    tipos: {
        leerNotas: {
            label: '🎼 Leer notas', titulo: 'Escribe el nombre de cada nota (clave de sol).', cols: 3, alto: 30, repetir: true,
            gen: (nv) => {
                const pool = NOTAS_PENTA.slice(0, nv === 1 ? 8 : nv === 2 ? 11 : 13);
                const n = pick(pool);
                return { v: { tipo: 'nota', y: n.y }, e: '', s: n.n, r: [{ tipo: 'opcion', v: n.n, opciones: NOMBRES }], pasos: [posicion(n.y)] };
            },
        },
        duracion: {
            label: '⏱️ Duración de las figuras', titulo: '¿Cuántos tiempos dura cada figura? (la negra = 1 tiempo)', cols: 3, alto: 30, repetir: true,
            gen: (nv) => {
                const f = pick(nv === 1 ? ['redonda', 'blanca', 'negra', 'corchea'] : Object.keys(FIGURAS));
                return { v: { tipo: 'figuras', figs: [f] }, e: '', s: `${FIGURAS[f].nombre}: ${N(FIGURAS[f].t)} ${FIGURAS[f].t === 1 ? 'tiempo' : 'tiempos'}`, r: [{ tipo: 'num', v: FIGURAS[f].t, unidad: 'tiempos' }], pasos: [f.endsWith('P') ? 'El puntillo añade la mitad de su valor' : 'Redonda 4 · blanca 2 · negra 1 · corchea ½ · semicorchea ¼'] };
            },
        },
        sumaFiguras: {
            label: '➕ Sumar figuras', titulo: '¿Cuántos tiempos suman las figuras?', cols: 2, alto: 30,
            gen: (nv) => {
                const pool = nv === 1 ? ['blanca', 'negra', 'corchea', 'redonda'] : Object.keys(FIGURAS);
                const figs = Array.from({ length: nv === 1 ? 2 : 3 }, () => pick(pool));
                const t = figs.reduce((s, f) => s + FIGURAS[f].t, 0);
                return { v: { tipo: 'figuras', figs }, e: '', s: `${N(t)} tiempos`, r: [{ tipo: 'num', v: t, unidad: 'tiempos' }], pasos: [figs.map(f => `${FIGURAS[f].nombre} (${N(FIGURAS[f].t)})`).join(' + ') + ` = ${N(t)}`] };
            },
        },
        compas: {
            label: '🥁 ¿Qué compás es?', titulo: 'Indica el compás que forman las figuras: 2/4, 3/4 o 4/4.', cols: 2, alto: 30, niveles: false,
            gen: () => {
                const t = pick([2, 3, 4]), figs = figurasQueSuman(t);
                return { v: { tipo: 'figuras', figs }, e: '', s: `${t}/4`, r: [{ tipo: 'opcion', v: `${t}/4`, opciones: ['2/4', '3/4', '4/4'] }], pasos: [`Suman ${t} tiempos de negra → ${t}/4`] };
            },
        },
        intervalos: {
            label: '↕️ Intervalos', titulo: 'Clasifica cada intervalo (ascendente).', cols: 3, alto: 30, niveles: false,
            gen: () => {
                const a = Math.floor(Math.random() * 7), d = 1 + Math.floor(Math.random() * 7);
                const b = (a + d) % 7, nombre = INTERVALOS[d - 1];
                return { e: `${NOMBRES[a]} → ${NOMBRES[b]}`, s: `Intervalo de ${nombre}`, r: [{ tipo: 'opcion', v: nombre, opciones: opciones(nombre, INTERVALOS) }], pasos: [`Se cuentan las dos notas: ${Array.from({ length: d + 1 }, (_, i) => NOMBRES[(a + i) % 7]).join(', ')} → ${d + 1} notas`] };
            },
        },
        instrumentos: {
            label: '🎻 Familias de instrumentos', titulo: '¿A qué familia pertenece cada instrumento?', cols: 2, alto: 30, niveles: false,
            gen: () => {
                const [ins, fam] = pick(INSTRUMENTOS);
                return { e: ins[0].toUpperCase() + ins.slice(1), s: fam, r: [{ tipo: 'opcion', v: fam, opciones: opciones(fam, FAMILIAS) }], pasos: [] };
            },
        },
        terminos: {
            label: '📝 Términos musicales', titulo: '¿Qué significa cada término?', cols: 2, alto: 30, niveles: false,
            gen: () => {
                const [t, sig] = pick(TERMINOS);
                return { e: t, s: sig, r: [{ tipo: 'opcion', v: sig, opciones: opciones(sig, TERMINOS.map(x => x[1])) }], pasos: [] };
            },
        },
    },
};
