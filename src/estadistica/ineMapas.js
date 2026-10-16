// ineMapas.js — Datos y clasificación para los mapas temáticos (coropletas) del Explorador INE.
// Un indicador se carga de una vez para todas las provincias (nivel 'p') o comunidades ('c'),
// más el valor de España como referencia. Geometría: public/ine/mapa-espana.json
// (scripts/generar-mapa-espana.mjs).
import { ine, normal } from './ineDatos';

const TODAS = 'tv=356:15668&tv=18:451'; // todas las edades · ambos sexos

// tipo: 'seq' (de menos a más) o 'div' (puede ser negativo: colores divergentes con el 0 de frontera)
export const INDICADORES = [
    { id: 'pob',   grupo: 'Población', nombre: 'Población', unidad: 'habitantes', dec: 0, tipo: 'seq', met: 'q', fuente: 'INE · Estadística Continua de Población' },
    { id: 'area',  grupo: 'Población', nombre: 'Superficie', unidad: 'km²', dec: 0, tipo: 'seq', met: 'q', fuente: 'Eurostat GISCO · LAU 2024' },
    { id: 'dens',  grupo: 'Población', nombre: 'Densidad de población', unidad: 'hab/km²', dec: 1, tipo: 'seq', met: 'q', fuente: 'INE (ECP) y Eurostat (superficie)' },
    { id: 'var10', grupo: 'Población', nombre: 'Variación de la población en 10 años', unidad: '%', dec: 1, tipo: 'div', fuente: 'INE · Estadística Continua de Población' },
    { id: 'extr',  grupo: 'Población', nombre: 'Población extranjera', unidad: '%', dec: 1, tipo: 'seq', fuente: 'INE · Estadística Continua de Población' },
    { id: 'edad',  grupo: 'Edades', nombre: 'Edad media', unidad: 'años', dec: 1, tipo: 'seq', fuente: 'INE · Indicadores Demográficos Básicos', tablas: { p: 77157, c: 3198 } },
    { id: 'env',   grupo: 'Edades', nombre: 'Índice de envejecimiento', unidad: 'mayores de 64 por cada 100 menores de 16', corta: '%', dec: 1, tipo: 'seq', fuente: 'INE · Indicadores Demográficos Básicos', tablas: { p: 1489, c: 77156 } },
    { id: 'dep',   grupo: 'Edades', nombre: 'Tasa de dependencia', unidad: '% de menores de 16 y mayores de 64 sobre 16-64', corta: '%', dec: 1, tipo: 'seq', fuente: 'INE · Indicadores Demográficos Básicos', tablas: { p: 1490, c: 1453 } },
    { id: 'evida', grupo: 'Edades', nombre: 'Esperanza de vida al nacer', unidad: 'años', dec: 1, tipo: 'seq', fuente: 'INE · Indicadores Demográficos Básicos', tablas: { p: 77117, c: 1448 }, tablaEsp: 48882 },
    { id: 'nat',   grupo: 'Movimiento natural', nombre: 'Tasa bruta de natalidad', unidad: 'nacimientos por 1.000 hab.', corta: '‰', dec: 2, tipo: 'seq', fuente: 'INE · Indicadores Demográficos Básicos', tablas: { p: 67223, c: 67222 } },
    { id: 'mort',  grupo: 'Movimiento natural', nombre: 'Tasa bruta de mortalidad', unidad: 'defunciones por 1.000 hab.', corta: '‰', dec: 2, tipo: 'seq', fuente: 'INE · Indicadores Demográficos Básicos', tablas: { p: 67229, c: 67228 } },
    { id: 'veg',   grupo: 'Movimiento natural', nombre: 'Saldo vegetativo', unidad: 'nacimientos - defunciones por 1.000 hab.', corta: '‰', dec: 2, tipo: 'div', fuente: 'INE · Indicadores Demográficos Básicos', tablas: { p: 1487, c: 77122 } },
    { id: 'mig',   grupo: 'Migraciones', nombre: 'Saldo migratorio con el extranjero', unidad: 'por 1.000 hab.', corta: '‰', dec: 2, tipo: 'div', fuente: 'INE · Indicadores Demográficos Básicos', tablas: { p: 61771, c: 61770 } },
    { id: 'crec',  grupo: 'Migraciones', nombre: 'Crecimiento de la población', unidad: 'por 1.000 hab.', corta: '‰', dec: 2, tipo: 'div', fuente: 'INE · Indicadores Demográficos Básicos', tablas: { p: 5226, c: 5225 } },
];
export const indicadorPorId = id => INDICADORES.find(i => i.id === id) || INDICADORES[2];
export const unidadCorta = ind => ind.corta || ind.unidad;

let mapaPromesa = null;
export const cargarMapa = () => (mapaPromesa ||= fetch('/ine/mapa-espana.json').then(r => {
    if (!r.ok) throw new Error('No se pudo cargar el mapa');
    return r.json();
}).catch(e => { mapaPromesa = null; throw e; }));

// ─── Cruce de series del INE con provincias / comunidades por nombre ─────────
const EXCLUIR = ['hombres', 'mujeres', 'varones', 'espanola', 'extranjera'];
// Las tablas del INE no escriben igual todos los nombres: «Coruña, A» / «Coruña (A)», «Araba/Álava» / «Álava»,
// «Madrid, Comunidad de» / «Madrid (Comunidad de)»… Cada nombre se convierte en un conjunto de variantes.
const ALIAS = { alava: 'araba', araba: 'alava', vizcaya: 'bizkaia', bizkaia: 'vizcaya', guipuzcoa: 'gipuzkoa', gipuzkoa: 'guipuzcoa' };
const cacheVar = new Map();
function variantes(nombre) {
    if (cacheVar.has(nombre)) return cacheVar.get(nombre);
    const n = normal(nombre).trim(), set = new Set([n]);
    const p = n.match(/^(.*?)\s*\((.*)\)$/) || n.match(/^(.*?), (.*)$/);
    if (p) { set.add(p[1]); set.add(`${p[2]} ${p[1]}`); }
    for (const k of [...set]) for (const parte of k.split('/')) { set.add(parte.trim()); if (ALIAS[parte.trim()]) set.add(ALIAS[parte.trim()]); }
    cacheVar.set(nombre, set);
    return set;
}
const segs = s => s.Nombre.split('. ').map(x => x.replace(/\.$/, '').trim()).filter(Boolean);
const valorUlt = s => {
    const d = (s?.Data || []).filter(x => x.Valor != null && !x.Secreto).sort((a, b) => b.Fecha - a.Fecha)[0];
    return d ? { valor: d.Valor, anyo: d.Anyo } : null;
};
function buscar(series, nombre, incluir = null) {
    const objetivo = normal(nombre) === 'total nacional' ? new Set(['total nacional']) : variantes(nombre);
    return series.find(s => {
        const g = segs(s).map(normal);
        if (!g.some(x => [...variantes(x)].some(v => objetivo.has(v)) || objetivo.has(x))) return false;
        if (incluir) return g.includes(incluir);
        return !g.some(x => EXCLUIR.includes(x));
    });
}

export const territorios = (idx, nivel) => nivel === 'p'
    ? Object.entries(idx.prov).map(([cod, p]) => ({ cod, nombre: p.n, area: p.area }))
    : Object.entries(idx.ccaa).map(([cod, c]) => ({ cod, nombre: c.n, area: c.area }));

// Valores de una lista de series para todos los territorios + España
function extraer(series, terr, incluir) {
    const valores = {}; let anyo = null;
    for (const t of terr) {
        const v = valorUlt(buscar(series, t.nombre, incluir));
        if (v) { valores[t.cod] = v.valor; anyo = Math.max(anyo || 0, v.anyo); }
    }
    const esp = valorUlt(buscar(series, 'Total Nacional', incluir));
    return { valores, espana: esp?.valor ?? null, anyo };
}

const cacheInd = new Map();
export function cargarIndicador(idx, nivel, id) {
    const k = `${nivel}:${id}`;
    if (!cacheInd.has(k)) cacheInd.set(k, cargarSinCache(idx, nivel, id).catch(e => { cacheInd.delete(k); throw e; }));
    return cacheInd.get(k);
}

async function cargarSinCache(idx, nivel, id) {
    const ind = indicadorPorId(id);
    const terr = territorios(idx, nivel);
    const tablaEcp = nivel === 'p' ? 56945 : 56940;
    const areaEsp = idx.esp.area;

    if (ind.tablas) {
        const r = extraer(await ine(`DATOS_TABLA/${ind.tablas[nivel]}?nult=1`), terr);
        // Algunas tablas por territorio no traen el total nacional: se pide a la tabla nacional
        if (r.espana == null && ind.tablaEsp) {
            try { r.espana = valorUlt(buscar(await ine(`DATOS_TABLA/${ind.tablaEsp}?nult=1`), 'Total Nacional'))?.valor ?? null; } catch { /* opcional */ }
        }
        return r;
    }

    if (id === 'area') return { valores: Object.fromEntries(terr.map(t => [t.cod, t.area])), espana: areaEsp, anyo: 2024 };

    if (id === 'pob' || id === 'dens') {
        // La tabla de provincias de la ECP no trae el total nacional: se toma de la de comunidades
        const [s, sEsp] = await Promise.all([ine(`DATOS_TABLA/${tablaEcp}?${TODAS}&nult=1`), ine(`DATOS_TABLA/56940?${TODAS}&nult=1`)]);
        const r = extraer(s, terr);
        r.espana = valorUlt(buscar(sEsp, 'Total Nacional'))?.valor ?? r.espana;
        if (id === 'dens') {
            for (const t of terr) r.valores[t.cod] = t.area ? r.valores[t.cod] / t.area : undefined;
            r.espana = r.espana && areaEsp ? r.espana / areaEsp : null;
        }
        return r;
    }

    if (id === 'var10') {
        // ECP trimestral: el 1 de enero más reciente frente al de 10 años antes
        const series = await ine(`DATOS_TABLA/${tablaEcp}?${TODAS}&nult=44`);
        const variacion = s => {
            const ene = (s?.Data || []).filter(d => d.FK_Periodo === 19 && d.Valor != null).sort((a, b) => b.Anyo - a.Anyo);
            const hace = ene.find(d => d.Anyo === ene[0]?.Anyo - 10);
            return ene[0] && hace ? { valor: (ene[0].Valor - hace.Valor) / hace.Valor * 100, anyo: ene[0].Anyo } : null;
        };
        const valores = {}; let anyo = null;
        for (const t of terr) { const v = variacion(buscar(series, t.nombre)); if (v) { valores[t.cod] = v.valor; anyo = v.anyo; } }
        let espana = variacion(buscar(series, 'Total Nacional'))?.valor ?? null;
        if (espana == null) espana = variacion(buscar(await ine(`DATOS_TABLA/56940?${TODAS}&nult=44`), 'Total Nacional'))?.valor ?? null;
        return { valores, espana, anyo, periodo: anyo ? `${anyo - 10}–${anyo}` : '' };
    }

    if (id === 'extr') {
        const series = await ine(`DATOS_TABLA/${nivel === 'p' ? 59591 : 59587}?${TODAS}&nult=1`);
        const tot = extraer(series, terr), ext = extraer(series, terr, 'extranjera');
        const valores = {};
        for (const t of terr) if (tot.valores[t.cod] && ext.valores[t.cod] != null) valores[t.cod] = ext.valores[t.cod] / tot.valores[t.cod] * 100;
        return { valores, espana: tot.espana && ext.espana != null ? ext.espana / tot.espana * 100 : null, anyo: tot.anyo };
    }
    throw new Error('Indicador desconocido');
}

// ─── Clasificación en intervalos ─────────────────────────────────────────────
export const METODOS = [
    { id: 'q', nombre: 'Cuantiles', ayuda: 'Cada color tiene más o menos el mismo número de territorios' },
    { id: 'r', nombre: 'Intervalos redondeados', ayuda: 'Intervalos de la misma amplitud con números redondos (los más fáciles de leer)' },
    { id: 'i', nombre: 'Intervalos iguales', ayuda: 'Divide el rango (máximo − mínimo) en partes iguales' },
];

const pasoBonito = (x) => {
    const e = Math.pow(10, Math.floor(Math.log10(x))), f = x / e;
    return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * e;
};
// Redondea un corte a una cifra «limpia»: ni más fino que la décima parte de su propio orden de
// magnitud ni más que el orden de magnitud de la amplitud media de clase (30 → 30, 1.234.567 → 1.200.000, 83,61 → 83,6)
const redondearCorte = (v, rango, k) => {
    if (v === 0) return 0;
    const e = Math.min(Math.pow(10, Math.floor(Math.log10(rango / k))), Math.pow(10, Math.floor(Math.log10(Math.abs(v))) - 1));
    return +(Math.round(v / e) * e).toPrecision(10);
};
const fijo = (x, dec, f) => +(f(x * Math.pow(10, dec)) / Math.pow(10, dec)).toPrecision(12);

// Devuelve los límites [b0, b1, …, bk] (k clases). Clase i: b_i ≤ v < b_{i+1} (la última incluye el máximo).
export function cortes(lista, k, metodo, divergente = false, dec = 2) {
    const v = lista.filter(x => x != null && isFinite(x)).sort((a, b) => a - b);
    if (!v.length) return [];
    const min = fijo(v[0], dec, Math.floor), max = fijo(v[v.length - 1], dec, Math.ceil), rango = max - min || 1;
    let b;
    if (metodo === 'q') {
        b = [min];
        for (let i = 1; i < k; i++) b.push(redondearCorte(v[Math.round(i * (v.length - 1) / k)], rango, k));
        b.push(max);
        b = b.filter((x, i) => i === 0 || i === b.length - 1 || (x > min && x < max));
    } else if (metodo === 'r') {
        let paso = pasoBonito(rango / k);
        let ini = Math.floor(min / paso) * paso;
        // Si con ese paso no cabe en k clases, se agranda el paso
        while (ini + paso * k < max) { paso = pasoBonito(paso * 1.01); ini = Math.floor(min / paso) * paso; }
        b = Array.from({ length: k + 1 }, (_, i) => +(ini + i * paso).toPrecision(12));
        // Quita clases vacías por arriba (puede sobrar alguna)
        while (b.length > 3 && b[b.length - 2] >= max) b.pop();
    } else {
        b = Array.from({ length: k + 1 }, (_, i) => min + rango * i / k).map((x, i, a) => i === 0 || i === a.length - 1 ? x : redondearCorte(x, rango, k));
    }
    // En indicadores con signo, el 0 debe ser frontera para que los colores fríos/cálidos tengan sentido
    if (divergente && min < 0 && max > 0 && !b.includes(0)) {
        b = [...b, 0].sort((x, y) => x - y);
        if (b.length - 1 > k) { // quita la frontera más cercana al 0 que no sea el 0 ni un extremo
            let mejor = -1;
            for (let i = 1; i < b.length - 1; i++) if (b[i] !== 0 && (mejor < 0 || Math.abs(b[i]) < Math.abs(b[mejor]))) mejor = i;
            b.splice(mejor, 1);
        }
    }
    return [...new Set(b)].sort((x, y) => x - y);
}
export const claseDe = (v, b) => {
    if (v == null || !b.length) return -1;
    for (let i = 0; i < b.length - 2; i++) if (v < b[i + 1]) return i;
    return b.length - 2;
};

// ─── Paletas (ColorBrewer, de claro a oscuro) ────────────────────────────────
export const PALETAS = {
    azul:    { nombre: 'Azules',  c: ['#eff3ff', '#c6dbef', '#9ecae1', '#6baed6', '#4292c6', '#2171b5', '#084594'] },
    verde:   { nombre: 'Verdes',  c: ['#edf8e9', '#c7e9c0', '#a1d99b', '#74c476', '#41ab5d', '#238b45', '#005a32'] },
    naranja: { nombre: 'Naranjas', c: ['#feedde', '#fdd0a2', '#fdae6b', '#fd8d3c', '#f16913', '#d94801', '#8c2d04'] },
    morado:  { nombre: 'Morados', c: ['#f2f0f7', '#dadaeb', '#bcbddc', '#9e9ac8', '#807dba', '#6a51a3', '#4a1486'] },
    div:     { nombre: 'Rojo ↔ Azul', div: true, neg: ['#fddbc7', '#f4a582', '#d6604d', '#b2182b'], pos: ['#d1e5f0', '#92c5de', '#4393c3', '#2166ac'] },
};

// Colores de cada clase según los cortes
export function coloresClases(b, paleta) {
    const n = b.length - 1;
    if (n < 1) return [];
    const P = PALETAS[paleta] || PALETAS.azul;
    if (P.div) {
        // Clases negativas: rojos (más oscuros cuanto más lejos del 0); positivas: azules
        const negs = [], poss = [];
        for (let i = 0; i < n; i++) (b[i + 1] <= 0 ? negs : poss).push(i);
        const col = new Array(n);
        negs.forEach((ci, j) => { col[ci] = P.neg[Math.min(P.neg.length - 1, Math.round((negs.length - 1 - j) * (P.neg.length - 1) / Math.max(negs.length - 1, 1)))]; });
        poss.forEach((ci, j) => { col[ci] = P.pos[Math.min(P.pos.length - 1, Math.round(j * (P.pos.length - 1) / Math.max(poss.length - 1, 1)))]; });
        if (negs.length === 1) col[negs[0]] = P.neg[1];
        if (poss.length === 1) col[poss[0]] = P.pos[1];
        return col;
    }
    if (n === 1) return [P.c[4]];
    return Array.from({ length: n }, (_, i) => P.c[Math.round(i * (P.c.length - 1) / (n - 1))]);
}

// Etiqueta legible de cada clase
export function etiquetasClases(b, dec) {
    const f = v => Number(v).toLocaleString('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: dec });
    return b.slice(0, -1).map((lo, i) => i === b.length - 2 ? `${f(lo)} a ${f(b[i + 1])}` : `${f(lo)} a menos de ${f(b[i + 1])}`);
}

// ─── Configuración en la URL (?inemapa=dens.p.5.r.azul[.j]) ──────────────────
export const DEFAULT_MAPA = { ind: 'dens', nivel: 'p', k: 5, metodo: 'q', paleta: 'azul', juego: false, titulo: '' };
export function leerMapaUrl(search = window.location.search) {
    const s = new URLSearchParams(search).get('inemapa');
    if (s == null) return null;
    const [ind, nivel, k, metodo, paleta, j] = s.split('.');
    return {
        ...DEFAULT_MAPA,
        ind: INDICADORES.some(i => i.id === ind) ? ind : DEFAULT_MAPA.ind,
        nivel: nivel === 'c' ? 'c' : 'p',
        k: Math.min(6, Math.max(2, +k || DEFAULT_MAPA.k)),
        metodo: METODOS.some(m => m.id === metodo) ? metodo : DEFAULT_MAPA.metodo,
        paleta: PALETAS[paleta] ? paleta : DEFAULT_MAPA.paleta,
        juego: j === 'j',
    };
}
export const mapaAQuery = c => `inemapa=${c.ind}.${c.nivel}.${c.k}.${c.metodo}.${c.paleta}${c.juego ? '.j' : ''}`;
