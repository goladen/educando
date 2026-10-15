// ineDatos.js — Acceso a datos del INE para el Explorador INE (Estadística y Geografía).
//
// Entidades («lugares») con clave compacta, que es también la que va en los enlaces (?ine=):
//   m22125 → municipio (código INE de 5 cifras)      p22 → provincia
//   c02    → comunidad / ciudad autónoma              es  → España
//
// Fuentes (API JSON del INE, servicios.ine.es/wstempus, con CORS abierto):
//  · Municipios: Padrón (tabla nacional 29005, desde 1996) + tabla de Padrón de su provincia (zona)
//    + Atlas de distribución de renta de los hogares (renta, fuentes de ingreso, Gini, indicadores
//    demográficos; una tabla por provincia filtrada con tv=19:<idINE>).
//  · Provincias, comunidades y España: Estadística Continua de Población (ECP), población a 1 de
//    enero desde 1971 por sexo y edad simple (56945 provincias, 56940 comunidades y total
//    nacional) y por nacionalidad (59591 provincias y total nacional, 59587 comunidades).
//  · Superficie: public/ine/municipios.json (LAU 2024 de Eurostat/GISCO); provincia, comunidad
//    y España suman la de sus municipios.

const API = 'https://servicios.ine.es/wstempus/js/ES';

// Valores de variables del INE usados en los filtros tv=<variable>:<valor>
const V = {
    MUNICIPIO: 19, PROVINCIA: 115, CCAA: 70, NACIONAL: '349:16473',
    TODAS_EDADES: '356:15668', SEXO_TOTAL: '18:451',
};
const T = { PADRON_MUN: 29005, ECP_PROV: 56945, ECP_CCAA: 56940, NAC_PROV: 59591, NAC_CCAA: 59587 };

const cache = new Map();
export const ine = (ruta) => {
    if (!cache.has(ruta)) {
        cache.set(ruta, fetch(`${API}/${ruta}`).then(r => {
            if (!r.ok) throw new Error(`INE ${r.status}`);
            return r.json();
        }).catch(e => { cache.delete(ruta); throw e; }));
    }
    return cache.get(ruta);
};

let indicePromesa = null;
export const cargarIndice = () => (indicePromesa ||= fetch('/ine/municipios.json').then(r => {
    if (!r.ok) throw new Error('No se pudo cargar el índice de municipios');
    return r.json();
}).then(prepararIndice).catch(e => { indicePromesa = null; throw e; }));

export const normal = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
// «Coruña, A» → «A Coruña»; «Madrid, Comunidad de» → «Comunidad de Madrid»
export const nombreNatural = n => n.includes(', ') ? n.replace(/^(.*), ([^,]+)$/, '$2 $1') : n;

export const TIPOS = {
    m:  { nombre: 'Municipio', emoji: '🏘️' },
    p:  { nombre: 'Provincia', emoji: '🗺️' },
    c:  { nombre: 'Comunidad autónoma', emoji: '🏛️' },
    es: { nombre: 'País', emoji: '🇪🇸' },
};
export const tipoDe = clave => clave === 'es' ? 'es' : clave[0];

// Añade al índice: lugares buscables, superficies agregadas y nº de municipios
function prepararIndice(idx) {
    const areaProv = {}, nMunProv = {};
    for (const m of idx.mun) {
        const p = m[1].slice(0, 2);
        areaProv[p] = (areaProv[p] || 0) + (m[3] || 0);
        nMunProv[p] = (nMunProv[p] || 0) + 1;
    }
    for (const [cod, p] of Object.entries(idx.prov)) { p.area = areaProv[cod] || 0; p.nMun = nMunProv[cod] || 0; }
    for (const [cod, c] of Object.entries(idx.ccaa)) {
        const ps = Object.values(idx.prov).filter(p => p.ccaa === cod);
        c.area = ps.reduce((s, p) => s + p.area, 0);
        c.nMun = ps.reduce((s, p) => s + p.nMun, 0);
        c.nProv = ps.length;
    }
    idx.esp = {
        area: Object.values(idx.prov).reduce((s, p) => s + p.area, 0),
        nMun: idx.mun.length, nProv: Object.keys(idx.prov).length, nCcaa: Object.keys(idx.ccaa).length,
    };
    const lugar = (clave, nombre, extra) => ({ clave, nombre, nat: nombreNatural(nombre), n: normal(nombre), nn: normal(nombreNatural(nombre)), ...extra });
    idx.lugares = [
        lugar('es', 'España', { sub: 'Total nacional' }),
        ...Object.entries(idx.ccaa).map(([cod, c]) => lugar(`c${cod}`, c.n, { sub: 'Comunidad autónoma' })),
        ...Object.entries(idx.prov).map(([cod, p]) => lugar(`p${cod}`, p.n, { sub: `Provincia · ${nombreNatural(idx.ccaa[p.ccaa]?.n || '')}` })),
        ...idx.mun.map(m => lugar(`m${m[1]}`, m[2], { sub: nombreNatural(idx.prov[m[1].slice(0, 2)]?.n || '') })),
    ];
    idx.porClave = new Map(idx.lugares.map(l => [l.clave, l]));
    return idx;
}

// Buscador: primero los que empiezan por el texto (o alguna de sus palabras), luego los que lo contienen.
// Provincias, comunidades y España van delante de los municipios del mismo nivel de coincidencia.
export function buscarLugares(idx, texto, max = 15) {
    const t = normal(texto.trim());
    if (t.length < 2 || !idx) return [];
    const exacto = [], empieza = [], contiene = [];
    for (const l of idx.lugares) {
        if (l.n === t || l.nn === t) exacto.push(l);
        else if (l.n.startsWith(t) || l.nn.startsWith(t) || l.n.split(/[\s/-]+/).some(w => w.startsWith(t))) empieza.push(l);
        else if (l.n.includes(t) || l.nn.includes(t)) contiene.push(l);
    }
    return [...exacto, ...empieza, ...contiene].slice(0, max);
}

// ─── Utilidades de series ────────────────────────────────────────────────────
// Serie INE → [{anyo, valor}] ordenada. Si la serie es trimestral/semestral (ECP) se queda con el 1 de enero.
export const puntos = (serie) => {
    const datos = (serie?.Data || []).filter(d => d.Valor != null && !d.Secreto);
    const tienePeriodos = datos.some(d => d.FK_Periodo != null && d.FK_Periodo !== 28);
    return datos
        .filter(d => !tienePeriodos || d.FK_Periodo === 19) // 19 = 1 de enero en la ECP
        .map(d => ({ anyo: d.Anyo, valor: d.Valor }))
        .sort((a, b) => a.anyo - b.anyo);
};
const ultimo = (serie) => { const p = puntos(serie); return p[p.length - 1] || null; };
const buscarSerie = (lista, texto) => lista?.find(s => s.Nombre.includes(texto));
const segmentos = s => s.Nombre.split('. ').map(x => x.trim());
const sexoDe = s => segmentos(s).find(x => x === 'Total' || x === 'Hombres' || x === 'Mujeres');
const edadDe = s => { const m = segmentos(s).map(x => x.match(/^(\d+) año/)).find(Boolean); return m ? +m[1] : null; };
// La ECP mezcla «1 ene» y «1 jul»: para la nacionalidad tomamos el dato más reciente que haya
const masReciente = (serie) => {
    const d = (serie?.Data || []).filter(x => x.Valor != null).sort((a, b) => b.Fecha - a.Fecha)[0];
    if (!d) return null;
    const f = new Date(d.Fecha + 12 * 3600e3); // las fechas vienen a medianoche hora española
    return { valor: d.Valor, fecha: f.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' }) };
};

// Estructura por edades (ECP, edad simple, último 1 de enero) → indicadores + pirámide quinquenal
function estructuraEdades(series) {
    const porSexo = { Total: [], Hombres: [], Mujeres: [] };
    let anyo = null;
    for (const s of series) {
        const e = edadDe(s), sx = sexoDe(s), p = ultimo(s);
        if (e == null || !sx || !p) continue;
        porSexo[sx][e] = p.valor; anyo = p.anyo;
    }
    const tot = porSexo.Total;
    const N = tot.reduce((a, v) => a + (v || 0), 0);
    if (!N) return null;
    const suma = (desde, hasta) => tot.reduce((a, v, e) => a + (e >= desde && e <= hasta ? (v || 0) : 0), 0);
    const piramide = [];
    for (let g = 0; g <= 100; g += 5) {
        const h = porSexo.Hombres.reduce((a, v, e) => a + (e >= g && (g === 100 || e < g + 5) ? (v || 0) : 0), 0);
        const m = porSexo.Mujeres.reduce((a, v, e) => a + (e >= g && (g === 100 || e < g + 5) ? (v || 0) : 0), 0);
        piramide.push({ grupo: g === 100 ? '100+' : `${g}-${g + 4}`, h: h / N * 100, m: m / N * 100 });
    }
    return {
        anyo,
        edadMedia: tot.reduce((a, v, e) => a + (v || 0) * (e + 0.5), 0) / N,
        menores: suma(0, 17) / N * 100,
        mayores: suma(65, 200) / N * 100,
        piramide,
    };
}

// ─── Carga de un lugar ───────────────────────────────────────────────────────
// Devuelve una «ficha» con la misma forma para cualquier tipo de lugar:
// { clave, tipo, nombre, sub, area, total, hombres, mujeres, fuentePob, edades, espanola, hogar,
//   renta, gini, fuente, zona (municipios), hijos (provincias/comunidades/España), errores }
const fichas = new Map();
export function cargarLugar(idx, clave) {
    if (!fichas.has(clave)) {
        const pr = cargarLugarSinCache(idx, clave).catch(e => { fichas.delete(clave); throw e; });
        fichas.set(clave, pr);
    }
    return fichas.get(clave);
}

async function cargarLugarSinCache(idx, clave) {
    const l = idx.porClave.get(clave);
    if (!l) throw new Error('Lugar desconocido');
    const tipo = tipoDe(clave);
    const base = { clave, tipo, nombre: l.nombre, nat: l.nat, sub: l.sub };
    if (tipo === 'm') return { ...base, ...(await cargarMunicipio(idx, clave.slice(1))) };
    return { ...base, ...(await cargarTerritorio(idx, tipo, clave)) };
}

async function cargarMunicipio(idx, cod) {
    const m = idx.mun.find(x => x[1] === cod);
    const prov = idx.prov[cod.slice(0, 2)];
    const tv = `tv=${V.MUNICIPIO}:${m[0]}`;
    const pedir = (tabla, nult) => tabla ? ine(`DATOS_TABLA/${tabla}?${tv}&nult=${nult}`) : Promise.resolve(null);

    const res = await Promise.allSettled([
        ine(`DATOS_TABLA/${T.PADRON_MUN}?${tv}&nult=40`),
        prov?.padron ? ine(`DATOS_TABLA/${prov.padron}?nult=1`) : Promise.resolve(null),
        pedir(prov?.renta, 12), pedir(prov?.demo, 12), pedir(prov?.gini, 12), pedir(prov?.fuente, 1),
    ]);
    const [padron, provTabla, renta, demo, gini, fuente] = res.map(r => r.status === 'fulfilled' ? r.value : null);

    const sp = padron || [];
    const serieTotal = sp.find(s => / Total\. Total habitantes/.test(s.Nombre)) || sp[0];
    const total = puntos(serieTotal);
    if (!total.length) throw new Error(res[0].status === 'rejected'
        ? 'No se pudo conectar con el INE. Revisa la conexión o inténtalo más tarde.'
        : 'El INE no tiene datos de población de este municipio (puede que se haya fusionado con otro).');

    // Zona: provincia completa (último año) → ranking y municipios de tamaño parecido
    let zona = null;
    if (provTabla?.length) {
        const totales = provTabla.filter(s => / Total\. Total habitantes/.test(s.Nombre));
        const [provSerie, ...muns] = totales;
        const lista = muns.map(s => ({ cod: s.COD, nombre: s.Nombre.split(/\. Total\. /)[0], valor: ultimo(s)?.valor }))
            .filter(x => x.valor != null && !/^Población en municipios/i.test(x.nombre)).sort((a, b) => b.valor - a.valor);
        let historia = [];
        try { historia = puntos(await ine(`DATOS_SERIE/${provSerie.COD}?nult=40`)); } catch { /* opcional */ }
        zona = { total: ultimo(provSerie)?.valor, historia, lista, pos: lista.findIndex(x => x.cod === serieTotal?.COD), nMunicipios: lista.length };
        // Claves de municipio para poder saltar a ellos desde la lista
        const porNombre = new Map(idx.mun.filter(x => x[1].startsWith(cod.slice(0, 2))).map(x => [normal(x[2]), `m${x[1]}`]));
        for (const x of lista) x.clave = porNombre.get(normal(x.nombre)) || null;
    }

    const dm = demo && {
        edad: puntos(buscarSerie(demo, 'Edad media')),
        menores: puntos(buscarSerie(demo, 'menor de 18')),
        mayores: puntos(buscarSerie(demo, '65 y más')),
        hogar: puntos(buscarSerie(demo, 'Tamaño medio del hogar')),
        unipersonales: puntos(buscarSerie(demo, 'unipersonales')),
        espanola: puntos(buscarSerie(demo, 'población española')),
    };
    const u = s => s?.[s.length - 1] || null;
    return {
        area: m[3] || null,
        total, fuentePob: 'Padrón municipal',
        hombres: puntos(sp.find(s => / Hombres\. /.test(s.Nombre))),
        mujeres: puntos(sp.find(s => / Mujeres\. /.test(s.Nombre))),
        edades: dm && u(dm.edad) && { anyo: u(dm.edad).anyo, edadMedia: u(dm.edad).valor, menores: u(dm.menores)?.valor, mayores: u(dm.mayores)?.valor, piramide: null },
        espanola: dm && u(dm.espanola) && { valor: u(dm.espanola).valor, fecha: String(u(dm.espanola).anyo) },
        hogar: dm && u(dm.hogar) && { tam: u(dm.hogar).valor, unipersonales: u(dm.unipersonales)?.valor, anyo: u(dm.hogar).anyo },
        renta: renta && {
            persona: puntos(buscarSerie(renta, 'Renta neta media por persona')),
            hogar: puntos(buscarSerie(renta, 'Renta neta media por hogar')),
            mediana: puntos(buscarSerie(renta, 'Mediana de la renta por unidad de consumo')),
        },
        gini: gini && { gini: puntos(buscarSerie(gini, 'Gini')), p8020: puntos(buscarSerie(gini, 'P80/P20')) },
        fuente: fuente && ['salario', 'pensiones', 'prestaciones por desempleo', 'otras prestaciones', 'otros ingresos'].map(k => {
            const p = ultimo(buscarSerie(fuente, `Fuente de ingreso: ${k}.`));
            return { nombre: k[0].toUpperCase() + k.slice(1), valor: p?.valor ?? null, anyo: p?.anyo };
        }),
        zona,
        errores: res.filter(x => x.status === 'rejected').length,
    };
}

async function cargarTerritorio(idx, tipo, clave) {
    const cod = clave.slice(1);
    const filtro = tipo === 'p' ? `${V.PROVINCIA}:${idx.prov[cod].id}` : tipo === 'c' ? `${V.CCAA}:${idx.ccaa[cod].id}` : V.NACIONAL;
    const tablaEcp = tipo === 'p' ? T.ECP_PROV : T.ECP_CCAA;
    const tablaNac = tipo === 'c' ? T.NAC_CCAA : T.NAC_PROV;
    const meta = tipo === 'p' ? idx.prov[cod] : tipo === 'c' ? idx.ccaa[cod] : idx.esp;

    const res = await Promise.allSettled([
        ine(`DATOS_TABLA/${tablaEcp}?tv=${filtro}&tv=${V.TODAS_EDADES}&nult=240`),               // historia por sexo
        ine(`DATOS_TABLA/${tablaEcp}?tv=${filtro}&nult=1`),                                       // edad simple × sexo
        ine(`DATOS_TABLA/${tablaNac}?tv=${filtro}&tv=${V.TODAS_EDADES}&tv=${V.SEXO_TOTAL}&nult=4`), // nacionalidad
        // «Hijos»: municipios de la provincia (Padrón) · provincias de la comunidad · comunidades de España
        tipo === 'p' ? ine(`DATOS_TABLA/${idx.prov[cod].padron}?nult=1`)
            : ine(`DATOS_TABLA/${tipo === 'c' ? T.ECP_PROV : T.ECP_CCAA}?tv=${V.TODAS_EDADES}&tv=${V.SEXO_TOTAL}&nult=1`),
    ]);
    const [hist, edadesS, nac, hijosS] = res.map(r => r.status === 'fulfilled' ? r.value : null);
    if (!hist?.length) throw new Error(res[0].status === 'rejected' ? 'No se pudo conectar con el INE. Revisa la conexión o inténtalo más tarde.' : 'El INE no ha devuelto datos de población.');

    const total = puntos(hist.find(s => sexoDe(s) === 'Total'));
    const espS = nac?.find(s => segmentos(s).includes('Española'));
    const totS = nac?.find(s => !segmentos(s).includes('Española') && !segmentos(s).includes('Extranjera'));
    const esp = masReciente(espS), tot = masReciente(totS);

    let hijos = null;
    if (hijosS?.length) {
        if (tipo === 'p') {
            const muns = hijosS.filter(s => / Total\. Total habitantes/.test(s.Nombre)).slice(1);
            const porNombre = new Map(idx.mun.filter(x => x[1].startsWith(cod)).map(x => [normal(x[2]), `m${x[1]}`]));
            hijos = {
                titulo: 'Municipios más poblados', fuente: 'Padrón',
                lista: muns.map(s => ({ nombre: s.Nombre.split(/\. Total\. /)[0], valor: ultimo(s)?.valor }))
                    .filter(x => x.valor != null && !/^Población en municipios/i.test(x.nombre))
                    .map(x => ({ ...x, clave: porNombre.get(normal(x.nombre)) || null })),
            };
        } else {
            // Se cruza por el nombre que da el INE (coincide con el de VALORES_VARIABLE)
            const candidatos = tipo === 'c'
                ? Object.entries(idx.prov).filter(([, p]) => p.ccaa === cod).map(([c, p]) => ({ clave: `p${c}`, n: p.n }))
                : Object.entries(idx.ccaa).map(([c, x]) => ({ clave: `c${c}`, n: x.n }));
            hijos = {
                titulo: tipo === 'c' ? 'Provincias' : 'Comunidades y ciudades autónomas', fuente: 'ECP',
                lista: candidatos.map(k => {
                    const s = hijosS.find(x => segmentos(x).includes(k.n));
                    return { nombre: k.n, clave: k.clave, valor: ultimo(s)?.valor ?? null };
                }).filter(x => x.valor != null),
            };
        }
        hijos.lista.sort((a, b) => b.valor - a.valor);
    }

    return {
        area: meta.area || null,
        nMun: meta.nMun, nProv: meta.nProv, nCcaa: meta.nCcaa,
        total, fuentePob: 'Estadística Continua de Población',
        hombres: puntos(hist.find(s => sexoDe(s) === 'Hombres')),
        mujeres: puntos(hist.find(s => sexoDe(s) === 'Mujeres')),
        edades: edadesS ? estructuraEdades(edadesS) : null,
        espanola: esp && tot?.valor ? { valor: esp.valor / tot.valor * 100, fecha: esp.fecha } : null,
        hogar: null, renta: null, gini: null, fuente: null, zona: null,
        hijos,
        errores: res.filter(x => x.status === 'rejected').length,
    };
}

// ─── Enlaces ─────────────────────────────────────────────────────────────────
const CLAVE_OK = /^(m\d{5}|p\d{2}|c\d{2}|es)$/;
export const leerClavesUrl = (search = window.location.search) =>
    (new URLSearchParams(search).get('ine') || '').split(',').map(s => s.trim()).filter(s => CLAVE_OK.test(s)).slice(0, 2);

// Mantiene ?ine= en la barra de direcciones (recargar o copiar la URL conserva lo que se ve)
export function escribirClavesUrl(claves) {
    const u = new URL(window.location.href);
    if (claves.length) u.searchParams.set('ine', claves.join(','));
    else u.searchParams.delete('ine');
    window.history.replaceState(window.history.state, '', u.pathname + u.search.replace(/%2C/gi, ',') + u.hash);
}
