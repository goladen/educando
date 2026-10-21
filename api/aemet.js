// Vercel serverless function — lluvia acumulada con datos de estaciones AEMET OpenData.
// AEMET_API_KEY vive solo aquí, nunca en el bundle del navegador.
//
// GET /api/aemet?p=lat,lon;lat,lon;…   (máx. 15 puntos)
// → [{ estacion: {id, nombre, provincia, alt, km}, est24: {id, nombre, km} | null,
//      h24, d7, d30, mesAnt, anio, hasta, diasSeco }]   (mm; null si no hay dato)
//
// Cada consulta a AEMET son dos peticiones: la primera devuelve { estado, datos: <url temporal> }
// y la segunda descarga los datos de esa URL. Los diarios admiten como máximo 6 meses por
// consulta y hay límite por minuto (429), así que se piden en serie con reintentos.
// El navegador guarda el resultado en la caché diaria de Firestore (una llamada al día).

const BASE = 'https://opendata.aemet.es/opendata/api';
const MAX_PUNTOS = 15;
const UMBRAL_DIA_LLUVIA = 1;
const espera = (ms) => new Promise(r => setTimeout(r, ms));

// Inventario y observaciones se reutilizan mientras la instancia siga caliente.
let inventarioCache = null;     // { t, lista }
let observacionCache = null;    // { t, lista }

async function aemet(ruta, apiKey, intentos = 4) {
    for (let i = 0; i < intentos; i++) {
        const r = await fetch(`${BASE}${ruta}`, { headers: { api_key: apiKey, Accept: 'application/json' } });
        if (r.status === 429) { await espera(4000 * (i + 1)); continue; }
        const meta = await r.json().catch(() => null);
        if (meta?.estado === 429) { await espera(4000 * (i + 1)); continue; }
        if (meta?.estado === 404) return [];                     // "No hay datos que satisfagan esos criterios"
        if (!r.ok || meta?.estado !== 200 || !meta?.datos) throw new Error(meta?.descripcion || `AEMET ${r.status}`);
        const d = await fetch(meta.datos);
        if (d.status === 429) { await espera(4000 * (i + 1)); continue; }
        if (!d.ok) throw new Error(`AEMET datos ${d.status}`);
        // Los ficheros de datos vienen en ISO-8859-15.
        const texto = new TextDecoder('latin1').decode(await d.arrayBuffer());
        return JSON.parse(texto);
    }
    throw new Error('AEMET: demasiadas peticiones, inténtalo en un minuto');
}

// "413515N" / "000305W" → grados decimales.
function dms(s) {
    const m = String(s || '').match(/^(\d{2,3})(\d{2})(\d{2})([NSEW])$/);
    if (!m) return NaN;
    const v = +m[1] + +m[2] / 60 + +m[3] / 3600;
    return m[4] === 'S' || m[4] === 'W' ? -v : v;
}
function km(a, b, c, d) {
    const R = 6371, rad = Math.PI / 180;
    const x = Math.sin((c - a) * rad / 2) ** 2 + Math.cos(a * rad) * Math.cos(c * rad) * Math.sin((d - b) * rad / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(x));
}
// "12,4" → 12.4 · "Ip" (inapreciable) → 0 · "Acum"/vacío → null
function mm(v) {
    if (v == null || v === '') return null;
    if (typeof v === 'number') return v;
    if (v === 'Ip') return 0;
    const n = parseFloat(String(v).replace(',', '.'));
    return Number.isFinite(n) ? n : null;
}

const hoyMadrid = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Madrid' });
const sumarDias = (dia, n) => { const d = new Date(dia + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

async function inventario(apiKey) {
    if (inventarioCache && Date.now() - inventarioCache.t < 24 * 3600e3) return inventarioCache.lista;
    const raw = await aemet('/valores/climatologicos/inventarioestaciones/todasestaciones', apiKey);
    const lista = raw.map(e => ({ id: e.indicativo, nombre: e.nombre, provincia: e.provincia, alt: +e.altitud || null, lat: dms(e.latitud), lon: dms(e.longitud) }))
        .filter(e => Number.isFinite(e.lat) && Number.isFinite(e.lon));
    inventarioCache = { t: Date.now(), lista };
    return lista;
}

async function observaciones(apiKey) {
    if (observacionCache && Date.now() - observacionCache.t < 30 * 60e3) return observacionCache.lista;
    const lista = await aemet('/observacion/convencional/todas', apiKey);
    observacionCache = { t: Date.now(), lista };
    return lista;
}

// Valores diarios de una estación entre dos fechas, partidos en tramos de ≤ 6 meses.
async function diarios(id, desde, hasta, apiKey) {
    const tramos = [];
    let ini = desde;
    while (ini <= hasta) {
        const fin6 = sumarDias(ini, 179);
        const fin = fin6 < hasta ? fin6 : hasta;
        tramos.push([ini, fin]);
        ini = sumarDias(fin, 1);
    }
    const out = {};
    for (const [a, b] of tramos) {
        const filas = await aemet(`/valores/climatologicos/diarios/datos/fechaini/${a}T00:00:00UTC/fechafin/${b}T23:59:59UTC/estacion/${encodeURIComponent(id)}`, apiKey);
        (Array.isArray(filas) ? filas : []).forEach(f => { const v = mm(f.prec); if (v != null) out[f.fecha] = v; });
    }
    return out;
}

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

    const apiKey = process.env.AEMET_API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'AEMET_API_KEY not configured on server' });

    const puntos = String(req.query?.p || '').split(';').map(s => s.split(',').map(Number))
        .filter(([la, lo]) => Number.isFinite(la) && Number.isFinite(lo) && Math.abs(la) <= 90 && Math.abs(lo) <= 180)
        .slice(0, MAX_PUNTOS);
    if (!puntos.length) return res.status(400).json({ error: 'Missing p=lat,lon;lat,lon' });

    try {
        const hoy = hoyMadrid();
        const [anio, mes] = hoy.split('-').map(Number);
        const iniMesAnt = mes === 1 ? `${anio - 1}-12-01` : `${anio}-${String(mes - 1).padStart(2, '0')}-01`;
        const prefMesAnt = iniMesAnt.slice(0, 7);
        const desde = `${anio}-01-01` < iniMesAnt ? `${anio}-01-01` : iniMesAnt;

        const inv = await inventario(apiKey);
        let obs = [];
        try { obs = await observaciones(apiKey); } catch { obs = []; }

        // Últimas 24 h de cada estación automática: suma de "prec" horaria.
        const limite24 = Date.now() - 24 * 3600e3;
        const obsPorEst = new Map();
        obs.forEach(o => {
            const t = Date.parse(String(o.fint).replace(/([+-]\d{2})(\d{2})$/, '$1:$2'));
            if (!o.idema || !Number.isFinite(t) || t <= limite24 || typeof o.prec !== 'number') return;
            const e = obsPorEst.get(o.idema) || { id: o.idema, nombre: o.ubi, lat: o.lat, lon: o.lon, suma: 0, n: 0 };
            e.suma += o.prec; e.n += 1;
            obsPorEst.set(o.idema, e);
        });

        const resultado = [];
        for (const [la, lo] of puntos) {
            const est = inv.map(e => ({ ...e, km: km(la, lo, e.lat, e.lon) })).sort((a, b) => a.km - b.km)[0];
            // Para 24 h: la misma estación si emite observación horaria; si no, la automática más cercana.
            let e24 = est && obsPorEst.get(est.id);
            if (!e24) e24 = [...obsPorEst.values()].map(e => ({ ...e, km: km(la, lo, e.lat, e.lon) })).sort((a, b) => a.km - b.km)[0];
            else e24 = { ...e24, km: est.km };

            const fila = {
                estacion: est ? { id: est.id, nombre: est.nombre, provincia: est.provincia, alt: est.alt, km: Math.round(est.km * 10) / 10 } : null,
                est24: e24 && e24.km < 40 ? { id: e24.id, nombre: e24.nombre, km: Math.round(e24.km * 10) / 10, horas: e24.n } : null,
                h24: e24 && e24.km < 40 ? Math.round(e24.suma * 10) / 10 : null,
                d7: null, d30: null, mesAnt: null, anio: null, hasta: null, diasSeco: null,
            };

            if (est && est.km < 40) {
                try {
                    const dia = await diarios(est.id, desde, hoy, apiKey);
                    const fechas = Object.keys(dia).sort();
                    if (fechas.length) {
                        const suma = (f) => Math.round(fechas.filter(f).reduce((s, d) => s + dia[d], 0) * 10) / 10;
                        fila.hasta = fechas[fechas.length - 1];
                        fila.d7 = suma(d => d > sumarDias(hoy, -7));
                        fila.d30 = suma(d => d > sumarDias(hoy, -30));
                        fila.mesAnt = suma(d => d.startsWith(prefMesAnt));
                        fila.anio = suma(d => d.startsWith(String(anio)));
                        for (let n = 0; n <= 366; n++) {
                            const d = sumarDias(fila.hasta, -n);
                            if (d < fechas[0]) break;
                            if ((dia[d] || 0) >= UMBRAL_DIA_LLUVIA) { fila.diasSeco = n + Math.round((Date.parse(hoy) - Date.parse(fila.hasta)) / 864e5); break; }
                        }
                    }
                } catch (e) { fila.error = e.message; }
            }
            resultado.push(fila);
        }

        res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=7200');
        return res.status(200).json(resultado);
    } catch (err) {
        return res.status(502).json({ error: err.message });
    }
}
