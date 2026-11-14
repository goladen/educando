// ─────────────────────────────────────────────────────────────────────────────
//  GENERADORES de ejercicios de cambio de unidades.
//  Devuelven apartados con el formato de las fuentes de fichas de Math World
//  (fichas/fuenteTexto.jsx): { e, s, pasos, r: [{ tipo, v, unidad, tol }], v }
//  para que valgan igual en las fichas PDF, la pizarra, Invasión Pi, los mandos,
//  el tirón de cuerda y la práctica de la herramienta.
//
//  Niveles: 1 Primaria / 1.º ESO (pocos saltos, números sencillos)
//           2 ESO (decimales, unidades compuestas, temperatura, radianes)
//           3 Bachillerato (notación científica, presión, energía, potencia…)
//  Métodos: 'saltos' (escalera) · 'factor' (factores de conversión) · 'libre'
// ─────────────────────────────────────────────────────────────────────────────
import {
    MAGNITUDES, convertir, fmt, limpio, decimalesDe, unidadesDe, escaleraDe, saltosEntre,
    pasosConversion, fraccionDePi, relacion, unidad, conU,
} from './magnitudes.js';

export const R = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;
export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
export const barajar = (arr) => {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
};

export const METODOS = [
    ['libre', '✏️ Ejercicio típico'],
    ['saltos', '🪜 Contando saltos'],
    ['factor', '🔁 Factores de conversión'],
];
export const NIVELES = [[1, '🌱 Primaria / 1.º ESO'], [2, '📘 ESO'], [3, '🎓 Bachillerato']];

// Tolerancia: relativa, para que valga con números muy grandes o muy pequeños
export const tolDe = (v) => Math.max(1e-9, Math.abs(v) * 1e-4);

// ── Elegir unidades ──────────────────────────────────────────────────────────
const MAX_SALTOS = { 1: 2, 2: 4, 3: 6 };
const MAX_SALTOS_TIEMPO = { 1: 1, 2: 2, 3: 3 };

function parEscalera(mag, nivel) {
    const esc = escaleraDe(mag);
    const max = Math.min(esc.peldanos.length - 1, (mag === 'tiempo' || mag === 'angulo' ? MAX_SALTOS_TIEMPO : MAX_SALTOS)[nivel] || 2);
    const n = R(1, max);
    const i = R(0, esc.peldanos.length - 1 - n);
    const [x, y] = [esc.peldanos[i], esc.peldanos[i + n]];
    return Math.random() < 0.55 ? [x, y] : [y, x];
}

/** Par de unidades [de, a] para la magnitud, el nivel y el método. */
export function elegirUnidades(mag, nivel, metodo) {
    const M = MAGNITUDES[mag];
    if (mag === 'temperatura') {
        const pares = nivel === 1 ? [['°C', 'K'], ['K', '°C']] : [['°C', 'K'], ['K', '°C'], ['°C', '°F'], ['°F', '°C'], ...(nivel === 3 ? [['°F', 'K'], ['K', '°F']] : [])];
        return pick(pares);
    }
    if (mag === 'angulo') {
        if (nivel === 1) return pick([['vuelta', '°'], ['°', 'vuelta'], ['°', "'"], ["'", '°']]);
        if (metodo === 'saltos') return parEscalera('angulo', nivel);
        return pick(nivel === 2
            ? [['°', 'rad'], ['°', 'rad'], ['rad', '°'], ['rad', '°'], ['°', "'"], ["'", '°'], ['vuelta', 'rad'], ['°', '"']]
            : [['°', 'rad'], ['rad', '°'], ['rad', '°'], ['vuelta', 'rad'], ['°', '"'], ['"', '°'], ['rad', 'vuelta']]);
    }
    if (mag === 'volcap') {
        const vol = unidadesDe('volcap', nivel).filter((s) => s.includes('³'));
        const cap = unidadesDe('volcap', nivel).filter((s) => !s.includes('³'));
        const par = nivel === 1 ? pick(MAGNITUDES.volcap.puentes) : [pick(vol), pick(cap)];
        return Math.random() < 0.5 ? par : [par[1], par[0]];
    }
    if (M.escalera && (metodo === 'saltos' || nivel === 1 || Math.random() < 0.75)) {
        // superficie: a veces con hectáreas, áreas y centiáreas
        if (mag === 'superficie' && nivel >= 2 && Math.random() < 0.3) {
            const ag = pick(['ha', 'a', 'ca']);
            const otra = pick(M.escalera.filter((s) => s !== unidad(mag, ag).equivale));
            return Math.random() < 0.5 ? [ag, otra] : [otra, ag];
        }
        return parEscalera(mag, nivel);
    }
    const us = unidadesDe(mag, nivel);
    const de = pick(us);
    const a = pick(us.filter((s) => s !== de));
    return [de, a];
}

// ── Elegir un valor con resultado «razonable» para el nivel ──────────────────
const MAX_DEC_VALOR = { 1: 1, 2: 2, 3: 3 };
const MAX_DEC_RES = { 1: 3, 2: 5, 3: 9 };

function candidato(nivel) {
    const t = R(0, nivel === 1 ? 3 : nivel === 2 ? 6 : 8);
    if (t === 0) return R(2, 99);
    if (t === 1) return R(1, 9) * 10;
    if (t === 2) return R(1, 9) * 100 + (nivel > 1 ? R(0, 9) * 10 : 0);
    if (t === 3) return nivel === 1 ? R(1, 9) * 1000 : R(11, 99) / 10;
    if (t === 4) return R(101, 999) / 10;
    if (t === 5) return R(1, 99) / 100;
    if (t === 6) return R(1000, 9999);
    if (t === 7) return R(11, 99) / 10 * 10 ** R(-4, 5);
    return R(101, 999) / 100;
}

function valorTemperatura(de, a, nivel) {
    // °F «bonitos»: °C múltiplo de 5 → °F entero
    const c = nivel === 1 ? R(-10, 40) : 5 * R(-8, 24);
    const v = de === '°C' ? c : de === 'K' ? c + 273 : limpio(c * 1.8 + 32);
    return v;
}

const GRADOS_NOTABLES = [30, 45, 60, 90, 120, 135, 150, 180, 210, 225, 240, 270, 300, 315, 330, 360, 15, 36, 72, 18, 20, 40];

/** Busca un valor cuyo resultado tenga pocos decimales (según el nivel). */
export function elegirValor(mag, de, a, nivel) {
    if (mag === 'temperatura') return valorTemperatura(de, a, nivel);
    if (mag === 'angulo') {
        if (de === 'vuelta') return pick(nivel === 1 ? [0.25, 0.5, 1, 2, 3, 1.5] : [0.25, 0.5, 0.75, 1.5, 2, 3, 0.125]);
        if (de === '°' && a === 'vuelta') return pick([90, 180, 270, 360, 720, 450, 540, 1080]);
        if (de === '°' && a === 'rad') return pick(GRADOS_NOTABLES);
        if (de === 'rad') return nivel === 3 && Math.random() < 0.5 ? R(5, 30) / 10 : null; // null = fracción de π
    }
    let mejor = null;
    for (let i = 0; i < 80; i++) {
        let v = limpio(candidato(nivel));
        if (decimalesDe(v) > MAX_DEC_VALOR[nivel]) continue;
        const res = convertir(v, mag, de, a);
        const absR = Math.abs(res);
        if (!Number.isFinite(res) || res === 0) continue;
        if (nivel < 3 && (absR > 5e7 || absR < 1e-4)) continue;
        if (decimalesDe(res) > MAX_DEC_RES[nivel] && !(nivel === 3 && absR < 1e-4)) { mejor = mejor ?? v; continue; }
        if (nivel < 3 && (Math.abs(v) > 1e4 || absR > (nivel === 1 ? 1e5 : 1e7))) continue;
        return v;
    }
    return mejor ?? 1;
}

// ── Distractores: los errores típicos ────────────────────────────────────────
export function distractoresConversion(mag, de, a, valor, res) {
    const out = [];
    if (mag === 'temperatura') {
        out.push(valor + 273, valor - 273, limpio(valor * 1.8), limpio(valor * 1.8 + 32), limpio((valor - 32) / 1.8), res + 32, res - 32, res + 10);
    } else {
        const k = relacion(mag, de, a);
        out.push(limpio(valor / k), valor); // al revés · sin convertir
        const sal = saltosEntre(mag, de, a);
        const base = sal ? sal.factores[0] : 10;
        out.push(limpio(res * base), limpio(res / base), limpio(res * 10), limpio(res / 10));
        // superficie y volumen: contar cada salto como ×10
        if (sal && base >= 100) out.push(limpio(sal.baja ? valor * 10 ** sal.n : valor / 10 ** sal.n));
        if (mag === 'velocidad') out.push(limpio(res * 3.6 * 3.6), limpio(valor * 3.6));
        out.push(limpio(res * 1000), limpio(res / 1000), limpio(res * 100), limpio(res / 100));
    }
    const ok = (x) => Number.isFinite(x) && Math.abs(x - res) > Math.max(1e-12, Math.abs(res) * 1e-6) && (res < 0 || x >= 0 || mag === 'temperatura');
    const vistos = new Set([fmt(res)]);
    const unicos = [];
    for (const x of out) {
        if (!ok(x)) continue;
        const t = fmt(decimalesDe(x) > 4 ? Number(x.toPrecision(4)) : x);
        if (vistos.has(t)) continue;
        vistos.add(t);
        unicos.push(t);
    }
    return unicos;
}

// ── Conversión: un apartado ──────────────────────────────────────────────────
/**
 * Genera un ejercicio de conversión.
 *  opts: { nivel, metodo: 'libre'|'saltos'|'factor', de, a, valor }
 *  v (dibujo de la ficha): { clase: 'conv', mag, de, a, valor, res, metodo, verEnunciado }
 */
export function generarConversion(mag, opts = {}) {
    const nivel = opts.nivel || 2;
    let metodo = opts.metodo || 'libre';
    let [de, a] = opts.de && opts.a ? [opts.de, opts.a] : elegirUnidades(mag, nivel, metodo);
    // Sin escalera no se pueden contar saltos
    if (metodo === 'saltos' && !saltosEntre(mag === 'volcap' ? (de.includes('³') ? 'volumen' : 'capacidad') : mag, de, a)) metodo = 'factor';

    // Ángulos en radianes como fracción de π
    if (mag === 'angulo' && (de === 'rad' || a === 'rad')) {
        const radianes = angulosRadianes(de, a, nivel, opts.valor);
        if (radianes) return { ...radianes, v: { clase: 'conv', mag, de, a, valor: radianes._valor, res: radianes._res, metodo: 'factor', verEnunciado: metodo === 'factor', enSolucion: true, soloSolucion: metodo !== 'factor' } };
    }

    const valor = opts.valor ?? elegirValor(mag, de, a, nivel);
    const exacto = convertir(valor, mag, de, a);
    // Sin un resultado «limpio» (mmHg, kcal…): se redondea y se acepta con un 1 % de margen
    const redondo = limpio(Number(exacto.toPrecision(nivel === 3 ? 4 : 3)));
    const aprox = decimalesDe(exacto) > MAX_DEC_RES[nivel] && Math.abs(exacto) >= 1e-4 && redondo !== exacto;
    const res = aprox ? redondo : exacto;
    const pasos = pasosConversion(valor, mag, de, a, metodo === 'libre' ? (saltosEntre(mag, de, a) && nivel <= 2 ? 'saltos' : 'factor') : metodo, { potencias: nivel === 3 });
    const cient = nivel === 3 ? 'auto' : false;
    const vt = fmt(valor, { cientifica: cient }), rt = fmt(res, { cientifica: cient });
    return {
        e: `${conU(vt, de)} = ___ ${a}`,
        s: `${conU(vt, de)} ${aprox ? '≈' : '='} ${conU(rt, a)}`,
        pasos,
        r: [{ tipo: 'num', v: res, unidad: a, tol: aprox ? Math.abs(res) * 0.01 : tolDe(res), vTxt: rt, distractores: distractoresConversion(mag, de, a, valor, res) }],
        v: { clase: 'conv', mag, de, a, valor, res, metodo, verEnunciado: metodo !== 'libre', enSolucion: true, soloSolucion: metodo === 'libre' },
    };
}

function angulosRadianes(de, a, nivel, valorFijo) {
    if (de === '°' && a === 'rad') {
        const g = valorFijo ?? pick(GRADOS_NOTABLES);
        const fr = fraccionDePi(g);
        const coef = fr.n / fr.d;
        const otros = barajar(GRADOS_NOTABLES.filter((x) => x !== g)).slice(0, 5).map((x) => fraccionDePi(x).texto.replace('π', '') || '1');
        return {
            e: `${g}° = ___ π rad`,
            s: `${g}° = ${fr.texto} rad`,
            pasos: [`180° = π rad → factor (π rad / 180°)`, `${g}° · π / 180 = ${fr.texto} rad (simplifica ${g}/180 = ${fr.n}/${fr.d})`],
            r: [{ tipo: 'frac', v: coef, unidad: 'π rad', tol: 0.002, vTxt: fr.d === 1 ? String(fr.n) : `${fr.n}/${fr.d}`, distractores: [...new Set(otros)].filter((t) => t !== `${fr.n}/${fr.d}`), etiqueta: '' }],
            _valor: g, _res: limpio((g * Math.PI) / 180),
        };
    }
    if (de === 'rad' && a === '°') {
        if (valorFijo == null && nivel === 3 && Math.random() < 0.4) {
            const v = R(5, 30) / 10, g = limpio(Math.round((v * 180 / Math.PI) * 100) / 100);
            return {
                e: `${fmt(v)} rad = ___ °`, s: `${fmt(v)} rad ≈ ${fmt(g)}°`,
                pasos: [`π rad = 180° → factor (180° / π rad)`, `${fmt(v)} · 180 / π ≈ ${fmt(g)}°`],
                r: [{ tipo: 'num', v: g, unidad: '°', tol: 0.06, vTxt: fmt(g), distractores: [fmt(limpio(v * 180)), fmt(limpio(Math.round(v * Math.PI / 180 * 1000) / 1000)), fmt(limpio(Math.round(g * 2))), fmt(limpio(Math.round(g / 2 * 100) / 100))] }],
                _valor: v, _res: g,
            };
        }
        const g = valorFijo ?? pick(GRADOS_NOTABLES);
        const fr = fraccionDePi(g);
        return {
            e: `${fr.texto} rad = ___ °`, s: `${fr.texto} rad = ${g}°`,
            pasos: [`π rad = 180° → sustituye π por 180°`, `${fr.texto.replace('π', ' · 180°').replace(/^ · /, '')} = ${g}°`],
            r: [{ tipo: 'num', v: g, unidad: '°', tol: 0.01, vTxt: String(g), distractores: [String(g * 2), String(g / 2), String(360 - g), String(g + 90), String(180 - g)].filter((t) => t !== String(g) && Number(t) > 0) }],
            _valor: limpio((g * Math.PI) / 180), _res: g,
        };
    }
    if (de === 'vuelta' && a === 'rad') {
        const v = valorFijo ?? pick([0.25, 0.5, 1, 1.5, 2, 3]);
        const fr = fraccionDePi(v * 360);
        return {
            e: `${fmt(v)} ${v === 1 ? 'vuelta' : 'vueltas'} = ___ π rad`, s: `${fmt(v)} vueltas = ${fr.texto} rad`,
            pasos: [`1 vuelta = 2π rad`, `${fmt(v)} · 2π = ${fr.texto} rad`],
            r: [{ tipo: 'frac', v: v * 2, unidad: 'π rad', tol: 0.002, vTxt: fmt(v * 2), distractores: [fmt(v), fmt(v * 4), fmt(v * 360), fmt(v + 2)] }],
            _valor: v, _res: limpio(v * 2 * Math.PI),
        };
    }
    if (de === 'rad' && a === 'vuelta') {
        const g = valorFijo ?? pick([90, 180, 360, 540, 720, 270]);
        const fr = fraccionDePi(g), v = limpio(g / 360);
        return {
            e: `${fr.texto} rad = ___ vueltas`, s: `${fr.texto} rad = ${fmt(v)} vueltas`,
            pasos: [`2π rad = 1 vuelta → divide entre 2π`, `${fr.texto} : 2π = ${fmt(v)}`],
            r: [{ tipo: 'num', v, unidad: 'vueltas', tol: 0.002, vTxt: fmt(v), distractores: [fmt(v * 2), fmt(v / 2), fmt(limpio(g / 180)), fmt(v + 1)] }],
            _valor: limpio(g * Math.PI / 180), _res: v,
        };
    }
    return null;
}

// ── Formas complejas ↔ incomplejas ───────────────────────────────────────────
const COMPLEJAS = {
    longitud: { esc: ['km', 'hm', 'dam', 'm', 'dm', 'cm', 'mm'] },
    masa: { esc: ['kg', 'hg', 'dag', 'g', 'dg', 'cg', 'mg'] },
    capacidad: { esc: ['kl', 'hl', 'dal', 'l', 'dl', 'cl', 'ml'] },
    tiempo: { esc: ['h', 'min', 's'] },
    angulo: { esc: ['°', "'", '"'] },
};
export const MAGNITUDES_COMPLEJAS = Object.keys(COMPLEJAS);

/** «3 km 5 hm 20 m = ___ m» o «3 525 m = __ km __ hm __ dam __ m». */
export function generarCompleja(mag, { nivel = 1 } = {}) {
    const esc = COMPLEJAS[mag]?.esc || COMPLEJAS.longitud.esc;
    if (!COMPLEJAS[mag]) mag = 'longitud';
    const esTiempo = mag === 'tiempo' || mag === 'angulo';
    const n = esTiempo ? (nivel === 1 ? 2 : 3) : R(2, nivel === 1 ? 3 : 4);
    const i0 = R(0, esc.length - n);
    const us = esc.slice(i0, i0 + n);
    const menor = us[us.length - 1];
    const cant = us.map((x, i) => (i === 0 ? R(1, esTiempo ? 5 : 9) : esTiempo ? R(0, 59) : R(0, 9)));
    if (!esTiempo && Math.random() < 0.5) cant[cant.length - 1] = R(10, 99); // «20 m»
    let total = limpio(us.reduce((s, x, i) => s + convertir(cant[i], mag, x, menor), 0));
    const comp = us.map((x, i) => (cant[i] ? conU(cant[i], x) : null)).filter(Boolean).join(' ');
    if (Math.random() < 0.5 || nivel === 1) {
        // compleja → incompleja (en la unidad menor; en nivel 2-3 a veces en otra)
        const dest = nivel >= 2 && !esTiempo && Math.random() < 0.4 ? us[R(0, us.length - 2)] : menor;
        const res = convertir(total, mag, menor, dest);
        return {
            e: `${comp} = ___ ${dest}`, s: `${comp} = ${conU(res, dest)}`,
            pasos: [...us.filter((_, i) => cant[i]).map((x) => { const q = cant[us.indexOf(x)]; return `${conU(q, x)} = ${conU(convertir(q, mag, x, dest), dest)}`; }), `Suma: ${conU(res, dest)}`],
            r: [{ tipo: 'num', v: res, unidad: dest, tol: tolDe(res), vTxt: fmt(res), distractores: distractoresConversion(mag, us[0], dest, cant[0], res).slice(0, 2).concat([fmt(cant.reduce((s, x) => s + x, 0))]) }],
            v: { clase: 'compleja', mag, us, cant, soloSolucion: true },
        };
    }
    // incompleja → compleja: una casilla por unidad (en las decimales, una cifra por unidad)
    if (!esTiempo) {
        cant[cant.length - 1] = R(0, 9);
        total = limpio(us.reduce((s, x, i) => s + convertir(cant[i], mag, x, menor), 0));
    }
    const unidadesTxt = us.map((x) => `__ ${x}`).join(' ');
    return {
        e: `${conU(total, menor)} = ${unidadesTxt}`, s: `${conU(total, menor)} = ${us.map((x, i) => conU(cant[i], x)).join(' ')}`,
        pasos: esTiempo ? pasosDivisiones(total, us, cant, mag) : [`Cada cifra es una unidad: ${us.map((x, i) => conU(cant[i], x)).join(', ')}`],
        r: us.map((x, i) => ({ etiqueta: `${x}:`, tipo: 'num', v: cant[i], unidad: x, tol: 0.001 })),
        largo: false,
        v: { clase: 'compleja', mag, us, cant, soloSolucion: true },
    };
}

// 18 200 s → 18 200 : 3 600 = 5 h y sobran 200 s; 200 : 60 = 3 min y sobran 20 s
function pasosDivisiones(total, us, cant, mag) {
    const pasos = [];
    let resto = total;
    for (let i = 0; i < us.length - 1; i++) {
        const f = convertir(1, mag, us[i], us[us.length - 1]);
        const q = Math.floor(resto / f);
        const r = limpio(resto - q * f);
        pasos.push(`${fmt(resto)} : ${fmt(f)} = ${q} ${us[i]} y sobran ${conU(r, us[us.length - 1])}`);
        resto = r;
    }
    return pasos;
}

// ── Ordenar / comparar ───────────────────────────────────────────────────────
/** «¿Qué es mayor: 3,5 km o 3 600 m?» → opción. */
export function generarComparar(mag, { nivel = 1 } = {}) {
    const [de, a] = elegirUnidades(mag, nivel, 'libre');
    const v1 = elegirValor(mag, de, a, nivel);
    const eq = convertir(v1, mag, de, a);
    const delta = pick([0.9, 1.1, 1, 0.5, 2, 1.2, 0.8]);
    const v2 = limpio(Math.round(eq * delta * 100) / 100) || eq;
    const t1 = `${fmt(v1)} ${de}`, t2 = `${fmt(v2)} ${a}`;
    const opc = Math.abs(v2 - eq) < 1e-9 ? 'Son iguales' : v2 > eq ? t2 : t1;
    return {
        e: `¿Qué es mayor: ${t1} o ${t2}?`, s: opc,
        pasos: [`Pasa todo a ${a}: ${t1} = ${fmt(eq)} ${a}`, `Compara ${fmt(eq)} ${a} con ${t2}`],
        r: [{ tipo: 'opcion', v: opc, opciones: [t1, t2, 'Son iguales'] }],
        largo: true,
    };
}
