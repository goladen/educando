// Genera public/ine/mapa-espana.json: siluetas SVG ya proyectadas y simplificadas de las provincias
// y de las comunidades autónomas, para los mapas temáticos del Explorador INE (src/estadistica/MapasINE.jsx).
//
//   node scripts/generar-mapa-espana.mjs
//
// Fuente: GeoJSON de click_that_hood (Code for America) — el mismo de provincias que usa GeografiaApp.
// Las claves son los códigos INE (cod_prov de 2 cifras / cod_ccaa de 2 cifras).
// Proyección equirectangular con corrección de latitud; Canarias va en un recuadro bajo la península.
import fs from 'node:fs';
import path from 'node:path';

const BASE = 'https://raw.githubusercontent.com/codeforamerica/click_that_hood/master/public/data';
const OUT = path.resolve('public/ine/mapa-espana.json');

const W = 1000;                                   // ancho del viewBox
const LON0 = -9.45, LON1 = 4.45, LAT1 = 43.85;    // península + Baleares + Ceuta y Melilla
const K = W / ((LON1 - LON0) * Math.cos(40 * Math.PI / 180));
const ALTO_PEN = Math.ceil((LAT1 - 35.15) * K);
// Canarias: recuadro abajo a la izquierda, debajo de la península
const CAN = { lon0: -18.25, lon1: -13.3, lat1: 29.48, lat0: 27.6, x: 8, y: ALTO_PEN + 14 };
const COS_CAN = Math.cos(28.5 * Math.PI / 180);
CAN.w = Math.ceil((CAN.lon1 - CAN.lon0) * COS_CAN * K) + 8;
CAN.h = Math.ceil((CAN.lat1 - CAN.lat0) * K) + 8;
const H = CAN.y + CAN.h + 6;

const esCanarias = ([lon, lat]) => lon < -12;
const proyectar = ([lon, lat]) => esCanarias([lon, lat])
    ? [CAN.x + 4 + (lon - CAN.lon0) * COS_CAN * K, CAN.y + 4 + (CAN.lat1 - lat) * K]
    : [(lon - LON0) * Math.cos(40 * Math.PI / 180) * K, (LAT1 - lat) * K];

// Douglas–Peucker
function simplificar(pts, tol) {
    if (pts.length < 4) return pts;
    const d2 = (p, a, b) => {
        const dx = b[0] - a[0], dy = b[1] - a[1], l = dx * dx + dy * dy;
        let t = l ? ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l : 0;
        t = Math.max(0, Math.min(1, t));
        const x = a[0] + t * dx - p[0], y = a[1] + t * dy - p[1];
        return x * x + y * y;
    };
    const marca = new Uint8Array(pts.length); marca[0] = marca[pts.length - 1] = 1;
    const pila = [[0, pts.length - 1]];
    while (pila.length) {
        const [i, j] = pila.pop();
        let max = 0, k = -1;
        for (let m = i + 1; m < j; m++) { const d = d2(pts[m], pts[i], pts[j]); if (d > max) { max = d; k = m; } }
        if (max > tol * tol) { marca[k] = 1; pila.push([i, k], [k, j]); }
    }
    return pts.filter((_, i) => marca[i]);
}
const areaAnillo = r => { let a = 0; for (let i = 0; i < r.length; i++) { const [x1, y1] = r[i], [x2, y2] = r[(i + 1) % r.length]; a += x1 * y2 - x2 * y1; } return a / 2; };
const centroide = r => {
    let a = 0, cx = 0, cy = 0;
    for (let i = 0; i < r.length; i++) {
        const [x1, y1] = r[i], [x2, y2] = r[(i + 1) % r.length], f = x1 * y2 - x2 * y1;
        a += f; cx += (x1 + x2) * f; cy += (y1 + y2) * f;
    }
    return a ? [cx / (3 * a), cy / (3 * a)] : r[0];
};

function geometria(feature) {
    const g = feature.geometry;
    const poligonos = g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
    const anillos = [];
    for (const pol of poligonos) for (const ring of pol) {
        const p = simplificar(ring.map(proyectar), 0.45).map(([x, y]) => [Math.round(x * 10) / 10, Math.round(y * 10) / 10]);
        if (p.length >= 3) anillos.push(p);
    }
    const conArea = anillos.map(r => ({ r, a: Math.abs(areaAnillo(r)) })).sort((a, b) => b.a - a.a);
    // Fuera islotes minúsculos (salvo que sea lo único que hay: Ceuta, Melilla)
    const quedan = conArea.filter((x, i) => i === 0 || x.a >= 1.5);
    const d = quedan.map(({ r }) => 'M' + r.map(([x, y]) => `${x},${y}`).join('L') + 'Z').join('');
    const [lx, ly] = centroide(quedan[0].r);
    const area = quedan.reduce((s, x) => s + x.a, 0);
    return { d, lx: Math.round(lx), ly: Math.round(ly), a: Math.round(area) };
}

async function bajar(nombre) {
    const r = await fetch(`${BASE}/${nombre}`);
    if (!r.ok) throw new Error(`${nombre}: HTTP ${r.status}`);
    return (await r.json()).features;
}

const prov = {}, ccaa = {};
for (const f of await bajar('spain-provinces.geojson')) prov[f.properties.cod_prov] = geometria(f);
for (const f of await bajar('spain-communities.geojson')) ccaa[f.properties.cod_ccaa] = geometria(f);

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify({ w: W, h: H, canarias: { x: CAN.x, y: CAN.y, w: CAN.w, h: CAN.h }, prov, ccaa }));
console.log(`✔ ${Object.keys(prov).length} provincias, ${Object.keys(ccaa).length} comunidades → ${OUT} (${Math.round(fs.statSync(OUT).size / 1024)} KB, viewBox ${W}×${H})`);
