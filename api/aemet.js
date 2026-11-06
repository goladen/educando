// Vercel serverless function — lluvia acumulada con datos de estaciones AEMET OpenData.
// AEMET_API_KEY vive solo aquí, nunca en el bundle del navegador.
//
// GET /api/aemet?action=sync   (cron de Vercel 2 veces al día, protegido con CRON_SECRET)
// → calcula todas las ZONAS_ESCALADA y las guarda en Firestore sitio_publico/lluvia_aemet,
//   que es lo que lee la web. Así los visitantes nunca esperan a AEMET.
//
// GET /api/aemet?p=lat,lon;lat,lon;…   (máx. 15 puntos; el navegador pide de uno en uno:
// cada punto son ~4 peticiones a AEMET y 10 juntos rozaban el límite de 60 s de la función)
// → [{ estacion: {id, nombre, provincia, alt, km}, est24: {id, nombre, km} | null,
//      h24, d7, d30, mesAnt, anio, hasta, diasSeco }]   (mm; null si no hay dato)
//
// Cada consulta a AEMET son dos peticiones: la primera devuelve { estado, datos: <url temporal> }
// y la segunda descarga los datos de esa URL. Los diarios admiten como máximo 6 meses por
// consulta y hay límite por minuto (429), así que se piden en serie con reintentos.
// El navegador guarda el resultado en la caché diaria de Firestore (una llamada al día).

import { leerDoc, escribirDoc } from './_google.js';
import { ZONAS_ESCALADA, DOC_LLUVIA_AEMET } from './_zonasLluvia.js';

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

// Prepara lo común a todos los puntos de una ejecución: fechas, inventario y lluvia horaria
// por estación. `diariosPorEst` evita repetir la descarga cuando dos zonas comparten estación.
async function contexto(apiKey) {
    const hoy = hoyMadrid();
    const [anio, mes] = hoy.split('-').map(Number);
    const iniMesAnt = mes === 1 ? `${anio - 1}-12-01` : `${anio}-${String(mes - 1).padStart(2, '0')}-01`;
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

    return { apiKey, hoy, anio, prefMesAnt: iniMesAnt.slice(0, 7), desde, inv, obsPorEst, diariosPorEst: new Map() };
}

// Lluvia AEMET de un punto: estación más cercana + acumulados.
async function calcularPunto(la, lo, ctx) {
    const { apiKey, hoy, anio, prefMesAnt, desde, inv, obsPorEst, diariosPorEst } = ctx;
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
            if (!diariosPorEst.has(est.id)) diariosPorEst.set(est.id, await diarios(est.id, desde, hoy, apiKey));
            const dia = diariosPorEst.get(est.id);
            const fechas = Object.keys(dia).sort();
            if (fechas.length) {
                const suma = (f) => Math.round(fechas.filter(f).reduce((s, d) => s + dia[d], 0) * 10) / 10;
                fila.hasta = fechas[fechas.length - 1];
                // Los diarios llegan con días de retraso: si falta ayer, la semana y los "días sin
                // lluvia" no son fiables (un 0 diría que no ha llovido cuando aún no hay datos).
                const completo = fila.hasta >= sumarDias(hoy, -1);
                fila.d7 = completo ? suma(d => d > sumarDias(hoy, -7)) : null;
                fila.d30 = suma(d => d > sumarDias(hoy, -30));
                fila.mesAnt = suma(d => d.startsWith(prefMesAnt));
                fila.anio = suma(d => d.startsWith(String(anio)));
                for (let n = 0; n <= 366; n++) {
                    const d = sumarDias(fila.hasta, -n);
                    if (d < fechas[0]) break;
                    if ((dia[d] || 0) >= UMBRAL_DIA_LLUVIA) { fila.diasSeco = n + Math.round((Date.parse(hoy) - Date.parse(fila.hasta)) / 864e5); break; }
                }
                if (!completo) fila.diasSeco = null;
                // Si en las últimas 24 h ha llovido, eso manda aunque falten los diarios.
                if (fila.h24 >= UMBRAL_DIA_LLUVIA) fila.diasSeco = 0;
            }
        } catch (e) { fila.error = e.message; }
    }
    return fila;
}

// Cron: calcula todas las zonas de escalada y guarda el resultado en Firestore, que es lo que
// lee la web. Si una zona falla, conserva su último valor bueno en vez de dejarla vacía.
async function sincronizar(apiKey) {
    const ctx = await contexto(apiKey);
    let anterior = null;
    try { anterior = await leerDoc(DOC_LLUVIA_AEMET); } catch { /* primera vez */ }
    const zonas = {};
    const fallos = [];
    for (const z of ZONAS_ESCALADA) {
        let fila = null;
        try { fila = await calcularPunto(z.lat, z.lon, ctx); } catch (e) { fila = { error: e.message }; }
        if (fila?.error && anterior?.zonas?.[z.id] && !anterior.zonas[z.id].error) {
            fallos.push(z.id);
            zonas[z.id] = anterior.zonas[z.id];
        } else {
            if (fila?.error) fallos.push(z.id);
            zonas[z.id] = { ...fila, hora: new Date().toISOString() };
        }
    }
    const doc = { zonas, actualizado: new Date().toISOString(), fallos };
    await escribirDoc(DOC_LLUVIA_AEMET, doc);
    return { ok: true, zonas: Object.keys(zonas).length, fallos, actualizado: doc.actualizado };
}

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

    const apiKey = process.env.AEMET_API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'AEMET_API_KEY not configured on server' });

    // Cron de Vercel (envía "Authorization: Bearer CRON_SECRET") o lanzamiento manual con ?action=sync&key=CRON_SECRET.
    const secreto = process.env.CRON_SECRET;
    const cabecera = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    const autorizado = !!secreto && (cabecera === secreto || req.query?.key === secreto);
    if (req.query?.action === 'sync' || autorizado) {
        if (!autorizado) return res.status(401).json({ error: 'No autorizado' });
        try { return res.status(200).json(await sincronizar(apiKey)); } catch (err) { return res.status(500).json({ error: err.message }); }
    }

    // Consulta al momento: solo para lugares que el usuario añade y que el cron no cubre.
    const puntos = String(req.query?.p || '').split(';').map(s => s.split(',').map(Number))
        .filter(([la, lo]) => Number.isFinite(la) && Number.isFinite(lo) && Math.abs(la) <= 90 && Math.abs(lo) <= 180)
        .slice(0, MAX_PUNTOS);
    if (!puntos.length) return res.status(400).json({ error: 'Missing p=lat,lon;lat,lon' });

    try {
        const ctx = await contexto(apiKey);
        const resultado = [];
        for (const [la, lo] of puntos) resultado.push(await calcularPunto(la, lo, ctx));
        res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=7200');
        return res.status(200).json(resultado);
    } catch (err) {
        return res.status(502).json({ error: err.message });
    }
}
