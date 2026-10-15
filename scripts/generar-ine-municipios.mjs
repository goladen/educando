// Genera el índice que usa el «Explorador INE» de Estadística (src/estadistica/ExploradorINE.jsx):
//   public/ine/municipios.json
//
//   node scripts/generar-ine-municipios.mjs
//
// Contenido (todo sacado de la API JSON del INE, servicios.ine.es/wstempus):
//  · mun:  [[idINE, codigoINE(5 cifras), nombre], …]  → buscador (variable 19 = Municipios).
//  · prov: { '22': { n:'Huesca', ccaa:'Aragón', padron:2875, renta:…, fuente:…, gini:…, demo:… } }
//          tablas por provincia del Padrón (DPOP) y del Atlas de distribución de renta (ADRH).
// El navegador consulta los datos en vivo con DATOS_TABLA/<tabla>?tv=19:<idINE>; este fichero
// solo cambia cuando el INE crea municipios o tablas nuevas (volver a ejecutar el script).
import fs from 'node:fs';
import path from 'node:path';

const API = 'https://servicios.ine.es/wstempus/js/ES';
const OUT = path.resolve('public/ine/municipios.json');

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

console.log('Municipios…');
const municipios = await get('VALORES_VARIABLE/19');
const provincias = (await get('VALORES_VARIABLE/115')).filter(p => /^\d{2}$/.test(p.Codigo) && p.Codigo !== '00');
const ccaas = await get('VALORES_VARIABLE/70');
const ccaaPorId = Object.fromEntries(ccaas.map(c => [c.Id, c.Nombre]));

const prov = {};
for (const p of provincias) {
    prov[p.Codigo] = { n: p.Nombre, ccaa: ccaaPorId[p.FK_JerarquiaPadres?.[0]] || '' };
}

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
const FAMILIAS = {
    renta:  'Indicadores de renta media y mediana',
    fuente: 'Distribución por fuente de ingresos',
    gini:   'Índice de Gini y Distribución de la renta P80/P20',
    demo:   'Indicadores demográficos',
};
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

for (const [cod, p] of Object.entries(prov)) {
    const falta = ['padron', ...Object.keys(FAMILIAS)].filter(k => !p[k]);
    if (falta.length) console.warn(`  ⚠ ${cod} ${p.n}: sin ${falta.join(', ')}`);
}

const mun = municipios
    .filter(m => /^\d{5}$/.test(m.Codigo) && !/^Población en municipios/i.test(m.Nombre))
    .map(m => [m.Id, m.Codigo, m.Nombre])
    .sort((a, b) => a[2].localeCompare(b[2], 'es'));

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify({ generado: new Date().toISOString().slice(0, 10), prov, mun }));
console.log(`✔ ${mun.length} municipios, ${Object.keys(prov).length} provincias → ${OUT} (${Math.round(fs.statSync(OUT).size / 1024)} KB)`);
