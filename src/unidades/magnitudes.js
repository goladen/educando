// ─────────────────────────────────────────────────────────────────────────────
//  MAGNITUDES Y UNIDADES · fuente única del «Cambio de unidades»
//  La usan la herramienta (unidades/CambioUnidades.jsx), sus fichas PDF
//  (fichas/fuentes/unidades.jsx), Invasión Pi, el tirón de cuerda… y cualquier
//  herramienta que necesite convertir (p. ej. trigonometría: gradosARadianes,
//  radianesAGrados, fraccionDePi, convertir(x, 'angulo', '°', 'rad')).
//
//  Cada unidad lleva `si`: su valor en la unidad del SI de la magnitud
//  (longitud → m, masa → kg, capacidad y volumen → m³, tiempo → s…).
//  Así se convierte con valor · si(de) / si(a), incluso entre magnitudes que
//  comparten unidad SI (capacidad ↔ volumen: 1 l = 1 dm³).
//  Las magnitudes con «escalera» (km, hm, dam, m…) permiten contar saltos.
// ─────────────────────────────────────────────────────────────────────────────

// ── Formato de números (español) ─────────────────────────────────────────────
const SUPS = { '-': '⁻', 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' };
export const sup = (n) => String(n).split('').map((c) => SUPS[c] ?? c).join('');

/** Quita el ruido de coma flotante (0,1 + 0,2 → 0,3). */
export const limpio = (x) => (Number.isFinite(x) ? Number(Number(x).toPrecision(12)) : x);

/** Nº de cifras decimales de un número ya «limpio». */
export const decimalesDe = (x) => {
    const v = Math.abs(limpio(x));
    if (!Number.isFinite(v) || Number.isInteger(v)) return 0;
    const s = v.toFixed(15).replace(/0+$/, '');
    return (s.split('.')[1] || '').length;
};

/**
 * Número en español: coma decimal, grupos de tres con espacio fino a partir de 5 cifras
 * (norma RAE) y notación científica si es muy grande o muy pequeño.
 *   cientifica: 'auto' (≥ 10⁹ o < 10⁻⁶) · true (siempre) · false (nunca)
 */
export function fmt(x, { cientifica = 'auto' } = {}) {
    if (x === null || x === undefined || Number.isNaN(x)) return '—';
    if (!Number.isFinite(x)) return '∞';
    const v = limpio(x);
    if (v === 0) return '0';
    const neg = v < 0;
    const a = Math.abs(v);
    if (cientifica === true || (cientifica === 'auto' && (a >= 1e9 || a < 1e-6))) {
        let e = Math.floor(Math.log10(a));
        let m = Number((a / 10 ** e).toPrecision(4));
        if (m >= 10) { m /= 10; e += 1; }
        const mt = String(m).replace('.', ',');
        return `${neg ? '−' : ''}${mt === '1' ? '' : `${mt} · `}10${sup(e)}`;
    }
    // demasiados decimales (1/3, 760 mmHg…): 6 cifras significativas
    const ar = decimalesDe(a) > 6 ? Number(a.toPrecision(6)) : a;
    let s = String(ar);
    if (s.includes('e')) s = ar.toFixed(15).replace(/0+$/, '').replace(/\.$/, '');
    let [ent, dec] = s.split('.');
    if (ent.length > 4) ent = ent.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    return (neg ? '−' : '') + ent + (dec ? `,${dec}` : '');
}

/** Factor «bonito»: potencia de 10 grande → 10ⁿ (con `potencias`), si no, número. */
export const fmtFactor = (f, potencias = false) => {
    const e = Math.log10(f);
    if (potencias && Number.isInteger(limpio(e)) && Math.abs(e) >= 4) return `10${sup(Math.round(e))}`;
    return fmt(f, { cientifica: false });
};

/** Lee un número escrito por el alumno: «3,5», «3 500», «3.500», «−2», «4,5·10^-3», «4,5e-3», «4,5 · 10⁻³». */
export function leerNumero(txt) {
    let t = String(txt ?? '').trim();
    if (!t) return NaN;
    t = t.replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹⁻]+/g, (m) => '^' + m.split('').map((c) => Object.keys(SUPS).find((k) => SUPS[k] === c)).join(''));
    t = t.replace(/\s| /g, '').replace(/[−–]/g, '-').replace(/[a-df-zA-DF-Z°'"€%²³µ/]+$/g, '');
    let mant = t, exp = 0;
    const m = t.match(/^(.*?)(?:[·x*×]10\^?\(?(-?\d+)\)?|[eE](-?\d+))$/);
    if (m) { mant = m[1]; exp = Number(m[2] ?? m[3]); }
    if (/^10\^?\(?-?\d+\)?$/.test(t)) { mant = '1'; exp = Number(t.replace(/^10\^?\(?/, '').replace(/\)$/, '')); }
    if (mant.includes(',')) mant = mant.replace(/\./g, '').replace(',', '.');
    else if (/^-?\d{1,3}(\.\d{3})+$/.test(mant)) mant = mant.replace(/\./g, '');
    if (!/^-?\d*\.?\d+$/.test(mant)) return NaN;
    return limpio(Number(mant) * 10 ** exp);
}

/** ¿Es correcta la respuesta? Tolerancia relativa (redondeos) con un mínimo absoluto. */
export const respuestaOk = (txt, esperado, { tolRel = 1e-4, tolAbs = 1e-9 } = {}) => {
    const v = leerNumero(txt);
    if (Number.isNaN(v)) return null;
    return Math.abs(v - esperado) <= Math.max(tolAbs, Math.abs(esperado) * tolRel);
};

/** Valor con su unidad: «25 °C», «3,5 km», pero «45°», «30'» (sin espacio). */
export const conU = (v, un) => `${typeof v === 'number' ? fmt(v) : v}${['°', "'", '"'].includes(un) ? '' : ' '}${un}`;

// ── Definición de magnitudes ─────────────────────────────────────────────────
const u = (s, n, si, extra = {}) => ({ s, n, si, ...extra });

// Escaleras decimales: prefijos k, h, da, (base), d, c, m
const escaleraDecimal = (base, nombreBase, siBase, exp = 1) => {
    const pref = [['k', 'kilo', 3], ['h', 'hecto', 2], ['da', 'deca', 1], ['', '', 0], ['d', 'deci', -1], ['c', 'centi', -2], ['m', 'mili', -3]];
    const marca = exp === 2 ? '²' : exp === 3 ? '³' : '';
    const nombreExp = exp === 2 ? ' cuadrado' : exp === 3 ? ' cúbico' : '';
    return pref.map(([p, np, e]) => u(`${p}${base}${marca}`, `${np}${nombreBase}${nombreExp}`, siBase * 10 ** (e * exp) ));
};

export const MAGNITUDES = {
    longitud: {
        id: 'longitud', nombre: 'Longitud', emoji: '📏', color: '#2980b9', si: 'm', etapa: 'primaria',
        desc: 'km, hm, dam, m, dm, cm, mm',
        unidades: [...escaleraDecimal('m', 'metro', 1), u('µm', 'micrómetro', 1e-6, { nivel: 3 }), u('nm', 'nanómetro', 1e-9, { nivel: 3 })],
        escalera: ['km', 'hm', 'dam', 'm', 'dm', 'cm', 'mm'], salto: 10,
        explica: 'Cada unidad es 10 veces mayor que la siguiente. Para bajar un peldaño (a una unidad menor) se multiplica por 10; para subir, se divide entre 10.',
    },
    masa: {
        id: 'masa', nombre: 'Masa', emoji: '⚖️', color: '#8e44ad', si: 'kg', etapa: 'primaria',
        desc: 't, kg, hg, dag, g, dg, cg, mg',
        unidades: [u('t', 'tonelada', 1000, { nivel: 2 }), u('q', 'quintal métrico', 100, { nivel: 2, pl: 'quintales métricos' }), ...escaleraDecimal('g', 'gramo', 0.001)],
        escalera: ['kg', 'hg', 'dag', 'g', 'dg', 'cg', 'mg'], salto: 10,
        explica: 'Igual que la longitud: cada salto es ×10 o ÷10. Además, 1 tonelada (t) = 1 000 kg y 1 quintal (q) = 100 kg.',
    },
    capacidad: {
        id: 'capacidad', nombre: 'Capacidad', emoji: '🥛', color: '#16a085', si: 'm³', etapa: 'primaria',
        desc: 'kl, hl, dal, l, dl, cl, ml',
        unidades: escaleraDecimal('l', 'litro', 0.001),
        escalera: ['kl', 'hl', 'dal', 'l', 'dl', 'cl', 'ml'], salto: 10,
        explica: 'La capacidad es lo que cabe en un recipiente. Su escalera también va de 10 en 10: 1 l = 10 dl = 100 cl = 1 000 ml.',
    },
    superficie: {
        id: 'superficie', nombre: 'Superficie', emoji: '🟩', color: '#27ae60', si: 'm²', etapa: 'eso',
        desc: 'km², hm², dam², m², dm², cm², mm² y ha, a, ca',
        unidades: [...escaleraDecimal('m', 'metro', 1, 2), u('ha', 'hectárea', 1e4, { equivale: 'hm²' }), u('a', 'área', 100, { equivale: 'dam²' }), u('ca', 'centiárea', 1, { equivale: 'm²' })],
        escalera: ['km²', 'hm²', 'dam²', 'm²', 'dm²', 'cm²', 'mm²'], salto: 100,
        explica: 'Un cuadrado de 1 m de lado contiene 10 × 10 = 100 cuadrados de 1 dm: cada salto es ×100 (la coma se mueve 2 lugares). Las medidas agrarias: 1 ha = 1 hm², 1 a = 1 dam², 1 ca = 1 m².',
    },
    volumen: {
        id: 'volumen', nombre: 'Volumen', emoji: '🧊', color: '#e67e22', si: 'm³', etapa: 'eso',
        desc: 'km³, hm³, dam³, m³, dm³, cm³, mm³',
        unidades: escaleraDecimal('m', 'metro', 1, 3),
        escalera: ['km³', 'hm³', 'dam³', 'm³', 'dm³', 'cm³', 'mm³'], salto: 1000,
        explica: 'Un cubo de 1 m de arista contiene 10 × 10 × 10 = 1 000 cubos de 1 dm: cada salto es ×1 000 (la coma se mueve 3 lugares).',
    },
    volcap: {
        id: 'volcap', nombre: 'Volumen ↔ capacidad', emoji: '🫙', color: '#d35400', si: 'm³', etapa: 'eso',
        desc: '1 dm³ = 1 l · 1 cm³ = 1 ml · 1 m³ = 1 kl',
        unidades: [...escaleraDecimal('m', 'metro', 1, 3).slice(3, 7), ...escaleraDecimal('l', 'litro', 0.001)],
        puentes: [['m³', 'kl'], ['dm³', 'l'], ['cm³', 'ml']],
        explica: 'Un cubo de 1 dm de arista se llena exactamente con 1 litro. Por eso 1 dm³ = 1 l, 1 cm³ = 1 ml y 1 m³ = 1 000 l = 1 kl.',
    },
    tiempo: {
        id: 'tiempo', nombre: 'Tiempo', emoji: '⏱️', color: '#c0392b', si: 's', etapa: 'primaria',
        desc: 'días, h, min, s',
        unidades: [u('día', 'día', 86400), u('h', 'hora', 3600), u('min', 'minuto', 60), u('s', 'segundo', 1)],
        escalera: ['día', 'h', 'min', 's'], saltos: [24, 60, 60],
        explica: 'El tiempo NO es decimal: 1 día = 24 h, 1 h = 60 min y 1 min = 60 s. Por eso 1 h = 60 · 60 = 3 600 s.',
    },
    angulo: {
        id: 'angulo', nombre: 'Ángulos', emoji: '📐', color: '#6c5ce7', si: 'rad', etapa: 'eso',
        desc: 'grados, minutos, segundos, radianes y vueltas',
        unidades: [u('vuelta', 'vuelta', 2 * Math.PI), u('°', 'grado', Math.PI / 180), u("'", 'minuto', Math.PI / 10800), u('"', 'segundo', Math.PI / 648000), u('rad', 'radián', 1, { pl: 'radianes' })],
        escalera: ['°', "'", '"'], saltos: [60, 60],
        explica: 'Una vuelta completa son 360° = 2π rad, así que 180° = π rad. Cada grado tiene 60 minutos (60\') y cada minuto 60 segundos (60").',
    },
    temperatura: {
        id: 'temperatura', nombre: 'Temperatura', emoji: '🌡️', color: '#e74c3c', si: 'K', etapa: 'eso', especial: true,
        desc: '°C, K y °F',
        unidades: [u('°C', 'grado Celsius', null), u('K', 'kelvin', null, { pl: 'kelvin' }), u('°F', 'grado Fahrenheit', null)],
        explica: 'No se convierte multiplicando: las escalas tienen distinto cero. K = °C + 273 · °F = °C · 1,8 + 32. El agua se congela a 0 °C = 273 K = 32 °F y hierve a 100 °C = 373 K = 212 °F.',
    },
    velocidad: {
        id: 'velocidad', nombre: 'Velocidad', emoji: '🚗', color: '#0984e3', si: 'm/s', etapa: 'eso', compuesta: true,
        desc: 'km/h, m/s, m/min, cm/s',
        unidades: [
            u('km/h', 'kilómetros por hora', null, { num: ['longitud', 'km'], den: ['tiempo', 'h'] }),
            u('m/s', 'metros por segundo', null, { num: ['longitud', 'm'], den: ['tiempo', 's'] }),
            u('m/min', 'metros por minuto', null, { num: ['longitud', 'm'], den: ['tiempo', 'min'] }),
            u('km/min', 'kilómetros por minuto', null, { num: ['longitud', 'km'], den: ['tiempo', 'min'], nivel: 3 }),
            u('cm/s', 'centímetros por segundo', null, { num: ['longitud', 'cm'], den: ['tiempo', 's'] }),
        ],
        explica: 'Es una unidad compuesta (longitud ÷ tiempo): se cambia la unidad de arriba y la de abajo, cada una con su factor. Truco: de km/h a m/s se divide entre 3,6.',
    },
    densidad: {
        id: 'densidad', nombre: 'Densidad', emoji: '🧱', color: '#6d4c41', si: 'kg/m³', etapa: 'eso', compuesta: true,
        desc: 'kg/m³, g/cm³, g/l, kg/l, g/ml',
        unidades: [
            u('kg/m³', 'kilogramos por metro cúbico', null, { num: ['masa', 'kg'], den: ['volumen', 'm³'] }),
            u('g/cm³', 'gramos por centímetro cúbico', null, { num: ['masa', 'g'], den: ['volumen', 'cm³'] }),
            u('g/l', 'gramos por litro', null, { num: ['masa', 'g'], den: ['capacidad', 'l'] }),
            u('kg/l', 'kilogramos por litro', null, { num: ['masa', 'kg'], den: ['capacidad', 'l'] }),
            u('g/ml', 'gramos por mililitro', null, { num: ['masa', 'g'], den: ['capacidad', 'ml'] }),
            u('kg/dm³', 'kilogramos por decímetro cúbico', null, { num: ['masa', 'kg'], den: ['volumen', 'dm³'], nivel: 3 }),
        ],
        explica: 'Densidad = masa ÷ volumen. Se cambian la masa (arriba) y el volumen (abajo). Recuerda: 1 g/cm³ = 1 kg/l = 1 000 kg/m³ (el agua).',
    },
    presion: {
        id: 'presion', nombre: 'Presión', emoji: '🎈', color: '#00838f', si: 'Pa', etapa: 'bach',
        desc: 'Pa, hPa, kPa, bar, mbar, atm, mmHg',
        unidades: [u('Pa', 'pascal', 1), u('hPa', 'hectopascal', 100), u('kPa', 'kilopascal', 1000), u('bar', 'bar', 1e5), u('mbar', 'milibar', 100), u('atm', 'atmósfera', 101325), u('mmHg', 'milímetro de mercurio', 101325 / 760)],
        explica: '1 atm = 760 mmHg = 101 325 Pa ≈ 1 013 hPa (= 1 013 mbar). El hectopascal es la unidad de los mapas del tiempo.',
    },
    energia: {
        id: 'energia', nombre: 'Energía', emoji: '🔋', color: '#f39c12', si: 'J', etapa: 'bach',
        desc: 'J, kJ, cal, kcal, Wh, kWh',
        unidades: [u('J', 'julio', 1), u('kJ', 'kilojulio', 1000), u('cal', 'caloría', 4.18), u('kcal', 'kilocaloría', 4180), u('Wh', 'vatio hora', 3600), u('kWh', 'kilovatio hora', 3.6e6)],
        explica: '1 cal = 4,18 J (la energía para calentar 1 g de agua 1 °C). 1 kWh = 1 000 W · 3 600 s = 3 600 000 J: la unidad de la factura de la luz.',
    },
    potencia: {
        id: 'potencia', nombre: 'Potencia', emoji: '⚡', color: '#fbc531', si: 'W', etapa: 'bach',
        desc: 'W, kW, MW, CV',
        unidades: [u('W', 'vatio', 1), u('kW', 'kilovatio', 1000), u('MW', 'megavatio', 1e6), u('CV', 'caballo de vapor', 735)],
        explica: '1 kW = 1 000 W. El caballo de vapor (CV) de los coches: 1 CV ≈ 735 W.',
    },
};

export const LISTA_MAGNITUDES = Object.values(MAGNITUDES);

// Qué magnitudes salen primero según desde dónde se abre la herramienta
export const MAGNITUDES_CONTEXTO = {
    primaria: ['longitud', 'masa', 'capacidad', 'tiempo', 'superficie'],
    geometria: ['longitud', 'superficie', 'volumen', 'volcap', 'capacidad', 'masa', 'angulo'],
    fisica: ['longitud', 'masa', 'tiempo', 'volumen', 'volcap', 'velocidad', 'densidad', 'temperatura', 'presion', 'energia', 'potencia'],
    trigonometria: ['angulo'],
};

// ── Acceso a unidades ────────────────────────────────────────────────────────
const indice = {};
LISTA_MAGNITUDES.forEach((m) => {
    indice[m.id] = {};
    m.unidades.forEach((un) => { indice[m.id][un.s] = un; });
});

export const unidad = (mag, s) => indice[mag]?.[s] || null;

/** Valor de la unidad en el SI (también para las compuestas: si(num) / si(den)). */
export function siDe(mag, s) {
    const un = unidad(mag, s);
    if (!un) return NaN;
    if (un.num) return siDe(un.num[0], un.num[1]) / siDe(un.den[0], un.den[1]);
    return un.si;
}

/** Unidades de la magnitud disponibles en ese nivel (1 Primaria · 2 ESO · 3 Bachillerato). */
export const unidadesDe = (mag, nivel = 3) => (MAGNITUDES[mag]?.unidades || []).filter((un) => (un.nivel || 1) <= nivel).map((un) => un.s);

export const nombreUnidad = (mag, s, valor = 2) => {
    const un = unidad(mag, s);
    if (!un) return s;
    if (Math.abs(valor) === 1 || un.num) return un.n;
    if (un.pl) return un.pl;
    // «metro cuadrado» → «metros cuadrados», «pascal» → «pascales»
    const plural = (p) => p + (/[aeiouáéó]$/.test(p) ? 's' : 'es');
    return un.n.split(' ').map((p, i) => (i === 0 || /^(cuadrado|cúbico)$/.test(p) ? plural(p) : p)).join(' ');
};

// ── Temperatura ──────────────────────────────────────────────────────────────
const aCelsius = (v, de) => (de === '°C' ? v : de === 'K' ? v - 273 : (v - 32) / 1.8);
const deCelsius = (c, a) => (a === '°C' ? c : a === 'K' ? c + 273 : c * 1.8 + 32);

// ── Conversión ───────────────────────────────────────────────────────────────
export function convertir(valor, mag, de, a) {
    if (de === a) return valor;
    if (mag === 'temperatura') return limpio(deCelsius(aCelsius(valor, de), a));
    return limpio((valor * siDe(mag, de)) / siDe(mag, a));
}

/** Cuántas veces cabe `a` en `de` (1 de = k a). */
export const relacion = (mag, de, a) => limpio(siDe(mag, de) / siDe(mag, a));

// ── Ángulos (para trigonometría y otras herramientas) ────────────────────────
export const gradosARadianes = (g) => (g * Math.PI) / 180;
export const radianesAGrados = (r) => (r * 180) / Math.PI;
const mcd = (a, b) => (b ? mcd(b, a % b) : Math.abs(a));
/** 60° → { n: 1, d: 3, texto: 'π/3' }; 135° → '3π/4'; 37° → '37π/180'. Solo grados enteros. */
export function fraccionDePi(grados) {
    const g = Math.round(grados);
    if (g === 0) return { n: 0, d: 1, texto: '0' };
    const k = mcd(g, 180);
    const n = g / k, d = 180 / k;
    const num = n === 1 ? 'π' : n === -1 ? '−π' : `${n < 0 ? '−' : ''}${Math.abs(n)}π`;
    return { n, d, texto: d === 1 ? num : `${num}/${d}` };
}
/** 12,345° → { g: 12, m: 20, s: 42 } */
export function aSexagesimal(grados) {
    const totalS = Math.round(Math.abs(grados) * 3600);
    return { g: Math.floor(totalS / 3600) * Math.sign(grados || 1), m: Math.floor((totalS % 3600) / 60), s: totalS % 60 };
}
export const textoSexagesimal = ({ g, m, s }) => `${g}°${m ? ` ${m}'` : ''}${s ? ` ${s}"` : ''}`;

// ── Método de los saltos (escaleras) ─────────────────────────────────────────
/** Escalera de la magnitud (o null) con el factor de cada salto. */
export function escaleraDe(mag) {
    const M = MAGNITUDES[mag];
    if (!M?.escalera) return null;
    const saltos = M.saltos || M.escalera.slice(1).map(() => M.salto);
    return { peldanos: M.escalera, saltos };
}

/**
 * Saltos de `de` a `a` en la escalera: { n, baja, factores, total, comas } o null.
 * baja = hacia unidades menores → se multiplica. comas = lugares que se mueve la coma (si es decimal).
 */
export function saltosEntre(mag, de, a) {
    const esc = escaleraDe(mag);
    if (!esc) return null;
    // ha, a, ca equivalen a hm², dam², m²
    const eq = (s) => unidad(mag, s)?.equivale || s;
    const i = esc.peldanos.indexOf(eq(de)), j = esc.peldanos.indexOf(eq(a));
    if (i < 0 || j < 0) return null;
    const baja = j > i;
    const factores = baja ? esc.saltos.slice(i, j) : esc.saltos.slice(j, i);
    const total = factores.reduce((p, f) => p * f, 1);
    const decimal = factores.every((f) => [10, 100, 1000].includes(f));
    return { n: Math.abs(j - i), baja, factores, total, desde: i, hasta: j, comas: decimal ? Math.round(Math.log10(total)) : null };
}

export const tieneEscalera = (mag, de, a) => !!saltosEntre(mag, de, a);

// ── Método de los factores de conversión ─────────────────────────────────────
// Un factor es una fracción igual a 1: { arriba: [k, unidad], abajo: [k, unidad] }
const factorSimple = (magDe, de, magA, a) => {
    const k = limpio(siDe(magDe, de) / siDe(magA, a)); // 1 de = k a
    return k >= 1 ? { arriba: [k, a], abajo: [1, de] } : { arriba: [1, a], abajo: [limpio(1 / k), de] };
};

/** Lista de factores para pasar de `de` a `a` (simples: uno; compuestas: uno arriba y otro abajo). */
export function factoresEntre(mag, de, a) {
    if (de === a || mag === 'temperatura') return [];
    const ud = unidad(mag, de), ua = unidad(mag, a);
    if (ud?.num && ua?.num) {
        const out = [];
        if (ud.num[1] !== ua.num[1] || ud.num[0] !== ua.num[0]) out.push(factorSimple(ud.num[0], ud.num[1], ua.num[0], ua.num[1]));
        if (ud.den[1] !== ua.den[1] || ud.den[0] !== ua.den[0]) {
            // la unidad del denominador está abajo: el factor la lleva ARRIBA para que se simplifique
            const f = factorSimple(ua.den[0], ua.den[1], ud.den[0], ud.den[1]);
            out.push(f);
        }
        return out;
    }
    return [factorSimple(mag, de, mag, a)];
}

// ── Pasos explicados ─────────────────────────────────────────────────────────
const verbo = (baja) => (baja ? 'multiplica' : 'divide');
const porEntre = (baja) => (baja ? '·' : ':');

/** Pasos con el método de los saltos (o null si no hay escalera). */
export function pasosSaltos(valor, mag, de, a) {
    const sal = saltosEntre(mag, de, a);
    if (!sal) return null;
    const res = convertir(valor, mag, de, a);
    const pasos = [];
    const iguales = sal.factores.every((f) => f === sal.factores[0]);
    pasos.push(`De ${de} a ${a} hay ${sal.n} ${sal.n === 1 ? 'salto' : 'saltos'} hacia ${sal.baja ? 'abajo (unidad menor)' : 'arriba (unidad mayor)'}.`);
    pasos.push(iguales && sal.n > 1
        ? `Cada salto ${sal.baja ? '×' : '÷'} ${fmt(sal.factores[0])} → ${verbo(sal.baja)} por ${sal.factores.map(fmt).join(' · ')} = ${fmt(sal.total)}`
        : `${sal.baja ? 'Multiplica' : 'Divide'} por ${sal.factores.map(fmt).join(' · ')} = ${fmt(sal.total)}`);
    if (sal.comas) pasos.push(`La coma se mueve ${sal.comas} ${sal.comas === 1 ? 'lugar' : 'lugares'} a la ${sal.baja ? 'derecha' : 'izquierda'}.`);
    pasos.push(`${fmt(valor)} ${porEntre(sal.baja)} ${fmt(sal.total)} = ${fmt(res)} ${a}`);
    return pasos;
}

/** Texto de un factor: «(1 000 m / 1 km)». */
export const textoFactor = (f, potencias = false) => `(${fmtFactor(f.arriba[0], potencias)} ${f.arriba[1]} / ${fmtFactor(f.abajo[0], potencias)} ${f.abajo[1]})`;

/** Pasos con factores de conversión (vale para todas las magnitudes menos la temperatura). */
export function pasosFactores(valor, mag, de, a, { potencias = false } = {}) {
    if (mag === 'temperatura') return pasosTemperatura(valor, de, a);
    const fs = factoresEntre(mag, de, a);
    const res = convertir(valor, mag, de, a);
    const pasos = [];
    const ud = unidad(mag, de);
    if (ud?.num) pasos.push(`Unidad compuesta: cambia ${fs.length === 2 ? 'la de arriba y la de abajo' : 'solo la que es distinta'}.`);
    fs.forEach((f) => pasos.push(`Factor: ${fmtFactor(f.arriba[0], potencias)} ${f.arriba[1]} = ${fmtFactor(f.abajo[0], potencias)} ${f.abajo[1]} → ${textoFactor(f, potencias)}`));
    const num = fs.reduce((p, f) => p * f.arriba[0], valor);
    const den = fs.reduce((p, f) => p * f.abajo[0], 1);
    pasos.push(`${fmt(valor)} ${de} · ${fs.map((f) => textoFactor(f, potencias)).join(' · ')} = ${den === 1 ? '' : `${fmt(limpio(num))} / ${fmt(den)} = `}${fmt(res)} ${a}`);
    return pasos;
}

export function pasosTemperatura(valor, de, a) {
    const c = limpio(aCelsius(valor, de));
    const pasos = [];
    if (de === 'K') pasos.push(`°C = K − 273 = ${fmt(valor)} − 273 = ${fmt(c)} °C`);
    if (de === '°F') pasos.push(`°C = (°F − 32) : 1,8 = (${fmt(valor)} − 32) : 1,8 = ${fmt(c)} °C`);
    if (a === 'K') pasos.push(`K = °C + 273 = ${fmt(c)} + 273 = ${fmt(c + 273)} K`);
    if (a === '°F') pasos.push(`°F = °C · 1,8 + 32 = ${fmt(c)} · 1,8 + 32 = ${fmt(limpio(c * 1.8 + 32))} °F`);
    if (a === '°C' && de === '°C') pasos.push(`${fmt(valor)} °C`);
    return pasos;
}

/** Pasos para radianes (con π cuando se puede). */
export function pasosAngulo(valor, de, a) {
    if (de === '°' && a === 'rad') {
        const fr = Number.isInteger(valor) ? fraccionDePi(valor) : null;
        return [`180° = π rad → factor (π rad / 180°)`, `${fmt(valor)}° · π / 180 = ${fr ? `${fr.texto} rad ≈ ` : ''}${fmt(Number(gradosARadianes(valor).toFixed(4)))} rad`];
    }
    if (de === 'rad' && a === '°') return [`π rad = 180° → factor (180° / π rad)`, `${fmt(valor)} · 180 / π ≈ ${fmt(Number(radianesAGrados(valor).toFixed(2)))}°`];
    return pasosSaltos(valor, 'angulo', de, a) || pasosFactores(valor, 'angulo', de, a);
}

/** Pasos por el método pedido: 'saltos' | 'factor' (si no hay escalera, factores). */
export function pasosConversion(valor, mag, de, a, metodo = 'factor', opts = {}) {
    if (mag === 'temperatura') return pasosTemperatura(valor, de, a);
    if (mag === 'angulo' && (de === 'rad' || a === 'rad')) return pasosAngulo(valor, de, a);
    if (mag === 'volcap') return pasosVolcap(valor, de, a, metodo);
    if (metodo === 'saltos') { const p = pasosSaltos(valor, mag, de, a); if (p) return p; }
    return pasosFactores(valor, mag, de, a, opts);
}

// Volumen ↔ capacidad: se pasa a la unidad «puente» y se usa la equivalencia
function pasosVolcap(valor, de, a, metodo) {
    const esVol = (s) => s.includes('³');
    if (esVol(de) === esVol(a)) {
        const mag = esVol(de) ? 'volumen' : 'capacidad';
        return metodo === 'saltos' ? pasosSaltos(valor, mag, de, a) : pasosFactores(valor, mag, de, a);
    }
    const puentes = MAGNITUDES.volcap.puentes;
    // puente más cercano a la unidad de destino
    const [pv, pc] = esVol(a) ? puentes.find(([v]) => v === a) || puentes[1] : puentes.find(([, c]) => c === a) || puentes[1];
    const pasos = [];
    if (esVol(de)) {
        const v1 = convertir(valor, 'volumen', de, pv);
        if (de !== pv) pasos.push(`${fmt(valor)} ${de} = ${fmt(v1)} ${pv}`);
        pasos.push(`1 ${pv} = 1 ${pc} → ${fmt(v1)} ${pv} = ${fmt(v1)} ${pc}`);
        if (pc !== a) pasos.push(`${fmt(v1)} ${pc} = ${fmt(convertir(v1, 'capacidad', pc, a))} ${a}`);
    } else {
        const c1 = convertir(valor, 'capacidad', de, pc);
        if (de !== pc) pasos.push(`${fmt(valor)} ${de} = ${fmt(c1)} ${pc}`);
        pasos.push(`1 ${pc} = 1 ${pv} → ${fmt(c1)} ${pc} = ${fmt(c1)} ${pv}`);
        if (pv !== a) pasos.push(`${fmt(c1)} ${pv} = ${fmt(convertir(c1, 'volumen', pv, a))} ${a}`);
    }
    return pasos;
}

/** Magnitud con escalera a la que pertenecen dos unidades de volcap (para dibujarla). */
export const magnitudDibujo = (mag, de, a) => {
    if (mag !== 'volcap') return mag;
    const esVol = (s) => s.includes('³');
    if (esVol(de) && esVol(a)) return 'volumen';
    if (!esVol(de) && !esVol(a)) return 'capacidad';
    return 'volcap';
};
