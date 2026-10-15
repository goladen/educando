// Genera el índice que usa el «Explorador INE» (src/estadistica/ExploradorINE.jsx, en Estadística y Geografía):
//   public/ine/municipios.json
//
//   node scripts/generar-ine-municipios.mjs            (reutiliza los Ids de tablas del fichero anterior)
//   node scripts/generar-ine-municipios.mjs --tablas   (vuelve a buscar las tablas del Padrón y del Atlas de renta; tarda ~10 min)
//
// Contenido:
//  · mun:  [[idINE, codigoINE(5 cifras), nombre, superficieKm2], …]  → buscador (variable 19 = Municipios).
//  · prov: { '22': { n:'Huesca', id:23, ccaa:'02', padron:2875, renta:…, fuente:…, gini:…, demo:… } }
//          id = valor de la variable 115 (Provincias) en la ECP; tablas por provincia del Padrón (DPOP)
//          y del Atlas de distribución de renta (ADRH).
//  · ccaa: { '02': { n:'Aragón', id:8998 } }  (id = valor de la variable 70 en la ECP)
// Fuentes: API JSON del INE (servicios.ine.es/wstempus) y, para la superficie, las unidades
// administrativas locales LAU 2024 de Eurostat/GISCO (mismo código INE; km² oficiales).
// El navegador consulta los datos en vivo; este fichero solo cambia cuando el INE crea
// municipios o tablas nuevas.
import fs from 'node:fs';
import path from 'node:path';

const API = 'https://servicios.ine.es/wstempus/js/ES';
const LAU = 'https://gisco-services.ec.europa.eu/distribution/v2/lau/csv/LAU_RG_01M_2024_4326.csv';
const OUT = path.resolve('public/ine/municipios.json');
const BUSCAR_TABLAS = process.argv.includes('--tablas') || !fs.existsSync(OUT);

async function get(url, intentos = 3) {
    for (let i = 0; i < intentos; i++) {
        try {
            const r = await fetch(`${API}/${url}`);
            if (!r.ok) throw new Error(`HTTP ${r.status}`);
            return await r.json();
        } catch (e) {
            if (i === intentos - 1) throw new Error(`${url}: ${e.message}`);
            await new Promise(res => setTimeout(res, 1500));
        }
    }
}

// Ejecuta fn sobre la lista con N peticiones simultáneas (el INE corta si se le satura)
async function pool(lista, n, fn) {
    const out = new Array(lista.length);
    let i = 0;
    await Promise.all(Array.from({ length: n }, async () => {
        while (i < lista.length) { const k = i++; out[k] = await fn(lista[k], k); }
    }));
    return out;
}

const normal = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

console.log('Municipios, provincias y comunidades…');
const municipios = await get('VALORES_VARIABLE/19');
const provincias = (await get('VALORES_VARIABLE/115')).filter(p => /^\d{2}$/.test(p.Codigo) && p.Codigo !== '00');
const ccaas = (await get('VALORES_VARIABLE/70')).filter(c => /^\d{2}$/.test(c.Codigo) && c.Codigo !== '00');
const ccaaCodPorId = Object.fromEntries(ccaas.map(c => [c.Id, c.Codigo]));
const ccaa = Object.fromEntries(ccaas.map(c => [c.Codigo, { n: c.Nombre, id: c.Id }]));

const anterior = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : null;
const prov = {};
for (const p of provincias) {
    prov[p.Codigo] = { n: p.Nombre, id: p.Id, ccaa: ccaaCodPorId[p.FK_JerarquiaPadres?.[0]] || '' };
    if (!prov[p.Codigo].ccaa) console.warn(`  ⚠ ${p.Codigo} ${p.Nombre}: sin comunidad autónoma`);
}

const FAMILIAS = {
    renta:  'Indicadores de renta media y mediana',
    fuente: 'Distribución por fuente de ingresos',
    gini:   'Índice de Gini y Distribución de la renta P80/P20',
    demo:   'Indicadores demográficos',
};
const CLAVES_TABLAS = ['padron', ...Object.keys(FAMILIAS)];

if (!BUSCAR_TABLAS) {
    console.log('Tablas: reutilizando las del índice anterior (usa --tablas para volver a buscarlas)');
    for (const [cod, p] of Object.entries(prov)) {
        for (const k of CLAVES_TABLAS) if (anterior.prov?.[cod]?.[k]) p[k] = anterior.prov[cod][k];
    }
} else {
    // Padrón: una tabla «<Provincia>: Población por municipios y sexo» por provincia
    console.log('Tablas del Padrón…');
    const tablasPadron = await get('TABLAS_OPERACION/22');
    const provPorNombre = Object.fromEntries(Object.entries(prov).map(([cod, p]) => [normal(p.n), cod]));
    for (const t of tablasPadron) {
        const m = t.Nombre.match(/^(.+?):\s*Población por municipios y sexo/);
        if (!m) continue;
        const cod = provPorNombre[normal(m[1])];
        if (cod) prov[cod].padron = t.Id;
        else console.warn('  ⚠ tabla de padrón sin provincia:', t.Nombre);
    }

    // Atlas de renta: varias familias de tablas, una por provincia. La provincia se deduce
    // del código del primer municipio de la tabla.
    console.log('Tablas del Atlas de renta…');
    const tablasADRH = await get('TABLAS_OPERACION/353');
    const trabajos = [];
    for (const [clave, nombre] of Object.entries(FAMILIAS)) {
        for (const t of tablasADRH) if (t.Nombre.trim() === nombre) trabajos.push({ clave, id: t.Id });
    }
    await pool(trabajos, 6, async ({ clave, id }) => {
        try {
            const grupos = await get(`GRUPOS_TABLA/${id}`);
            const g = grupos.find(x => /territorial/i.test(x.Nombre)) || grupos[0];
            const valores = await get(`VALORES_GRUPOSTABLA/${id}/${g.Id}`);
            const mun = valores.find(v => v.FK_Variable === 19);
            if (!mun) return; // tabla nacional o sin municipios
            const cod = mun.Codigo.slice(0, 2);
            // Hay tablas «nacionales» que también empiezan por un municipio de Álava: nos quedamos con la de Id menor
            if (prov[cod] && !(prov[cod][clave] < id)) prov[cod][clave] = id;
        } catch (e) { console.warn('  ⚠', e.message); }
    });
}

for (const [cod, p] of Object.entries(prov)) {
    const falta = CLAVES_TABLAS.filter(k => !p[k]);
    if (falta.length) console.warn(`  ⚠ ${cod} ${p.n}: sin ${falta.join(', ')}`);
}

// Superficie oficial de cada municipio (Eurostat/GISCO LAU 2024, código «ES_<INE>»)
console.log('Superficies (LAU 2024)…');
const area = {};
const csv = await (await fetch(LAU)).text();
const filas = csv.split(/\r?\n/);
const cab = filas[0].split(',');
const desdeFinal = cab.length - cab.indexOf('AREA_KM2'); // el nombre puede llevar comas: contamos desde el final
for (const f of filas.slice(1)) {
    if (!f.startsWith('ES_')) continue;
    const partes = f.split(',');
    area[partes[0].slice(3)] = +partes[partes.length - desdeFinal];
}

const mun = municipios
    .filter(m => /^\d{5}$/.test(m.Codigo) && !/^Población en municipios/i.test(m.Nombre))
    .map(m => [m.Id, m.Codigo, m.Nombre, area[m.Codigo] ? Math.round(area[m.Codigo] * 100) / 100 : 0])
    .sort((a, b) => a[2].localeCompare(b[2], 'es'));
const sinArea = mun.filter(m => !m[3]);
if (sinArea.length) console.warn(`  ⚠ ${sinArea.length} municipios sin superficie (fusionados o desaparecidos):`, sinArea.map(m => m[2]).join(', '));

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify({ generado: new Date().toISOString().slice(0, 10), ccaa, prov, mun }));
console.log(`✔ ${mun.length} municipios, ${Object.keys(prov).length} provincias, ${Object.keys(ccaa).length} comunidades → ${OUT} (${Math.round(fs.statSync(OUT).size / 1024)} KB)`);
