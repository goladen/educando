// Lluvia de las estaciones automáticas de Meteocat (XEMA) desde el portal de datos abiertos de la
// Generalitat (Socrata, analisi.transparenciacatalunya.cat): sin API key, sin cuota y con CORS abierto,
// así que se consulta directamente desde el navegador.
//  · yqwd-vj5e → estaciones (coordenadas, estado)
//  · 7bvh-jvq2 → datos diarios; variable 1300 = precipitación acumulada diaria (llega con ~2 días de retraso)
//  · nzvn-apee → datos semihorarios; variable 35 = precipitación (casi en tiempo real, con algún hueco)
// Los días que al diario aún le faltan se completan con la suma de los semihorarios.
// Las fechas de Meteocat están en hora UTC (TU).

const BASE = 'https://analisi.transparenciacatalunya.cat/resource';
const LS_ESTACIONES = 'pikt_xema_estaciones';
const LS_DATOS = 'pikt_xema_lluvia';
const MAX_KM = 20;               // más lejos, la estación ya no representa la zona
const UMBRAL_DIA_LLUVIA = 1;
const DIAS_SEMIHORARIOS = 6;     // ventana de semihorarios para cubrir el retraso del diario
const VIGENCIA_DATOS = 60 * 60e3; // 1 h: los semihorarios se publican cada 30 min

const sumarDias = (dia, n) => { const d = new Date(dia + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const redondear = (v) => Math.round(v * 10) / 10;
function km(a, b, c, d) {
    const R = 6371, rad = Math.PI / 180;
    const x = Math.sin((c - a) * rad / 2) ** 2 + Math.cos(a * rad) * Math.cos(c * rad) * Math.sin((d - b) * rad / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(x));
}

async function soql(dataset, params) {
    const r = await fetch(`${BASE}/${dataset}.json?${new URLSearchParams(params)}`);
    if (!r.ok) throw new Error(`Meteocat ${r.status}`);
    return r.json();
}

// Estaciones operativas de la XEMA (se guardan 30 días: cambian muy poco).
async function estaciones() {
    try {
        const c = JSON.parse(localStorage.getItem(LS_ESTACIONES));
        if (c && Date.now() - c.t < 30 * 864e5 && c.lista?.length) return c.lista;
    } catch { /* noop */ }
    const filas = await soql('yqwd-vj5e', { $select: 'codi_estacio,nom_estacio,latitud,longitud,altitud,nom_municipi,codi_estat_ema', $limit: '2000' });
    const lista = filas.filter(e => String(e.codi_estat_ema) === '2')
        .map(e => ({ id: e.codi_estacio, nombre: e.nom_estacio, municipio: e.nom_municipi, lat: +e.latitud, lon: +e.longitud, alt: +e.altitud || null }))
        .filter(e => Number.isFinite(e.lat) && Number.isFinite(e.lon));
    try { localStorage.setItem(LS_ESTACIONES, JSON.stringify({ t: Date.now(), lista })); } catch { /* noop */ }
    return lista;
}

/**
 * Lluvia Meteocat para una lista de sitios { id, lat, lon }.
 * Devuelve { [sitio.id]: { estacion, h24, d7, d30, mesAnt, anio, hasta, diasSeco, horas } } solo para
 * los sitios con una estación XEMA a menos de MAX_KM (en la práctica, Cataluña y alrededores).
 */
export async function lluviaMeteocat(sitios) {
    const clave = sitios.map(s => s.id).sort().join('|');
    try {
        const c = JSON.parse(localStorage.getItem(LS_DATOS));
        if (c && c.clave === clave && Date.now() - c.t < VIGENCIA_DATOS) return c.datos;
    } catch { /* noop */ }

    const lista = await estaciones();
    const asignadas = {};
    sitios.forEach(s => {
        const e = lista.map(x => ({ ...x, km: km(s.lat, s.lon, x.lat, x.lon) })).sort((a, b) => a.km - b.km)[0];
        if (e && e.km <= MAX_KM) asignadas[s.id] = { ...e, km: redondear(e.km) };
    });
    const codigos = [...new Set(Object.values(asignadas).map(e => e.id))];
    if (!codigos.length) return {};

    const ahora = new Date();
    const hoy = ahora.toISOString().slice(0, 10);
    const [anio, mes] = hoy.split('-').map(Number);
    const iniMesAnt = mes === 1 ? `${anio - 1}-12-01` : `${anio}-${String(mes - 1).padStart(2, '0')}-01`;
    const desde = `${anio}-01-01` < iniMesAnt ? `${anio}-01-01` : iniMesAnt;
    const enCodigos = `codi_estacio in(${codigos.map(c => `'${c.replace(/'/g, '')}'`).join(',')})`;
    // El diario es rápido; los semihorarios (tabla enorme) solo se piden desde el día siguiente al
    // último diario publicado, o desde hace 24 h si eso es antes, con un tope de DIAS_SEMIHORARIOS.
    const diarios = await soql('7bvh-jvq2', { $select: 'codi_estacio,data_lectura,valor', $where: `codi_variable=1300 AND data_lectura>='${desde}T00:00:00' AND ${enCodigos}`, $limit: '50000' });
    const ultimoDiario = diarios.reduce((m, f) => (f.data_lectura > m ? f.data_lectura : m), '').slice(0, 10);
    const hace24 = new Date(ahora.getTime() - 24.5 * 3600e3).toISOString().slice(0, 19);
    const tope = new Date(ahora.getTime() - DIAS_SEMIHORARIOS * 864e5).toISOString().slice(0, 19);
    let desdeSemi = ultimoDiario ? `${sumarDias(ultimoDiario, 1)}T00:00:00` : tope;
    if (desdeSemi > hace24) desdeSemi = hace24;
    if (desdeSemi < tope) desdeSemi = tope;
    const semis = await soql('nzvn-apee', { $select: 'codi_estacio,data_lectura,valor_lectura', $where: `codi_variable='35' AND data_lectura>='${desdeSemi}' AND ${enCodigos}`, $limit: '50000' });

    // Por estación: día → mm. Primero el diario (completo y validado) y después los días que le faltan, con semihorarios.
    const porEst = {};
    codigos.forEach(c => { porEst[c] = { dia: {}, semiDia: {}, h24: 0, horas: 0, ultima: null } });
    diarios.forEach(f => { const e = porEst[f.codi_estacio]; const v = parseFloat(f.valor); if (e && Number.isFinite(v)) e.dia[f.data_lectura.slice(0, 10)] = v; });
    const limite24 = ahora.getTime() - 24 * 3600e3;
    semis.forEach(f => {
        const e = porEst[f.codi_estacio]; const v = parseFloat(f.valor_lectura);
        if (!e || !Number.isFinite(v)) return;
        // La lectura de las HH:MM es la lluvia de la media hora que empieza a esa hora (UTC).
        const t = Date.parse(f.data_lectura + 'Z');
        const d = f.data_lectura.slice(0, 10);
        e.semiDia[d] = (e.semiDia[d] || 0) + v;
        if (t >= limite24 - 30 * 60e3) { e.h24 += v; e.horas += 0.5; }
        if (!e.ultima || f.data_lectura > e.ultima) e.ultima = f.data_lectura;
    });

    const prefMesAnt = iniMesAnt.slice(0, 7);
    const resultado = {};
    Object.entries(asignadas).forEach(([sid, est]) => {
        const e = porEst[est.id];
        const fechasDiario = Object.keys(e.dia).sort();
        const hastaDiario = fechasDiario[fechasDiario.length - 1] || null;
        const dia = { ...e.dia };
        Object.entries(e.semiDia).forEach(([d, v]) => { if (!hastaDiario || d > hastaDiario) dia[d] = v; });
        const fechas = Object.keys(dia).sort();
        const suma = (f) => redondear(fechas.filter(f).reduce((s, d) => s + dia[d], 0));
        // Hay datos hasta hoy si los semihorarios llegan a hoy; si no, hasta el último día con datos.
        const hasta = fechas[fechas.length - 1] || null;
        let diasSeco = null;
        for (let n = 0; n <= 366 && fechas.length; n++) {
            const d = sumarDias(hoy, -n);
            if (d < fechas[0]) break;
            if ((dia[d] || 0) >= UMBRAL_DIA_LLUVIA) { diasSeco = n; break; }
        }
        resultado[sid] = {
            estacion: { id: est.id, nombre: est.nombre, municipio: est.municipio, alt: est.alt, km: est.km },
            h24: e.horas ? redondear(e.h24) : null,
            horas: Math.round(e.horas),
            d7: suma(d => d > sumarDias(hoy, -7)),
            d30: suma(d => d > sumarDias(hoy, -30)),
            mesAnt: suma(d => d.startsWith(prefMesAnt)),
            anio: suma(d => d.startsWith(String(anio))),
            hasta, hastaDiario, ultima: e.ultima,
            diasSeco,
        };
    });

    try { localStorage.setItem(LS_DATOS, JSON.stringify({ t: Date.now(), clave, datos: resultado })); } catch { /* noop */ }
    return resultado;
}
