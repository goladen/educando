// ─── Modelo de «Mi empresa de placas solares» ─────────────────────────────────
// Cálculos puros (sin React): pedido del cliente generado con semilla, encaje de
// paneles en el tejado, producción según el sol (HSP por mes y pérdidas por
// orientación e inclinación con la fórmula del IDAE), autoconsumo y batería,
// presupuesto con materiales + profesionales, amortización y eficiencia energética.
// Todas las preguntas de la situación salen de aquí (preguntasFase), así el
// informe al profesor y la interfaz cuentan exactamente lo mismo.

export const r2 = x => Math.round((x + Number.EPSILON) * 100) / 100;
const r3 = x => Math.round((x + Number.EPSILON) * 1000) / 1000;
const suma = a => a.reduce((s, x) => s + x, 0);
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

export function fmt(x, d = 2) {
    return (Number.isFinite(x) ? x : 0).toLocaleString('es-ES', { minimumFractionDigits: d, maximumFractionDigits: d });
}
export const eur = (x, d = 2) => `${fmt(x, d)} €`;

// Devuelve las lecturas posibles de lo que escribe el alumno («4,1», «4.1», «4.948» = 4948, «4 948 €»…)
export function lecturasNum(s) {
    if (s == null) return [];
    let t = String(s).trim().replace(/\s|€|%/g, '');
    if (!t) return [];
    if (t.includes(',')) return [parseFloat(t.replace(/\./g, '').replace(',', '.'))].filter(Number.isFinite);
    const out = [parseFloat(t)];
    if (/^-?\d{1,3}(\.\d{3})+$/.test(t)) out.push(parseFloat(t.replace(/\./g, '')));
    return out.filter(Number.isFinite);
}

export function mulberry32(a) {
    return function () {
        a |= 0; a = (a + 0x6D2B79F5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

// ─── Datos ────────────────────────────────────────────────────────────────────
export const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
export const MESES_LARGOS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
export const DIAS_MES = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

export const PR = 0.8;             // rendimiento global (inversor, cables, temperatura, suciedad)
export const MARGEN_BORDE = 0.3;   // m libres en cada borde del tejado (viento y seguridad)
export const DEGRADACION = 0.005;  // pérdida anual de producción de los paneles
export const SUBIDA_LUZ = 0.02;    // subida anual estimada del precio de la luz
export const VIDA = 25;            // años de vida útil de la instalación
export const CICLOS = 300;         // ciclos de carga de la batería al año
export const DOD = 0.9;            // parte de la batería que se puede usar
export const CO2_KWH = 0.2;        // kg de CO₂ por kWh de la red (aprox., mezcla eléctrica)
export const IVA = 21;
export const KWP_MIN = 1.4;        // potencia mínima de una instalación (hay que poder elegir inversor)
export const AUTO_MAX = 0.6;       // como mucho el 60 % del consumo ocurre con sol

// Horas de sol pico (kWh/m² al día) con los paneles en su inclinación óptima. Valores
// aproximados redondeados a partir de PVGIS; suficientes para comparar ciudades y meses.
export const CIUDADES = [
    { id: 'sevilla',   nombre: 'Sevilla',      lat: 37.4, hsp: [4.5, 5.3, 6.0, 6.2, 6.6, 6.9, 7.2, 7.0, 6.4, 5.4, 4.6, 4.0] },
    { id: 'madrid',    nombre: 'Madrid',       lat: 40.4, hsp: [4.0, 4.9, 5.6, 5.8, 6.2, 6.6, 7.0, 6.8, 6.1, 5.0, 4.1, 3.6] },
    { id: 'valencia',  nombre: 'Valencia',     lat: 39.5, hsp: [4.2, 4.9, 5.5, 5.6, 5.9, 6.2, 6.4, 6.1, 5.6, 4.9, 4.3, 3.9] },
    { id: 'zaragoza',  nombre: 'Zaragoza',     lat: 41.6, hsp: [3.6, 4.6, 5.4, 5.6, 6.0, 6.4, 6.8, 6.5, 5.8, 4.8, 3.8, 3.2] },
    { id: 'barcelona', nombre: 'Barcelona',    lat: 41.4, hsp: [3.9, 4.6, 5.2, 5.4, 5.7, 6.0, 6.2, 5.9, 5.3, 4.6, 3.9, 3.5] },
    { id: 'coruna',    nombre: 'A Coruña',     lat: 43.4, hsp: [2.7, 3.4, 4.3, 4.4, 4.9, 5.2, 5.4, 5.4, 4.9, 3.9, 2.9, 2.5] },
    { id: 'bilbao',    nombre: 'Bilbao',       lat: 43.3, hsp: [2.4, 3.0, 3.8, 4.0, 4.6, 4.9, 5.0, 4.9, 4.4, 3.5, 2.6, 2.2] },
    { id: 'laspalmas', nombre: 'Las Palmas',   lat: 28.1, hsp: [4.8, 5.4, 5.9, 5.9, 6.0, 6.0, 6.3, 6.2, 6.0, 5.6, 5.0, 4.6] },
];

export const PANELES = [
    { id: 'poli280',   nombre: 'Policristalino 280 W',        w: 280, largo: 1.65, ancho: 0.99, precio: 70,  color: '#1e3a8a', nota: 'El más barato por vatio, pero ocupa más sitio por cada vatio.' },
    { id: 'mono410',   nombre: 'Monocristalino 410 W',        w: 410, largo: 1.72, ancho: 1.13, precio: 105, color: '#0f172a', nota: 'El más habitual en viviendas.' },
    { id: 'mono450',   nombre: 'Monocristalino 450 W',        w: 450, largo: 1.90, ancho: 1.13, precio: 120, color: '#111827', nota: 'Más potencia por panel, pero es más largo.' },
    { id: 'ntype430',  nombre: 'Alta eficiencia N-type 430 W', w: 430, largo: 1.72, ancho: 1.13, precio: 150, color: '#1f2937', nota: 'Saca más vatios del mismo hueco, pero es el más caro.' },
];

export const INVERSORES = [1.5, 2, 2.5, 3, 3.6, 4, 5, 6, 8, 10].map(kw => ({ kw, precio: Math.round((350 + 160 * kw) / 10) * 10 }));
export const BATERIAS = [{ kwh: 5, precio: 1500 }, { kwh: 10, precio: 2700 }];
export const COSTES = { estructura: 45, cableadoBase: 350, cableadoPanel: 30, transporte: 120 };

export const TARIFAS = {
    instalador:   { nombre: 'Oficial instalador/a',     emoji: '👷', eurH: 28, tarea: 'Monta la estructura y los paneles en el tejado.' },
    ayudante:     { nombre: 'Ayudante de instalación',  emoji: '🧰', eurH: 20, tarea: 'Sube el material y ayuda en el montaje (por seguridad, nunca se trabaja solo en un tejado).' },
    electricista: { nombre: 'Electricista autorizado/a', emoji: '⚡', eurH: 32, tarea: 'Conecta el inversor, las protecciones y la batería, y firma el certificado de la instalación eléctrica.' },
    ingeniero:    { nombre: 'Ingeniero/a técnico/a',    emoji: '📐', eurH: 45, tarea: 'Hace la memoria técnica (o el proyecto si pasa de 10 kWp) y la legalización.' },
};

export const PERFILES = {
    fuera: { nombre: 'Pasan el día fuera (trabajo y colegio)', auto: 0.3 },
    mixto: { nombre: 'Alguien está en casa por las mañanas', auto: 0.4 },
    casa:  { nombre: 'Teletrabajan o están jubilados: casi siempre en casa', auto: 0.55 },
};

// Reparto del consumo por meses (más en invierno y en verano por calefacción y aire)
const PESOS_CONSUMO = [1.12, 1.02, 0.95, 0.85, 0.8, 0.9, 1.12, 1.1, 0.9, 0.85, 0.97, 1.12];

export const ORIENTACION_NOMBRE = { 0: 'Sur', '-20': 'Sur-sureste', 20: 'Sur-suroeste', '-45': 'Sureste', 45: 'Suroeste', '-90': 'Este', 90: 'Oeste' };

export const MEDIDAS = [
    { id: 'led',        emoji: '💡', nombre: 'Cambiar 12 bombillas antiguas por LED', coste: 60, kwh: 300 },
    { id: 'standby',    emoji: '🔌', nombre: 'Regletas con interruptor (apagar el consumo en espera)', coste: 25, kwh: 150 },
    { id: 'eco',        emoji: '🧺', nombre: 'Lavar a 30 °C y usar los programas eco', coste: 0, kwh: 120 },
    { id: 'termostato', emoji: '🌡️', nombre: 'Termostato programable para la climatización', coste: 150, kwh: 350 },
    { id: 'frigo',      emoji: '🧊', nombre: 'Frigorífico nuevo de clase A (el actual es de 2008)', coste: 750, kwh: 280 },
    { id: 'termo',      emoji: '🚿', nombre: 'Cambiar el termo eléctrico por una bomba de calor para el agua caliente', coste: 1900, kwh: 1300, requiere: 'termo' },
    { id: 'ventanas',   emoji: '🪟', nombre: 'Ventanas de doble acristalamiento', coste: 4500, kwh: 900 },
    { id: 'desplazar',  emoji: '⏰', nombre: 'Poner la lavadora y el lavavajillas en las horas de sol', coste: 0, kwh: 0, autoExtra: 0.1 },
];

const CLIENTES = ['Familia García', 'Carmen y Luis', 'Familia Romero', 'Ana Belén Torres', 'Familia Iglesias', 'Jorge Molina', 'Familia Castro', 'Rosa y Andrés', 'Familia Domínguez', 'Pilar Herrero', 'Familia Navarro', 'Marcos y Elena'];

// ─── Cálculos ─────────────────────────────────────────────────────────────────
export function encaje(tejado, panel, orient) {
    // V = panel en vertical (lado largo siguiendo la pendiente); H = tumbado (lado largo a lo largo del alero)
    const enL = orient === 'H' ? panel.largo : panel.ancho;
    const enA = orient === 'H' ? panel.ancho : panel.largo;
    const uL = r2(tejado.largo - 2 * MARGEN_BORDE);
    const uA = r2(tejado.ancho - 2 * MARGEN_BORDE);
    const nL = Math.max(0, Math.floor(uL / enL + 1e-9));
    const nA = Math.max(0, Math.floor(uA / enA + 1e-9));
    return { enL, enA, uL, uA, nL, nA, nMax: nL * nA };
}

// Fórmula del IDAE (Pliego de condiciones técnicas): pérdidas respecto a la orientación
// e inclinación óptimas. β inclinación, α azimut (0 = sur), φ latitud.
export function perdidasOI(beta, alfa, lat) {
    const a = 1.2e-4 * (beta - lat + 10) ** 2;
    const b = beta > 15 ? 3.5e-5 * alfa ** 2 : 0;
    return Math.min(0.95, a + b);
}

export function inversoresValidos(kWp) {
    return INVERSORES.filter(i => i.kw >= r2(0.8 * kWp) - 1e-9 && i.kw <= r2(1.1 * kWp) + 1e-9);
}

export function horas(n, conBateria, kWp) {
    return {
        montaje: Math.ceil((4 + 0.5 * n) * 2) / 2,   // cada persona del equipo de montaje
        electricista: 4 + (conBateria ? 2 : 0),
        ingeniero: kWp > 10 ? 16 : 8,
    };
}

export function presupuesto({ panel, n, kWp, inversorKw, bateriaKwh, margen }) {
    const inv = INVERSORES.find(i => i.kw === inversorKw) || inversoresValidos(kWp)[0] || INVERSORES[0];
    const bat = BATERIAS.find(b => b.kwh === bateriaKwh) || null;
    const materiales = [
        { id: 'paneles', concepto: `Paneles ${panel.nombre}`, cant: n, precio: panel.precio },
        { id: 'inversor', concepto: `Inversor de ${fmt(inv.kw, 1)} kW`, cant: 1, precio: inv.precio },
        ...(bat ? [{ id: 'bateria', concepto: `Batería de ${bat.kwh} kWh`, cant: 1, precio: bat.precio }] : []),
        { id: 'estructura', concepto: 'Estructura de aluminio (por panel)', cant: n, precio: COSTES.estructura },
        { id: 'cableado', concepto: `Cableado, protecciones y cuadro (${eur(COSTES.cableadoBase, 0)} + ${eur(COSTES.cableadoPanel, 0)} por panel)`, cant: 1, precio: COSTES.cableadoBase + COSTES.cableadoPanel * n },
        { id: 'transporte', concepto: 'Transporte y elevación al tejado', cant: 1, precio: COSTES.transporte },
    ].map(l => ({ ...l, importe: l.cant * l.precio }));
    const h = horas(n, !!bat, kWp);
    const manoObra = [
        { id: 'instalador', ...TARIFAS.instalador, horas: h.montaje },
        { id: 'ayudante', ...TARIFAS.ayudante, horas: h.montaje },
        { id: 'electricista', ...TARIFAS.electricista, horas: h.electricista },
        { id: 'ingeniero', ...TARIFAS.ingeniero, horas: h.ingeniero },
    ].map(l => ({ ...l, importe: l.horas * l.eurH }));
    const mat = suma(materiales.map(l => l.importe));
    const mo = suma(manoObra.map(l => l.importe));
    const coste = mat + mo;
    const beneficio = coste * margen / 100;
    const base = coste + beneficio;
    const iva = base * IVA / 100;
    return { inv, bat, materiales, manoObra, mat, mo, coste, margen, beneficio, base, iva, total: base + iva };
}

export function energia(prod, consumo, f, batKwh, precio, comp) {
    const autoDir = Math.min(prod * f, consumo * AUTO_MAX);
    const exced = Math.max(0, prod - autoDir);
    const red = Math.max(0, consumo - autoDir);
    const capBat = batKwh * DOD * CICLOS;
    const extra = batKwh ? Math.min(exced, red, capBat) : 0;
    const ahorroSin = autoDir * precio + exced * comp;
    const ahorroBat = extra * (precio - comp);
    return {
        autoDir, exced, red, capBat, extra,
        auto: autoDir + extra, excedT: exced - extra, redT: red - extra,
        ahorroSin, ahorroBat, ahorro: ahorroSin + ahorroBat,
    };
}

export function amortizacion(inv, ahorro) {
    const q = (1 - DEGRADACION) * (1 + SUBIDA_LUZ);
    const serie = [-inv];
    let acc = -inv, anioRec = null;
    for (let y = 1; y <= VIDA; y++) {
        acc += ahorro * q ** (y - 1);
        serie.push(acc);
        if (anioRec == null && acc >= 0) anioRec = y;
    }
    return { q, serie, anioRec, neto: acc, simple: ahorro > 0 ? inv / ahorro : Infinity, rent: inv > 0 ? ahorro / inv * 100 : 0 };
}

export function calcular(p, dec = {}) {
    const t = p.tejado;
    const ciudad = CIUDADES.find(x => x.id === p.ciudad) || CIUDADES[0];
    const panel = PANELES.find(x => x.id === dec.panelId) || PANELES[1];
    const orient = dec.orient === 'H' ? 'H' : 'V';
    const fit = encaje(t, panel, orient);
    const perd = perdidasOI(t.incl, t.azim, ciudad.lat);
    const hMes = ciudad.hsp.map((h, i) => h * DIAS_MES[i]);
    const hAnual = suma(hMes);
    const yieldEsp = hAnual * PR * (1 - perd);
    const kwPanel = panel.w / 1000;
    const nNec = Math.ceil(p.consumo / (kwPanel * yieldEsp) - 1e-9);
    const nMin = Math.ceil(KWP_MIN / kwPanel - 1e-9);
    const cabe = fit.nMax >= nMin;
    const nDef = clamp(Math.min(nNec, fit.nMax), nMin, fit.nMax);
    const n = cabe ? clamp(dec.n ?? nDef, nMin, fit.nMax) : 0;
    const kWp = n * kwPanel;
    const prodMes = hMes.map(h => kWp * h * PR * (1 - perd));
    const prodAnual = kWp * yieldEsp;
    const pesoTot = suma(PESOS_CONSUMO);
    const consMes = PESOS_CONSUMO.map(w => p.consumo * w / pesoTot);

    const invValidos = inversoresValidos(kWp);
    const inversorKw = dec.inversorKw ?? null;
    const invOk = invValidos.some(i => i.kw === inversorKw);
    const margen = dec.margen ?? 20;
    const bateria = dec.bateria || 0;
    const batEval = dec.bateriaEval || 5;

    const f = PERFILES[p.perfil]?.auto ?? 0.4;
    const en = energia(prodAnual, p.consumo, f, bateria, p.precio, p.comp);
    const enEval = energia(prodAnual, p.consumo, f, batEval, p.precio, p.comp);
    const presuArgs = { panel, n, kWp, inversorKw: inversorKw ?? invValidos[0]?.kw, margen };
    const presu = presupuesto({ ...presuArgs, bateriaKwh: bateria });
    const presuSin = presupuesto({ ...presuArgs, bateriaKwh: 0 });
    const presuEval = presupuesto({ ...presuArgs, bateriaKwh: batEval });
    const precioBatCliente = presuEval.total - presuSin.total;
    const amortBat = enEval.ahorroBat > 0 ? precioBatCliente / enEval.ahorroBat : Infinity;

    const inv = Math.max(0, presu.total - (p.ayuda || 0));
    const am = amortizacion(inv, en.ahorro);
    const invSin = Math.max(0, presuSin.total - (p.ayuda || 0));
    const amSin = amortizacion(invSin, en.ahorroSin);
    const enConB = energia(prodAnual, p.consumo, f, batEval, p.precio, p.comp);
    const amCon = amortizacion(Math.max(0, presuEval.total - (p.ayuda || 0)), enConB.ahorro);
    const margenMax = p.presupuestoMax ? (p.presupuestoMax / (1 + IVA / 100) / presu.coste - 1) * 100 : null;

    // Eficiencia energética
    const medidasAplic = MEDIDAS.filter(m => !m.requiere || (m.requiere === 'termo' && p.tieneTermo));
    const sel = (dec.medidas || []).filter(id => medidasAplic.some(m => m.id === id)).sort();
    const selM = medidasAplic.filter(m => sel.includes(m.id));
    const kwhAh = suma(selM.map(m => m.kwh));
    const costeMedidas = suma(selM.map(m => m.coste));
    const consumoNuevo = p.consumo - kwhAh;
    const nNuevo = Math.ceil(consumoNuevo / (kwPanel * yieldEsp) - 1e-9);
    const fDesp = selM.some(m => m.autoExtra) ? f + 0.1 : f;
    const enEfic = energia(prodAnual, consumoNuevo, fDesp, bateria, p.precio, p.comp);
    const medidasPago = medidasAplic.filter(m => m.coste > 0 && m.kwh > 0)
        .map(m => ({ ...m, anios: m.coste / (m.kwh * p.precio) }));
    const mejorMedida = medidasPago.reduce((a, b) => (b.anios < a.anios ? b : a), medidasPago[0]);

    return {
        p, dec, ciudad, panel, orient, fit, perd, hMes, hAnual, yieldEsp, kwPanel, nNec, nMin, cabe, n, kWp,
        prodMes, prodAnual, consMes, invValidos, inversorKw, invOk, margen, bateria, batEval, f,
        en, enEval, presu, presuSin, presuEval, precioBatCliente, amortBat, inv, am, amSin, amCon, margenMax,
        medidasAplic, sel, selM, kwhAh, costeMedidas, consumoNuevo, nNuevo, enEfic, medidasPago, mejorMedida,
    };
}

export function generarPedido(seed) {
    const R = mulberry32(seed);
    const pick = a => a[Math.floor(R() * a.length)];
    const paso = (min, step, k) => r2(min + step * Math.floor(R() * k));
    const ciudad = pick(CIUDADES).id;
    const tejado = { largo: paso(7, 0.5, 13), ancho: paso(4.5, 0.5, 6), incl: pick([15, 20, 25, 30, 35]), azim: pick([0, 0, 0, -20, 20, -45, 45, -90, 90]) };
    const consumo = 3000 + 100 * Math.floor(R() * 41);
    const precio = r3(0.13 + 0.005 * Math.floor(R() * 19));
    const comp = r3(0.04 + 0.005 * Math.floor(R() * 9));
    const perfil = pick(Object.keys(PERFILES));
    const tieneTermo = consumo >= 4500 && R() < 0.7;
    const ayuda = pick([0, 0, 300, 500, 800]);
    const cliente = pick(CLIENTES);
    const pideBateria = R() < 0.5;
    const factorPres = pick([0.9, 1, 1.08]);
    const p = { seed, codigo: seed.toString(36).toUpperCase(), cliente, ciudad, tejado, consumo, precio, comp, perfil, tieneTermo, ayuda, pideBateria };
    // Presupuesto máximo del cliente: a partir de un diseño de referencia (panel de 410 W,
    // 20 % de beneficio, sin batería). A veces queda justo y hay que ajustar.
    const cV = calcular(p, { panelId: 'mono410', orient: 'V' });
    const cH = calcular(p, { panelId: 'mono410', orient: 'H' });
    const ref = cV.fit.nMax >= cH.fit.nMax ? cV : cH;
    const refC = calcular(p, { panelId: 'mono410', orient: ref.orient, n: ref.n, inversorKw: ref.invValidos[0]?.kw, margen: 20 });
    p.presupuestoMax = Math.round(refC.presu.total * factorPres / 100) * 100;
    return p;
}

export const codigoASemilla = codigo => {
    const s = parseInt(String(codigo || '').trim().toLowerCase(), 36);
    return Number.isFinite(s) && s > 0 && s < 2 ** 31 ? s : null;
};
export const semillaNueva = () => 36 ** 4 + Math.floor(Math.random() * (36 ** 5 - 36 ** 4));

// ─── Preguntas de cada fase ───────────────────────────────────────────────────
// { id, tipo:'num'|'opc', txt, sol, u, dec, ent, tolAbs, tolRel, formula, pista, opciones }
export function preguntasFase(f, c) {
    const { p } = c; const t = p.tejado;
    const Q = [];
    const num = (id, txt, sol, u, o = {}) => Q.push({ id, tipo: 'num', txt, sol, u, dec: 2, ...o });
    const opc = (id, txt, opciones, sol, o = {}) => Q.push({ id, tipo: 'opc', txt, opciones, sol, ...o });
    const kD = `${c.panel.id}.${c.orient}`;
    const kN = `${kD}.${c.n}`;
    const kP = `${kN}.i${c.presu.inv.kw}.b${c.bateria}.m${c.margen}`;

    if (f === 2) {
        num('f2.sup', 'Superficie del tejado (el faldón donde irán los paneles)', t.largo * t.ancho, 'm²',
            { formula: 'largo × ancho', pista: `${fmt(t.largo, 1)} × ${fmt(t.ancho, 1)}` });
        num('f2.mes', 'Consumo medio de la casa al mes', p.consumo / 12, 'kWh',
            { formula: 'consumo anual ÷ 12', pista: `${fmt(p.consumo, 0)} ÷ 12` });
        num('f2.gasto', 'Lo que paga ahora al año por la energía que consume', p.consumo * p.precio, '€',
            { tolRel: 0.005, formula: 'consumo anual × precio del kWh', pista: `${fmt(p.consumo, 0)} × ${fmt(p.precio, 3)}` });
    }
    if (f === 3) {
        const fit = c.fit;
        num('f3.util', 'Superficie útil del tejado (quitando 0,3 m en cada borde)', fit.uL * fit.uA, 'm²',
            { formula: '(largo − 2 · 0,3) × (ancho − 2 · 0,3)', pista: `${fmt(fit.uL, 1)} × ${fmt(fit.uA, 1)}` });
        num(`f3.nL.${kD}`, 'Paneles que caben en una fila (a lo largo del alero)', fit.nL, 'paneles',
            { ent: true, dec: 0, formula: 'parte entera de (largo útil ÷ lado del panel en esa dirección)', pista: `${fmt(fit.uL, 2)} ÷ ${fmt(fit.enL, 2)} = ${fmt(fit.uL / fit.enL, 2)} → me quedo con la parte entera` });
        num(`f3.nA.${kD}`, 'Filas de paneles que caben (subiendo por la pendiente)', fit.nA, 'filas',
            { ent: true, dec: 0, formula: 'parte entera de (ancho útil ÷ lado del panel en esa dirección)', pista: `${fmt(fit.uA, 2)} ÷ ${fmt(fit.enA, 2)} = ${fmt(fit.uA / fit.enA, 2)} → parte entera` });
        num(`f3.nMax.${kD}`, 'Número máximo de paneles en el tejado', fit.nMax, 'paneles',
            { ent: true, dec: 0, formula: 'paneles por fila × filas', pista: `${fit.nL} × ${fit.nA}` });
        num(`f3.kwp.${kD}`, 'Potencia pico máxima si llenas el tejado', fit.nMax * c.panel.w / 1000, 'kWp',
            { dec: 2, tolAbs: 0.006, formula: 'nº de paneles × vatios del panel ÷ 1000', pista: `${fit.nMax} × ${c.panel.w} ÷ 1000` });
        const area = c.panel.largo * c.panel.ancho;
        num(`f3.efic.${c.panel.id}`, `Eficiencia del panel elegido (${c.panel.nombre})`, c.panel.w / (area * 1000) * 100, '%',
            { dec: 1, tolAbs: 0.15, formula: 'vatios ÷ (superficie del panel × 1000 W/m²) × 100', pista: `${c.panel.w} ÷ (${fmt(c.panel.largo, 2)} × ${fmt(c.panel.ancho, 2)} × 1000) × 100` });
        const barato = PANELES.reduce((a, b) => (b.precio / b.w < a.precio / a.w ? b : a));
        opc('f3.barato', '¿Qué panel tiene el vatio más barato?', PANELES.map(x => ({ v: x.id, label: `${x.nombre} (${eur(x.precio, 0)})` })), barato.id,
            { formula: 'precio ÷ vatios = € por vatio; compara los cuatro', pista: PANELES.map(x => `${x.precio} ÷ ${x.w}`).join(' · ') });
    }
    if (f === 4) {
        const L = c.perd;
        num('f4.perd', 'Pérdidas por orientación e inclinación', L * 100, '%',
            { dec: 2, tolAbs: 0.15, formula: t.incl > 15 ? '100 · [0,00012 · (β − φ + 10)² + 0,000035 · α²]' : '100 · 0,00012 · (β − φ + 10)²  (con β ≤ 15° no cuenta la orientación)',
              pista: t.incl > 15 ? `100 · [0,00012 · (${t.incl} − ${fmt(c.ciudad.lat, 1)} + 10)² + 0,000035 · (${t.azim})²]` : `100 · 0,00012 · (${t.incl} − ${fmt(c.ciudad.lat, 1)} + 10)²` });
        num('f4.julio', 'Energía que produce 1 kWp en julio', c.ciudad.hsp[6] * 31 * PR * (1 - L), 'kWh',
            { dec: 1, tolRel: 0.01, formula: 'HSP de julio × 31 días × 0,8 × (1 − pérdidas)', pista: `${fmt(c.ciudad.hsp[6], 1)} × 31 × 0,8 × ${fmt(1 - L, 4)}` });
        num('f4.anual', 'Energía que produce 1 kWp en un año', c.yieldEsp, 'kWh',
            { dec: 0, tolRel: 0.01, formula: 'irradiación anual × 0,8 × (1 − pérdidas)', pista: `${fmt(c.hAnual, 1)} × 0,8 × ${fmt(1 - L, 4)}` });
        num(`f4.nNec.${c.panel.id}`, 'Paneles necesarios para cubrir todo el consumo', c.nNec, 'paneles',
            { ent: true, dec: 0, formula: 'consumo ÷ (kW de un panel × kWh de 1 kWp al año), redondeando hacia arriba', pista: `${fmt(p.consumo, 0)} ÷ (${fmt(c.kwPanel, 2)} × ${fmt(c.yieldEsp, 1)}) = ${fmt(p.consumo / (c.kwPanel * c.yieldEsp), 2)}` });
        if (c.n > 0) {
            num(`f4.prod.${kN}`, `Producción anual de tu instalación (${c.n} paneles)`, c.prodAnual, 'kWh',
                { dec: 0, tolRel: 0.01, formula: 'kWp instalados × kWh de 1 kWp al año', pista: `${fmt(c.kWp, 2)} × ${fmt(c.yieldEsp, 1)}` });
            num(`f4.cob.${kN}`, 'Parte del consumo anual que cubre (puede pasar del 100 %)', c.prodAnual / p.consumo * 100, '%',
                { dec: 1, tolAbs: 0.6, formula: 'producción ÷ consumo × 100', pista: `${fmt(c.prodAnual, 0)} ÷ ${fmt(p.consumo, 0)} × 100` });
        }
        const ops = MESES_LARGOS.map((m, i) => ({ v: String(i), label: m }));
        const iMax = c.hMes.indexOf(Math.max(...c.hMes)), iMin = c.hMes.indexOf(Math.min(...c.hMes));
        opc('f4.mmax', '¿En qué mes produce más energía?', ops, String(iMax), { formula: 'HSP × días del mes: el mayor', pista: 'Mira la gráfica o multiplica cada HSP por los días del mes.' });
        opc('f4.mmin', '¿Y en qué mes produce menos?', ops, String(iMin), { formula: 'HSP × días del mes: el menor', pista: 'Ojo: febrero tiene 28 días.' });
    }
    if (f === 5 && c.n > 0) {
        const e = c.enEval; const fpc = fmt(c.f * 100, 0);
        num(`f5.auto.${kN}`, 'Energía que se gasta en el mismo momento en que se produce (autoconsumo directo)', e.autoDir, 'kWh',
            { dec: 0, tolRel: 0.01, formula: `el menor de: producción × ${fpc} %  ó  consumo × 60 %`, pista: `${fmt(c.prodAnual, 0)} × ${fmt(c.f, 2)} = ${fmt(c.prodAnual * c.f, 0)}  ·  ${fmt(p.consumo, 0)} × 0,6 = ${fmt(p.consumo * 0.6, 0)}` });
        num(`f5.exc.${kN}`, 'Excedentes: energía que sobra y se vierte a la red', e.exced, 'kWh',
            { dec: 0, tolRel: 0.01, formula: 'producción − autoconsumo', pista: `${fmt(c.prodAnual, 0)} − ${fmt(e.autoDir, 0)}` });
        num(`f5.red.${kN}`, 'Energía que la casa sigue comprando a la red', e.red, 'kWh',
            { dec: 0, tolRel: 0.01, formula: 'consumo − autoconsumo', pista: `${fmt(p.consumo, 0)} − ${fmt(e.autoDir, 0)}` });
        num(`f5.ah.${kN}`, 'Ahorro al año sin batería', e.ahorroSin, '€',
            { tolRel: 0.01, formula: 'autoconsumo × precio del kWh + excedentes × compensación', pista: `${fmt(e.autoDir, 0)} × ${fmt(p.precio, 3)} + ${fmt(e.exced, 0)} × ${fmt(p.comp, 3)}` });
        const k = `${kN}.b${c.batEval}`;
        num(`f5.ext.${k}`, `Energía extra que aprovecha la batería de ${c.batEval} kWh`, e.extra, 'kWh',
            { dec: 0, tolRel: 0.01, formula: 'el menor de: excedentes, energía de la red, capacidad × 0,9 × 300 ciclos', pista: `${fmt(e.exced, 0)} · ${fmt(e.red, 0)} · ${c.batEval} × 0,9 × 300 = ${fmt(e.capBat, 0)}` });
        num(`f5.ahb.${k}`, 'Ahorro extra al año gracias a la batería', e.ahorroBat, '€',
            { tolRel: 0.01, formula: 'energía extra × (precio del kWh − compensación)', pista: `${fmt(e.extra, 0)} × (${fmt(p.precio, 3)} − ${fmt(p.comp, 3)})` });
        if (Number.isFinite(c.amortBat)) {
            num(`f5.amb.${k}.m${c.margen}`, 'Años que tarda en pagarse la batería', c.amortBat, 'años',
                { dec: 1, tolAbs: 0.15, formula: 'precio de la batería para el cliente ÷ ahorro extra al año', pista: `${fmt(c.precioBatCliente, 2)} ÷ ${fmt(e.ahorroBat, 2)}` });
            opc(`f5.conv.${k}.m${c.margen}`, 'Con una vida útil de unos 10 años, ¿le conviene la batería?',
                [{ v: 'si', label: 'Sí: se paga antes de 10 años' }, { v: 'no', label: 'No: tarda más de 10 años en pagarse' }],
                c.amortBat <= 10 ? 'si' : 'no', { formula: 'compara los años de recuperación con la vida útil', pista: `Recuperación: ${fmt(c.amortBat, 1)} años` });
        }
    }
    if (f === 6 && c.n > 0) {
        const pr = c.presu;
        pr.manoObra.forEach(l => num(`f6.${l.id}.${kP}`, `Pago a: ${l.nombre}`, l.importe, '€',
            { tolAbs: 0.01, formula: 'horas × precio por hora', pista: `${fmt(l.horas, 1)} h × ${l.eurH} €/h` }));
        num(`f6.mo.${kP}`, 'Total de mano de obra', pr.mo, '€', { tolAbs: 0.01, formula: 'suma de los pagos a los profesionales', pista: pr.manoObra.map(l => fmt(l.importe, 2)).join(' + ') });
        num(`f6.mat.${kP}`, 'Total de materiales', pr.mat, '€', { tolAbs: 0.01, formula: 'suma de los importes (cantidad × precio)', pista: pr.materiales.map(l => fmt(l.importe, 2)).join(' + ') });
        num(`f6.ben.${kP}`, `Beneficio de tu empresa (${pr.margen} % sobre el coste)`, pr.beneficio, '€',
            { tolAbs: 0.02, formula: '(materiales + mano de obra) × % ÷ 100', pista: `${fmt(pr.coste, 2)} × ${pr.margen} ÷ 100` });
        num(`f6.iva.${kP}`, 'IVA (21 %)', pr.iva, '€', { tolAbs: 0.02, formula: '(coste + beneficio) × 0,21', pista: `${fmt(pr.base, 2)} × 0,21` });
        num(`f6.tot.${kP}`, 'Precio final para el cliente', pr.total, '€', { tolAbs: 0.03, formula: 'coste + beneficio + IVA', pista: `${fmt(pr.coste, 2)} + ${fmt(pr.beneficio, 2)} + ${fmt(pr.iva, 2)}` });
        if (c.margenMax != null && c.margenMax >= 0) {
            num(`f6.mmax.${kN}.i${pr.inv.kw}.b${c.bateria}`, 'Beneficio máximo (%) que puedes poner sin pasarte del presupuesto del cliente', c.margenMax, '%',
                { dec: 1, tolAbs: 0.15, formula: '(presupuesto máximo ÷ 1,21 ÷ coste − 1) × 100', pista: `(${fmt(p.presupuestoMax, 0)} ÷ 1,21 ÷ ${fmt(pr.coste, 2)} − 1) × 100` });
        }
    }
    if (f === 7 && c.n > 0) {
        const am = c.am;
        num(`f7.inv.${kP}`, 'Inversión real del cliente (precio − ayuda)', c.inv, '€', { tolAbs: 0.03, formula: 'precio final − ayuda', pista: `${fmt(c.presu.total, 2)} − ${fmt(p.ayuda || 0, 0)}` });
        if (c.en.ahorro > 0) {
            num(`f7.simple.${kP}`, 'Años para recuperar la inversión (sin contar subidas de la luz)', am.simple, 'años',
                { dec: 1, tolAbs: 0.15, formula: 'inversión ÷ ahorro al año', pista: `${fmt(c.inv, 2)} ÷ ${fmt(c.en.ahorro, 2)}` });
            num(`f7.rent.${kP}`, 'Rentabilidad: % de la inversión que recupera cada año', am.rent, '%',
                { dec: 1, tolAbs: 0.15, formula: 'ahorro al año ÷ inversión × 100', pista: `${fmt(c.en.ahorro, 2)} ÷ ${fmt(c.inv, 2)} × 100` });
            num(`f7.neto.${kP}`, `Beneficio neto para el cliente en ${VIDA} años`, am.neto, '€',
                { dec: 0, tolRel: 0.01, tolAbs: 20, formula: 'ahorro × (q²⁵ − 1) ÷ (q − 1) − inversión,  con q = 0,995 × 1,02', pista: `${fmt(c.en.ahorro, 2)} × (${fmt(am.q, 4)}²⁵ − 1) ÷ ${fmt(am.q - 1, 4)} − ${fmt(c.inv, 2)}` });
            if (am.anioRec) num(`f7.anio.${kP}`, 'Mirando la gráfica: ¿en qué año pasa a ganar dinero?', am.anioRec, 'año',
                { ent: true, dec: 0, formula: 'primer año en que la línea pasa por encima de 0', pista: `Busca el primer punto verde de la gráfica.` });
        }
    }
    if (f === 8) {
        const mp = c.medidasPago;
        if (mp.length) opc('f8.mejor.' + (p.tieneTermo ? 't' : 'n'), 'De las medidas que cuestan dinero, ¿cuál se paga antes con lo que ahorra?',
            mp.map(m => ({ v: m.id, label: `${m.emoji} ${m.nombre}` })), c.mejorMedida.id,
            { formula: 'coste ÷ (kWh ahorrados × precio del kWh) = años', pista: mp.map(m => `${m.emoji} ${m.coste} ÷ (${m.kwh} × ${fmt(p.precio, 3)})`).join(' · ') });
        if (c.kwhAh > 0) {
            const k = c.sel.join('+');
            num(`f8.kwh.${k}`, 'kWh que ahorra al año con las medidas elegidas', c.kwhAh, 'kWh', { ent: true, dec: 0, formula: 'suma de los kWh de cada medida', pista: c.selM.filter(m => m.kwh).map(m => m.kwh).join(' + ') });
            num(`f8.pct.${k}`, 'Porcentaje que baja el consumo', c.kwhAh / p.consumo * 100, '%', { dec: 1, tolAbs: 0.15, formula: 'kWh ahorrados ÷ consumo × 100', pista: `${c.kwhAh} ÷ ${fmt(p.consumo, 0)} × 100` });
            num(`f8.eur.${k}`, 'Dinero que ahorra al año en la factura', c.kwhAh * p.precio, '€', { tolRel: 0.005, formula: 'kWh ahorrados × precio del kWh', pista: `${c.kwhAh} × ${fmt(p.precio, 3)}` });
            num(`f8.co2.${k}`, 'CO₂ que deja de emitir al año', c.kwhAh * CO2_KWH, 'kg', { dec: 0, tolRel: 0.01, formula: 'kWh ahorrados × 0,2 kg', pista: `${c.kwhAh} × 0,2` });
            num(`f8.n.${c.panel.id}.${k}`, 'Con el nuevo consumo, ¿cuántos paneles harían falta para cubrirlo?', c.nNuevo, 'paneles',
                { ent: true, dec: 0, formula: 'nuevo consumo ÷ (kW de un panel × kWh de 1 kWp al año), hacia arriba', pista: `${fmt(c.consumoNuevo, 0)} ÷ (${fmt(c.kwPanel, 2)} × ${fmt(c.yieldEsp, 1)}) = ${fmt(c.consumoNuevo / (c.kwPanel * c.yieldEsp), 2)}` });
        }
    }
    return Q;
}

export function esCorrecta(q, v) {
    if (q.tipo === 'opc') return v === q.sol;
    const tol = q.ent ? 1e-6 : Math.max(q.tolAbs ?? 0.01, Math.abs(q.sol) * (q.tolRel ?? 0));
    return lecturasNum(v).some(x => Math.abs(x - q.sol) <= tol + 1e-9);
}

export const FASES = [
    { n: 1, emoji: '🎨', titulo: 'Tu empresa', sub: 'Nombre, eslogan y logo' },
    { n: 2, emoji: '📩', titulo: 'El pedido', sub: 'Tejado, consumo y factura del cliente' },
    { n: 3, emoji: '📐', titulo: 'Diseño en el tejado', sub: 'Tipos de panel y cuántos caben' },
    { n: 4, emoji: '☀️', titulo: 'El sol y la producción', sub: 'Meses, orientación e inclinación' },
    { n: 5, emoji: '🔋', titulo: 'Autoconsumo y batería', sub: '¿Le conviene una batería?' },
    { n: 6, emoji: '🧾', titulo: 'Presupuesto y profesionales', sub: 'Materiales, sueldos, beneficio e IVA' },
    { n: 7, emoji: '⏳', titulo: 'Amortización', sub: '¿Cuándo recupera el dinero?' },
    { n: 8, emoji: '🌿', titulo: 'Eficiencia energética', sub: 'Antes de producir, gastar menos' },
    { n: 9, emoji: '📄', titulo: 'Propuesta al cliente', sub: 'Documento final y envío' },
];
