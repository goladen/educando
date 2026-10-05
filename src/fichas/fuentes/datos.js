// ─────────────────────────────────────────────────────────────────────────────
//  Fuentes de ESTADÍSTICA y PROBABILIDAD para las fichas de Math World
// ─────────────────────────────────────────────────────────────────────────────
import { R, pick, N, frac } from '../fuenteTexto';

// Datos cuya media es exacta (o con un decimal en nivel 3)
const datosConMedia = (n, lo, hi, decimal = false) => {
    for (let i = 0; i < 300; i++) {
        const d = Array.from({ length: n }, () => R(lo, hi));
        const s = d.reduce((a, b) => a + b, 0);
        if (decimal ? (s * 10) % n === 0 : s % n === 0) return d;
    }
    return Array.from({ length: n }, () => 5);
};
const mediana = (d) => { const s = [...d].sort((a, b) => a - b), m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const modaUnica = (d) => {
    const f = {}; d.forEach(x => { f[x] = (f[x] || 0) + 1; });
    const max = Math.max(...Object.values(f)), modas = Object.keys(f).filter(k => f[k] === max);
    return modas.length === 1 && max > 1 ? Number(modas[0]) : null;
};
const CONTEXTOS = ['Notas de un examen', 'Goles por partido', 'Horas de sueño', 'Libros leídos este curso', 'Temperaturas máximas (°C)', 'Puntos en un videojuego'];

export const ESTADISTICA = {
    id: 'estadistica', nombre: 'Estadística', emoji: '📊', color: '#c0392b', etapas: ['primaria', 'eso'],
    desc: 'Media, mediana, moda y rango de un conjunto de datos',
    tipos: {
        media: {
            label: 'Media', titulo: 'Calcula la media de cada conjunto de datos.', cols: 2, alto: 60,
            gen: (nv) => {
                const d = datosConMedia(nv === 1 ? 4 : R(5, 7), 1, nv === 1 ? 10 : 20, nv === 3);
                const s = d.reduce((a, b) => a + b, 0), m = s / d.length;
                return { e: d.join(',  '), s: `Media = ${N(m)}`, r: [{ tipo: 'num', v: m }], pasos: [`Suma: ${s}`, `${s} : ${d.length} = ${N(m)}`] };
            },
        },
        mediana: {
            label: 'Mediana', titulo: 'Calcula la mediana de cada conjunto de datos.', cols: 2, alto: 60,
            gen: (nv) => {
                const d = Array.from({ length: nv === 1 ? R(2, 3) * 2 + 1 : R(5, 8) }, () => R(1, 20));
                const s = [...d].sort((a, b) => a - b), med = mediana(d);
                return { e: d.join(',  '), s: `Mediana = ${N(med)}`, r: [{ tipo: 'num', v: med }], pasos: [`Ordenados: ${s.join(', ')}`, s.length % 2 ? 'Es el valor central' : 'Es la media de los dos valores centrales'] };
            },
        },
        moda: {
            label: 'Moda', titulo: 'Calcula la moda de cada conjunto de datos.', cols: 2, alto: 50,
            gen: () => {
                const d = Array.from({ length: R(6, 9) }, () => R(1, 10)), m = modaUnica(d);
                if (m === null) return null;
                return { e: d.join(',  '), s: `Moda = ${m}`, r: [{ tipo: 'num', v: m }], pasos: ['Es el dato que más se repite'] };
            },
        },
        completo: {
            label: 'Todos los parámetros', titulo: 'Calcula la media, la mediana, la moda y el rango.', cols: 1, alto: 110,
            gen: (nv) => {
                const d = datosConMedia(R(6, 8), 1, nv === 1 ? 10 : 20, nv === 3), mo = modaUnica(d);
                if (mo === null) return null;
                const s = d.reduce((a, b) => a + b, 0), me = s / d.length, md = mediana(d), rg = Math.max(...d) - Math.min(...d);
                return { largo: true, e: `${pick(CONTEXTOS)}:  ${d.join(',  ')}`, s: `Media = ${N(me)} · Mediana = ${N(md)} · Moda = ${mo} · Rango = ${rg}`,
                    r: [{ etiqueta: 'Media:', tipo: 'num', v: me }, { etiqueta: 'Mediana:', tipo: 'num', v: md }, { etiqueta: 'Moda:', tipo: 'num', v: mo }, { etiqueta: 'Rango:', tipo: 'num', v: rg }],
                    pasos: [`Media: ${s} : ${d.length} = ${N(me)}`, `Ordenados: ${[...d].sort((a, b) => a - b).join(', ')} → mediana ${N(md)}`, `Moda: ${mo}`, `Rango: ${Math.max(...d)} − ${Math.min(...d)} = ${rg}`] };
            },
        },
    },
};

// ═════════════════════════════════════════════════════════════════════════════
//  PROBABILIDAD (regla de Laplace)
// ═════════════════════════════════════════════════════════════════════════════
const laplace = (fav, tot, txt) => ({ s: `P = ${frac(fav, tot)}`, r: [{ tipo: 'frac', v: fav / tot, placeholder: 'a/b' }], pasos: [`Casos favorables: ${fav}${txt ? ` (${txt})` : ''}`, `Casos posibles: ${tot}`, `P = ${fav}/${tot} = ${frac(fav, tot)}`] });

export const PROBABILIDAD = {
    id: 'probabilidad', nombre: 'Probabilidad', emoji: '🎲', color: '#7f8c8d', etapas: ['primaria', 'eso'],
    desc: 'Regla de Laplace con dados, urnas, monedas y cartas',
    tipos: {
        dado: {
            label: 'Dado', titulo: 'Se lanza un dado de 6 caras. Calcula la probabilidad de:', cols: 2, alto: 60, niveles: false,
            gen: () => {
                const [txt, fav, cuales] = pick([['sacar un número par', 3, '2, 4, 6'], ['sacar un número impar', 3, '1, 3, 5'], ['sacar más de 4', 2, '5, 6'], ['sacar un múltiplo de 3', 2, '3, 6'], ['sacar un 6', 1, '6'], ['sacar menos de 3', 2, '1, 2'], ['sacar un número primo', 3, '2, 3, 5'], ['no sacar un 1', 5, '2, 3, 4, 5, 6']]);
                return { e: txt, ...laplace(fav, 6, cuales) };
            },
        },
        urna: {
            label: 'Urna con bolas', titulo: 'Calcula la probabilidad.', cols: 1, alto: 70,
            gen: () => {
                const r = R(1, 9), a = R(1, 9), v = R(1, 9), tot = r + a + v;
                const [txt, fav] = pick([['roja', r], ['azul', a], ['verde', v], ['que no sea roja', a + v], ['que no sea azul', r + v]]);
                return { largo: true, e: `Una urna tiene ${r} bolas rojas, ${a} azules y ${v} verdes. Se saca una bola al azar. ¿Cuál es la probabilidad de que sea ${txt}?`, ...laplace(fav, tot) };
            },
        },
        monedas: {
            label: 'Monedas y dos dados', titulo: 'Calcula la probabilidad.', cols: 1, alto: 80, niveles: false,
            gen: () => {
                const [txt, fav, tot, cuales] = pick([
                    ['Se lanzan dos monedas. Probabilidad de obtener dos caras.', 1, 4, 'CC'],
                    ['Se lanzan dos monedas. Probabilidad de obtener al menos una cara.', 3, 4, 'CC, CX, XC'],
                    ['Se lanzan tres monedas. Probabilidad de obtener tres cruces.', 1, 8, 'XXX'],
                    ['Se lanzan dos dados. Probabilidad de que la suma sea 7.', 6, 36, '1+6, 2+5, 3+4, 4+3, 5+2, 6+1'],
                    ['Se lanzan dos dados. Probabilidad de sacar dos números iguales.', 6, 36, 'dobles'],
                    ['Se lanzan dos dados. Probabilidad de que la suma sea 10 o más.', 6, 36, '4+6, 5+5, 6+4, 5+6, 6+5, 6+6'],
                ]);
                return { largo: true, e: txt, ...laplace(fav, tot, cuales) };
            },
        },
        cartas: {
            label: 'Baraja española', titulo: 'Se extrae una carta de una baraja española de 40 cartas. Calcula la probabilidad de:', cols: 2, alto: 60, niveles: false,
            gen: () => {
                const [txt, fav] = pick([['sacar un oro', 10], ['sacar un as', 4], ['sacar una figura (sota, caballo o rey)', 12], ['sacar el rey de copas', 1], ['sacar una espada o un basto', 20], ['no sacar una figura', 28]]);
                return { e: txt, ...laplace(fav, 40) };
            },
        },
    },
};
