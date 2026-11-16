// Vercel serverless function — lluvia de los pluviómetros del SAIH Ebro (Confederación Hidrográfica del Ebro).
// SAIH_API_KEY vive solo aquí, nunca en el bundle del navegador.
//
// GET /api/saih?action=sync   (cron diario a las 23:50 de Madrid, protegido con CRON_SECRET)
//     /api/saih?action=sync&key=CRON_SECRET&dias=20   (lanzamiento manual para rellenar más historial)
// → guarda en Firestore sitio_publico/lluvia_saih, que es lo que lee la web:
//   { dias: { 'YYYY-MM-DD': { P106H: 10.4, …, _final: true } }, h24: { P106H: { valor, fecha } }, actualizado }
//
// API del SAIH: https://www.saihebro.com/datos/apiopendata?senal=A,B&inicio=YYYY-MM-DDTHH:MM:SS&apikey=…
//  · sin "inicio" → último valor de cada señal
//  · con "inicio" → lecturas cada 15 min de las 24 h siguientes (todas las señales en una llamada)
//  · <codigo>84PACUM = acumulado del día (vuelve a 0 a las 00:00; la lectura de las 00:00 es el total del día anterior)
//  · <codigo>83PA24H = lluvia de las últimas 24 h
//  · máximo 5 llamadas por minuto → se espera ESPERA_MS entre llamadas
import { leerDoc, escribirDoc } from './_google.js';
import { SAIH_ESTACIONES, DOC_LLUVIA_SAIH } from './_zonasLluvia.js';

const URL = 'https://www.saihebro.com/datos/apiopendata';
const ESPERA_MS = 13000;          // 5 llamadas/min como máximo → una cada 13 s con margen
const DIAS_RELLENO = 12;          // días de historial que faltan que se rellenan en cada ejecución
const MAX_DIAS_RELLENO = 20;      // tope del parámetro ?dias= (20 × 13 s ≈ 4,5 min < maxDuration)
const espera = (ms) => new Promise(r => setTimeout(r, ms));

const fechaMadrid = (t = Date.now()) => new Date(t).toLocaleDateString('sv-SE', { timeZone: 'Europe/Madrid' });
const sumarDias = (dia, n) => { const d = new Date(dia + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

let ultimaLlamada = 0;
async function saih(params, apiKey) {
    const falta = ultimaLlamada + ESPERA_MS - Date.now();
    if (falta > 0) await espera(falta);
    ultimaLlamada = Date.now();
    const q = new URLSearchParams({ ...params, apikey: apiKey });
    const r = await fetch(`${URL}?${q}`, { headers: { 'cache-control': 'no-cache' } });
    const texto = await r.text();
    let j;
    try { j = JSON.parse(texto); } catch { throw new Error(`SAIH ${r.status}: ${texto.slice(0, 160)}`); }
    if (!r.ok) throw new Error(`SAIH ${r.status}: ${JSON.stringify(j).slice(0, 160)}`);
    const lista = Array.isArray(j) ? j : j.senales;
    if (!Array.isArray(lista)) throw new Error(`SAIH: respuesta inesperada ${JSON.stringify(j).slice(0, 160)}`);
    return lista;
}

// Total de lluvia de un día por estación. Se pide desde las 00:15 de ese día: la última lectura
// (00:00 del día siguiente) es el total; si aún no ha llegado, el máximo hasta ahora (día abierto).
async function lluviaDia(dia, apiKey) {
    const senales = SAIH_ESTACIONES.map(e => `${e.codigo}84PACUM`).join(',');
    const lecturas = await saih({ senal: senales, inicio: `${dia}T00:15:00` }, apiKey);
    const cierre = `${sumarDias(dia, 1)} 00:00:00`;
    const out = {};
    let final = true;
    SAIH_ESTACIONES.forEach(e => {
        const ls = lecturas.filter(l => l.senal === `${e.codigo}84PACUM` && typeof l.valor === 'number');
        if (!ls.length) { final = false; return; }
        out[e.codigo] = Math.round(Math.max(...ls.map(l => l.valor)) * 10) / 10;
        if (!ls.some(l => l.fecha === cierre)) final = false;
    });
    if (!Object.keys(out).length) return null;
    return { ...out, _final: final };
}

async function sincronizar(apiKey, diasRelleno) {
    const doc = (await leerDoc(DOC_LLUVIA_SAIH).catch(() => null)) || {};
    const dias = doc.dias || {};
    const h24 = doc.h24 || {};
    const errores = [];

    // Día objetivo: el de hace 2 h en Madrid (el cron de las 23:50 en invierno cae a las 00:50 en verano).
    const objetivo = fechaMadrid(Date.now() - 2 * 3600e3);
    const [anio, mes] = objetivo.split('-').map(Number);
    const inicioHistorial = mes === 1 ? `${anio - 1}-12-01` : `${anio}-01-01`;

    // 1) Últimas 24 h: último valor de las señales PA24H (una llamada).
    try {
        const ult = await saih({ senal: SAIH_ESTACIONES.map(e => `${e.codigo}83PA24H`).join(','), inicio: '' }, apiKey);
        SAIH_ESTACIONES.forEach(e => {
            const l = ult.find(x => x.senal === `${e.codigo}83PA24H`);
            if (l && typeof l.valor === 'number') h24[e.codigo] = { valor: l.valor, fecha: l.fecha };
        });
    } catch (e) { errores.push(`24h: ${e.message}`); }

    // 2) Días a pedir: hoy, los días abiertos recientes y los huecos del historial (del más reciente hacia atrás).
    const pedir = [objetivo];
    for (let d = sumarDias(objetivo, -1), n = 0; d >= inicioHistorial && n < diasRelleno; d = sumarDias(d, -1)) {
        if (!dias[d] || !dias[d]._final) { pedir.push(d); n++; }
    }

    const hechos = [];
    for (const d of pedir) {
        try {
            const r = await lluviaDia(d, apiKey);
            if (r) { dias[d] = r; hechos.push(d); }
        } catch (e) {
            errores.push(`${d}: ${e.message}`);
            break;   // probablemente límite de llamadas: se sigue en la próxima ejecución
        }
    }

    // Solo se guarda el año en curso (y diciembre anterior en enero) para que el documento no crezca sin fin.
    Object.keys(dias).forEach(d => { if (d < inicioHistorial) delete dias[d]; });
    const fechas = Object.keys(dias).sort();
    const pendientes = [];
    for (let d = objetivo; d >= inicioHistorial; d = sumarDias(d, -1)) if (!dias[d]) pendientes.push(d);

    await escribirDoc(DOC_LLUVIA_SAIH, {
        dias, h24,
        estaciones: SAIH_ESTACIONES,
        desde: fechas[0] || null,
        hasta: fechas[fechas.length - 1] || null,
        diasPendientes: pendientes.length,
        actualizado: new Date().toISOString(),
    });
    return { ok: true, pedidos: hechos, diasPendientes: pendientes.length, desde: fechas[0] || null, errores };
}

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

    const apiKey = process.env.SAIH_API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'SAIH_API_KEY not configured on server' });

    // Cron de Vercel (envía "Authorization: Bearer CRON_SECRET") o lanzamiento manual con ?key=CRON_SECRET.
    const secreto = process.env.CRON_SECRET;
    const cabecera = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    const autorizado = !!secreto && (cabecera === secreto || req.query?.key === secreto);
    if (!autorizado) return res.status(401).json({ error: 'No autorizado' });

    const diasRelleno = Math.min(MAX_DIAS_RELLENO, Math.max(0, parseInt(req.query?.dias, 10) || DIAS_RELLENO));
    try {
        return res.status(200).json(await sincronizar(apiKey, diasRelleno));
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
}
