import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { db } from '../firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

// ─── Recopilador de precipitaciones (Open-Meteo) ────────────────────────────
// Datos de Open-Meteo: API JSON gratuita, sin API key y con CORS abierto, así que
// se consulta directamente desde el navegador (sin función serverless).
//  · forecast  → lluvia horaria de los últimos 92 días + previsión de mañana
//  · archive   → lluvia diaria desde el 1 de enero hasta donde empieza la ventana anterior
//  · geocoding → buscador de lugares
// Todas las ubicaciones se piden en UNA sola llamada (latitude=a,b,c…).
//
// Caché diaria para gastar lo mínimo de API: los datos ya procesados se guardan en
// Firestore lluvia_cache/{YYYY-MM-DD} (fecha de Madrid), compartidos por todos los
// visitantes. Solo la primera consulta del día de cada ubicación llama a Open-Meteo;
// además se guarda copia en localStorage para no leer Firestore en cada visita.

const URL_FORECAST = 'https://api.open-meteo.com/v1/forecast';
const URL_ARCHIVE = 'https://archive-api.open-meteo.com/v1/archive';
const URL_GEO = 'https://geocoding-api.open-meteo.com/v1/search';
const DIAS_PASADOS = 92;          // máximo que admite la API de previsión
const UMBRAL_DIA_LLUVIA = 1;      // mm/día para contar un día como "de lluvia"
const LS_KEY = 'pikt_lluvia_sitios_v2';
const LS_CACHE = 'pikt_lluvia_cache';
const COL_CACHE = 'lluvia_cache';
const fechaMadrid = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Madrid' }); // YYYY-MM-DD

const leerCacheLocal = (fecha) => {
    try {
        const c = JSON.parse(localStorage.getItem(LS_CACHE));
        if (c?.fecha === fecha && c.sitios) return { ...c, aemet: c.aemet || {} };
    } catch { /* noop */ }
    return { fecha, sitios: {}, aemet: {} };
};
// Relee antes de escribir: Open-Meteo y AEMET se guardan por separado y pueden solaparse.
const actualizarCacheLocal = (fecha, clave, valores) => {
    const c = leerCacheLocal(fecha);
    Object.assign(c[clave], valores);
    try { localStorage.setItem(LS_CACHE, JSON.stringify(c)); } catch { /* noop */ }
};

// AEMET: proxy propio en Vercel (api/aemet.js) porque la API key no puede ir al navegador.
const URL_AEMET = '/api/aemet';
const AEMET_POR_LLAMADA = 15;
// Subir al cambiar api/aemet.js: las entradas de caché de otra versión se vuelven a pedir.
const AEMET_VER = 3;

// Zonas de escalada de referencia (coordenadas aproximadas del sector principal).
export const ZONAS_ESCALADA = [
    { id: 'rodellar',   nombre: 'Rodellar',        region: 'Huesca',     lat: 42.285, lon: -0.083 },
    { id: 'alquezar',   nombre: 'Alquézar',        region: 'Huesca',     lat: 42.173, lon: 0.026 },
    { id: 'barasona',   nombre: 'Barasona',        region: 'Huesca',     lat: 42.137, lon: 0.318 },
    { id: 'baldellou',  nombre: 'Baldellou',       region: 'Huesca',     lat: 41.918, lon: 0.547 },
    { id: 'avellanes',  nombre: 'Les Avellanes',   region: 'Lleida',     lat: 41.876, lon: 0.757 },
    { id: 'santalinya', nombre: 'Santa Linya',     region: 'Lleida',     lat: 41.933, lon: 0.800 },
    { id: 'terradets',  nombre: 'Terradets',       region: 'Lleida',     lat: 42.040, lon: 0.883 },
    { id: 'oliana',     nombre: 'Oliana',          region: 'Lleida',     lat: 42.070, lon: 1.310 },
    { id: 'margalef',   nombre: 'Margalef',        region: 'Tarragona',  lat: 41.285, lon: 0.754 },
    { id: 'siurana',    nombre: 'Siurana',         region: 'Tarragona',  lat: 41.258, lon: 0.932 },
    { id: 'riglos',     nombre: 'Riglos',          region: 'Huesca',     lat: 42.348, lon: -0.726 },
    { id: 'montserrat', nombre: 'Montserrat',      region: 'Barcelona',  lat: 41.593, lon: 1.837 },
    { id: 'albarracin', nombre: 'Albarracín',      region: 'Teruel',     lat: 40.408, lon: -1.444 },
    { id: 'chulilla',   nombre: 'Chulilla',        region: 'Valencia',   lat: 39.655, lon: -0.890 },
    { id: 'chorro',     nombre: 'El Chorro',       region: 'Málaga',     lat: 36.906, lon: -4.760 },
    { id: 'pedriza',    nombre: 'La Pedriza',      region: 'Madrid',     lat: 40.750, lon: -3.880 },
    { id: 'patones',    nombre: 'Patones',         region: 'Madrid',     lat: 40.870, lon: -3.480 },
    { id: 'ramales',    nombre: 'Ramales',         region: 'Cantabria',  lat: 43.260, lon: -3.460 },
    { id: 'ifach',      nombre: 'Peñón de Ifach',  region: 'Alicante',   lat: 38.635, lon: 0.075 },
];
const POR_DEFECTO = ['rodellar', 'alquezar', 'barasona', 'avellanes', 'santalinya', 'baldellou', 'terradets', 'oliana', 'margalef', 'siurana'];

const COLUMNAS = [
    { key: 'h24',    label: 'Últimas 24 h' },
    { key: 'd7',     label: 'Última semana' },
    { key: 'd30',    label: 'Último mes' },
    { key: 'mesAnt', label: 'Mes anterior' },
    { key: 'anio',   label: 'Año actual' },
];
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const MESES_LARGO = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

// ─── Utilidades de fechas (todo en "YYYY-MM-DD" local de cada ubicación) ────
const isoDia = (d) => d.toISOString().slice(0, 10);
const sumarDias = (dia, n) => { const d = new Date(dia + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return isoDia(d); };
const redondear = (v) => Math.round(v * 10) / 10;
const fmt = (v) => (v == null ? '—' : v >= 100 ? Math.round(v).toLocaleString('es-ES') : redondear(v).toLocaleString('es-ES'));

const cargarSitios = () => {
    try {
        const guardado = JSON.parse(localStorage.getItem(LS_KEY));
        if (Array.isArray(guardado) && guardado.length) return guardado;
    } catch { /* noop */ }
    return ZONAS_ESCALADA.filter(z => POR_DEFECTO.includes(z.id));
};

// Una llamada con varias coordenadas devuelve un array; con una sola, un objeto.
async function pedir(url, sitios, extra) {
    const q = new URLSearchParams({
        latitude: sitios.map(s => s.lat).join(','),
        longitude: sitios.map(s => s.lon).join(','),
        timezone: 'auto',
        ...extra,
    });
    const r = await fetch(`${url}?${q}`);
    if (!r.ok) throw new Error(`Open-Meteo respondió ${r.status}`);
    const j = await r.json();
    return Array.isArray(j) ? j : [j];
}

// Calcula todos los acumulados de una ubicación a partir de las dos respuestas.
function procesar(prev, arch) {
    const off = prev.utc_offset_seconds || 0;
    const ahoraLocal = new Date(Date.now() + off * 1000).toISOString().slice(0, 16); // YYYY-MM-DDTHH:MM
    const hoy = ahoraLocal.slice(0, 10);
    const t = prev.hourly?.time || [];
    const p = prev.hourly?.precipitation || [];

    // Índice de la última hora ya transcurrida (el valor de T es lo caído entre T-1h y T).
    let k = -1;
    for (let i = 0; i < t.length; i++) { if (t[i] <= ahoraLocal) k = i; else break; }
    const sumaHoras = (desde, hasta) => {
        let s = 0;
        for (let i = Math.max(0, desde); i <= hasta && i < p.length; i++) s += p[i] || 0;
        return s;
    };

    // Lluvia diaria observada: ventana horaria + archivo (solo días anteriores a la ventana).
    const diario = {};
    if (arch?.daily?.time) arch.daily.time.forEach((d, i) => { diario[d] = arch.daily.precipitation_sum[i] || 0; });
    const ventana = {};
    for (let i = 0; i <= k; i++) { const d = t[i].slice(0, 10); ventana[d] = (ventana[d] || 0) + (p[i] || 0); }
    Object.assign(diario, ventana);

    const [anio, mes] = hoy.split('-').map(Number);
    const prefMesAnt = mes === 1 ? `${anio - 1}-12` : `${anio}-${String(mes - 1).padStart(2, '0')}`;
    let mesAnt = 0, total = 0;
    const porMes = Array(12).fill(0);
    Object.entries(diario).forEach(([d, v]) => {
        if (d.startsWith(prefMesAnt)) mesAnt += v;
        if (d.startsWith(String(anio)) && d <= hoy) { total += v; porMes[Number(d.slice(5, 7)) - 1] += v; }
    });

    // Días desde el último día con lluvia apreciable.
    let diasSeco = null;
    for (let n = 0; n <= DIAS_PASADOS; n++) {
        const d = sumarDias(hoy, -n);
        if ((diario[d] || 0) >= UMBRAL_DIA_LLUVIA) { diasSeco = n; break; }
    }

    const ultimos30 = Array.from({ length: 30 }, (_, i) => { const d = sumarDias(hoy, i - 29); return { d, v: diario[d] || 0 }; });

    return {
        h24: sumaHoras(k - 23, k),
        d7: sumaHoras(k - 24 * 7 + 1, k),
        d30: sumaHoras(k - 24 * 30 + 1, k),
        mesAnt,
        anio: total,
        prox24: sumaHoras(k + 1, k + 24),
        diasSeco,
        porMes,
        ultimos30,
        nombreMesAnt: MESES_LARGO[mes === 1 ? 11 : mes - 2],
        anioActual: anio,
        mesActual: mes,
        hoy,
        elevacion: prev.elevation,
    };
}

// En móvil la tabla se sustituye por tarjetas (una por ubicación).
function useEsMovil(max = 640) {
    const consulta = `(max-width: ${max}px)`;
    const [movil, setMovil] = useState(() => typeof window !== 'undefined' && window.matchMedia(consulta).matches);
    useEffect(() => {
        const mq = window.matchMedia(consulta);
        const cambio = () => setMovil(mq.matches);
        mq.addEventListener('change', cambio);
        return () => mq.removeEventListener('change', cambio);
    }, [consulta]);
    return movil;
}

// ─── Gráfico de barras SVG ───────────────────────────────────────────────────
function Barras({ datos, color, alto = 140, destacarUltimo = false }) {
    const max = Math.max(1, ...datos.map(d => d.v));
    const ancho = 100 / datos.length;
    return (
        <svg viewBox={`0 0 100 ${alto}`} preserveAspectRatio="none" style={{ width: '100%', height: alto, display: 'block' }}>
            {[0.25, 0.5, 0.75].map(f => (
                <line key={f} x1="0" x2="100" y1={alto - f * (alto - 16)} y2={alto - f * (alto - 16)} stroke="rgba(255,255,255,0.07)" strokeWidth="0.4" vectorEffect="non-scaling-stroke" />
            ))}
            {datos.map((d, i) => {
                const h = (d.v / max) * (alto - 16);
                return (
                    <rect key={i} x={i * ancho + ancho * 0.15} y={alto - h} width={ancho * 0.7} height={Math.max(h, d.v > 0 ? 1 : 0)}
                        rx="0.6" fill={color} opacity={destacarUltimo && i === datos.length - 1 ? 1 : 0.8}>
                        <title>{`${d.etiqueta || d.d}: ${fmt(d.v)} mm`}</title>
                    </rect>
                );
            })}
        </svg>
    );
}

// ─── Mapa (Leaflet sin teselas: provincias en GeoJSON, el mismo que usa Geografía) ─
// Sin servicios de teselas → sin API key. Un círculo por ubicación: tamaño y color
// según la lluvia del periodo elegido.
const ESP_PROV_URL = 'https://raw.githubusercontent.com/codeforamerica/click_that_hood/master/public/data/spain-provinces.geojson';
let provinciasPromesa = null;
const cargarProvincias = () => (provinciasPromesa ||= fetch(ESP_PROV_URL).then(r => r.json()).catch(e => { provinciasPromesa = null; throw e; }));

function Mapa({ sitios, datos, metrica, seleccionado, onSeleccionar }) {
    const divRef = useRef(null);
    const mapRef = useRef(null);
    const capaRef = useRef(null);
    const encuadreRef = useRef('');

    useEffect(() => {
        // En táctil, arrastrar con un dedo debe desplazar la página, no el mapa (se hace zoom con dos dedos).
        const map = L.map(divRef.current, { zoomControl: true, scrollWheelZoom: false, dragging: !L.Browser.mobile, attributionControl: false, minZoom: 5, maxZoom: 12 }).setView([41.9, 0.6], 8);
        // Panel propio por debajo de los círculos, aunque el GeoJSON llegue después que los datos.
        map.createPane('provincias').style.zIndex = 350;
        let vivo = true;
        cargarProvincias().then(geo => {
            if (!vivo) return;
            L.geoJSON(geo, {
                pane: 'provincias',
                style: { color: '#475569', weight: 1, fillColor: '#1e293b', fillOpacity: 1 },
                onEachFeature: (f, capa) => capa.bindTooltip(f.properties?.name || '', { sticky: true, className: 'pikt-lluvia-tip' }),
            }).addTo(map);
        }).catch(() => { /* sin contornos: los puntos siguen sobre el fondo */ });
        capaRef.current = L.featureGroup().addTo(map);
        mapRef.current = map;
        return () => { vivo = false; map.remove(); mapRef.current = null; };
    }, []);

    useEffect(() => {
        const map = mapRef.current, capa = capaRef.current;
        if (!map || !capa) return;
        capa.clearLayers();
        const max = Math.max(1, ...sitios.map(s => datos[s.id]?.[metrica] || 0));
        sitios.forEach(s => {
            const v = datos[s.id]?.[metrica];
            const f = v ? Math.min(1, v / max) : 0;
            const sel = s.id === seleccionado;
            const m = L.circleMarker([s.lat, s.lon], {
                radius: 7 + 17 * Math.sqrt(f),
                color: sel ? '#facc15' : '#e0f2fe', weight: sel ? 3 : 1.5,
                fillColor: v == null ? '#64748b' : v < 0.1 ? '#22c55e' : `rgb(${Math.round(125 - 95 * f)},${Math.round(211 - 120 * f)},${Math.round(252 - 30 * f)})`,
                fillOpacity: 0.8,
            }).addTo(capa);
            m.bindTooltip(`<b>${s.nombre}</b><br>${v == null ? '—' : `${fmt(v)} mm`}`, { permanent: true, direction: 'top', offset: [0, -6], className: 'pikt-lluvia-tip' });
            m.on('click', () => onSeleccionar(s.id));
        });
        // Reencuadra solo cuando cambia el conjunto de ubicaciones, no al cambiar de periodo.
        const clave = sitios.map(s => s.id).join('|');
        if (clave !== encuadreRef.current && sitios.length) {
            encuadreRef.current = clave;
            if (sitios.length === 1) map.setView([sitios[0].lat, sitios[0].lon], 10);
            else map.fitBounds(L.latLngBounds(sitios.map(s => [s.lat, s.lon])), { padding: [40, 40] });
        }
    }, [sitios, datos, metrica, seleccionado, onSeleccionar]);

    return (
        <>
            <style>{`.pikt-lluvia-tip{background:rgba(15,23,42,.88);color:#e2e8f0;border:1px solid #334155;border-radius:8px;font-size:11px;padding:3px 7px;box-shadow:none;text-align:center;line-height:1.25}
.pikt-lluvia-tip.leaflet-tooltip-top:before{border-top-color:rgba(15,23,42,.88)}`}</style>
            <div ref={divRef} style={{ height: 'clamp(300px, 60vh, 460px)', width: '100%', borderRadius: 14, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)', background: '#0b1a2e' }} />
        </>
    );
}

// ─── Buscador de lugares (geocoding de Open-Meteo) ──────────────────────────
function Buscador({ onAnadir, yaIds, movil }) {
    const [texto, setTexto] = useState('');
    const [res, setRes] = useState([]);
    const [cargando, setCargando] = useState(false);
    const [geoMsg, setGeoMsg] = useState('');

    useEffect(() => {
        const q = texto.trim();
        if (q.length < 2) { setRes([]); return; }
        let cancel = false;
        const tm = setTimeout(async () => {
            setCargando(true);
            try {
                const r = await fetch(`${URL_GEO}?${new URLSearchParams({ name: q, count: '6', language: 'es' })}`);
                const j = await r.json();
                if (!cancel) setRes(j.results || []);
            } catch { if (!cancel) setRes([]); }
            if (!cancel) setCargando(false);
        }, 350);
        return () => { cancel = true; clearTimeout(tm); };
    }, [texto]);

    const miUbicacion = () => {
        if (!navigator.geolocation) { setGeoMsg('Tu navegador no permite geolocalización.'); return; }
        setGeoMsg('Buscando tu ubicación…');
        navigator.geolocation.getCurrentPosition(
            pos => {
                const lat = Math.round(pos.coords.latitude * 100) / 100, lon = Math.round(pos.coords.longitude * 100) / 100;
                onAnadir({ id: `geo_${lat}_${lon}`, nombre: 'Mi ubicación', region: `${lat}, ${lon}`, lat, lon });
                setGeoMsg('');
            },
            () => setGeoMsg('No se ha podido obtener tu ubicación.'),
            { timeout: 10000 },
        );
    };

    const zonasLibres = ZONAS_ESCALADA.filter(z => !yaIds.includes(z.id));
    const chips = zonasLibres.map(z => (
        <button key={z.id} onClick={() => onAnadir(z)} style={{ background: 'transparent', border: '1px dashed #475569', borderRadius: 999, padding: movil ? '6px 12px' : '3px 10px', color: '#cbd5e1', cursor: 'pointer', fontSize: movil ? '0.82rem' : '0.75rem' }}>
            + {z.nombre}
        </button>
    ));

    return (
        <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 14, padding: 14, marginBottom: 18 }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <input value={texto} onChange={e => setTexto(e.target.value)} placeholder="Buscar un pueblo, ciudad o zona…"
                    style={{ flex: '1 1 220px', minWidth: 0, background: '#0b1220', border: '1px solid #334155', borderRadius: 10, padding: '9px 12px', color: 'white', fontSize: 16 }} />
                <button onClick={miUbicacion} style={btn('#0ea5e9')}>📍 Mi ubicación</button>
            </div>
            {geoMsg && <div style={{ color: '#94a3b8', fontSize: '0.8rem', marginTop: 8 }}>{geoMsg}</div>}
            {cargando && <div style={{ color: '#94a3b8', fontSize: '0.8rem', marginTop: 8 }}>Buscando…</div>}
            {res.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 8 }}>
                    {res.map(r => (
                        <button key={r.id} onClick={() => { onAnadir({ id: `g${r.id}`, nombre: r.name, region: [r.admin2 || r.admin1, r.country_code].filter(Boolean).join(' · '), lat: r.latitude, lon: r.longitude }); setTexto(''); setRes([]); }}
                            style={{ textAlign: 'left', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '7px 10px', color: '#e2e8f0', cursor: 'pointer', fontSize: '0.85rem' }}>
                            ➕ <strong>{r.name}</strong> <span style={{ color: '#94a3b8' }}>{[r.admin2, r.admin1, r.country].filter(Boolean).join(', ')}</span>
                        </button>
                    ))}
                </div>
            )}
            {zonasLibres.length > 0 && (movil ? (
                <details style={{ marginTop: 10 }}>
                    <summary style={{ color: '#94a3b8', fontSize: '0.82rem', cursor: 'pointer', padding: '4px 0' }}>➕ Añadir zonas de escalada ({zonasLibres.length})</summary>
                    <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 6 }}>{chips}</div>
                </details>
            ) : (
                <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                    <span style={{ color: '#64748b', fontSize: '0.75rem' }}>Zonas de escalada:</span>
                    {chips}
                </div>
            ))}
        </div>
    );
}

const btn = (c) => ({ background: `${c}22`, border: `1px solid ${c}`, color: 'white', borderRadius: 10, padding: '8px 14px', cursor: 'pointer', fontWeight: 700, fontSize: '0.85rem', whiteSpace: 'nowrap' });

// ─── Componente principal ────────────────────────────────────────────────────
export default function Precipitaciones() {
    const [sitios, setSitios] = useState(cargarSitios);
    const [datos, setDatos] = useState({});        // id → resultado de procesar()
    const [estado, setEstado] = useState('cargando'); // cargando | listo | error
    const [error, setError] = useState('');
    const [actualizado, setActualizado] = useState(null);
    const [orden, setOrden] = useState(null);       // { key, dir }
    const [detalle, setDetalle] = useState(null);   // id del sitio con el detalle abierto
    const [recarga, setRecarga] = useState(0);
    const [metricaMapa, setMetricaMapa] = useState('d7');
    const [aemet, setAemet] = useState({});            // id → fila de api/aemet
    const [estadoAemet, setEstadoAemet] = useState('cargando');
    const [fuente, setFuente] = useState('ambas');     // ambas | om | aemet
    const movil = useEsMovil();

    useEffect(() => { try { localStorage.setItem(LS_KEY, JSON.stringify(sitios)); } catch { /* noop */ } }, [sitios]);

    const claveSitios = sitios.map(s => s.id).join('|');
    useEffect(() => {
        if (!sitios.length) { setDatos({}); setEstado('listo'); return; }
        let cancel = false;
        (async () => {
            setEstado('cargando'); setError('');
            try {
                const fecha = fechaMadrid();
                const cache = leerCacheLocal(fecha);
                const pendientes = () => sitios.filter(s => !cache.sitios[s.id]);

                // 1) Lo que falte en el navegador, se busca en la caché compartida del día.
                if (pendientes().length) {
                    try {
                        const snap = await getDoc(doc(db, COL_CACHE, fecha));
                        if (snap.exists()) Object.assign(cache.sitios, snap.data().sitios || {});
                    } catch { /* sin Firestore se consulta la API */ }
                }

                // 2) Solo las ubicaciones que nadie ha consultado hoy van a Open-Meteo.
                const faltan = pendientes();
                if (faltan.length) {
                    const prev = await pedir(URL_FORECAST, faltan, { hourly: 'precipitation', past_days: String(DIAS_PASADOS), forecast_days: '2' });
                    // El archivo cubre del 1 de enero hasta el día anterior al primero de la ventana de previsión.
                    const primerDia = prev[0]?.hourly?.time?.[0]?.slice(0, 10);
                    const ini = `${primerDia?.slice(0, 4)}-01-01`;
                    let arch = [];
                    if (primerDia && primerDia > ini) {
                        try {
                            arch = await pedir(URL_ARCHIVE, faltan, { daily: 'precipitation_sum', start_date: ini, end_date: sumarDias(primerDia, -1) });
                        } catch { arch = []; } // sin archivo, el "año actual" solo sumará la ventana reciente
                    }
                    const nuevos = {};
                    faltan.forEach((s, i) => {
                        if (!prev[i]) return;
                        const d = { ...procesar(prev[i], arch[i]), sinArchivo: !arch[i] && primerDia > ini, hora: Date.now() };
                        nuevos[s.id] = JSON.parse(JSON.stringify(d)); // Firestore no admite undefined
                    });
                    Object.assign(cache.sitios, nuevos);
                    if (Object.keys(nuevos).length) {
                        setDoc(doc(db, COL_CACHE, fecha), { sitios: nuevos, actualizado: Date.now() }, { merge: true }).catch(() => { /* la copia local basta */ });
                    }
                }

                actualizarCacheLocal(fecha, 'sitios', cache.sitios);
                if (cancel) return;
                const out = {};
                sitios.forEach(s => { if (cache.sitios[s.id]) out[s.id] = cache.sitios[s.id]; });
                const horas = Object.values(out).map(d => d.hora).filter(Boolean);
                setDatos(out); setEstado('listo'); setActualizado(horas.length ? new Date(Math.min(...horas)) : null);
            } catch (e) {
                if (!cancel) { setError(e.message || 'Error de red'); setEstado('error'); }
            }
        })();
        return () => { cancel = true; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [claveSitios, recarga]);

    // AEMET (estaciones reales) en segundo plano: misma caché diaria, clave "aemet".
    useEffect(() => {
        if (!sitios.length) return;
        let cancel = false;
        (async () => {
            setEstadoAemet('cargando');
            try {
                const fecha = fechaMadrid();
                const cache = leerCacheLocal(fecha).aemet;
                const pendientes = () => sitios.filter(s => cache[s.id]?.ver !== AEMET_VER);
                if (pendientes().length) {
                    try {
                        const snap = await getDoc(doc(db, COL_CACHE, fecha));
                        if (snap.exists()) Object.entries(snap.data().aemet || {}).forEach(([id, v]) => { if (v?.ver === AEMET_VER) cache[id] = v; });
                    } catch { /* sin Firestore se consulta la API */ }
                }
                const faltan = pendientes();
                const nuevos = {};
                for (let i = 0; i < faltan.length; i += AEMET_POR_LLAMADA) {
                    const lote = faltan.slice(i, i + AEMET_POR_LLAMADA);
                    const r = await fetch(`${URL_AEMET}?p=${lote.map(s => `${s.lat},${s.lon}`).join(';')}`);
                    const j = await r.json().catch(() => null);
                    if (!r.ok || !Array.isArray(j)) throw new Error(j?.error || `AEMET ${r.status}`);
                    // Las filas con error (p. ej. límite de peticiones) no se guardan para reintentar otro día/visita.
                    lote.forEach((s, k) => { if (j[k] && !j[k].error) nuevos[s.id] = JSON.parse(JSON.stringify({ ...j[k], hora: Date.now(), ver: AEMET_VER })); else if (j[k]) cache[s.id] = j[k]; });
                }
                Object.assign(cache, nuevos);
                if (Object.keys(nuevos).length) {
                    actualizarCacheLocal(fecha, 'aemet', nuevos);
                    setDoc(doc(db, COL_CACHE, fecha), { aemet: nuevos, actualizado: Date.now() }, { merge: true }).catch(() => { /* la copia local basta */ });
                } else {
                    actualizarCacheLocal(fecha, 'aemet', Object.fromEntries(Object.entries(cache).filter(([, v]) => !v.error && v.ver === AEMET_VER)));
                }
                if (!cancel) { setAemet({ ...cache }); setEstadoAemet('listo'); }
            } catch {
                if (!cancel) setEstadoAemet('error');
            }
        })();
        return () => { cancel = true; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [claveSitios]);

    const anadir = useCallback((s) => setSitios(prev => (prev.some(x => x.id === s.id) ? prev : [...prev, s])), []);
    const quitar = (id) => { setSitios(prev => prev.filter(s => s.id !== id)); if (detalle === id) setDetalle(null); };

    // Fuente principal de la tabla y del mapa: Open-Meteo (también en "ambas") o AEMET.
    const principal = fuente === 'aemet' ? aemet : datos;

    const maximos = useMemo(() => {
        const m = {};
        [...COLUMNAS.map(c => c.key), 'prox24'].forEach(k => { m[k] = Math.max(1, ...Object.values(principal).map(d => d?.[k] || 0)); });
        return m;
    }, [principal]);

    const filas = useMemo(() => {
        const f = sitios.map(s => ({ s, d: datos[s.id], a: aemet[s.id], p: principal[s.id] }));
        if (!orden) return f;
        return [...f].sort((a, b) => {
            // En Open-Meteo, diasSeco null = más de 92 días sin lluvia (el más seco); sin datos va al final.
            const valor = (x) => (orden.key === 'diasSeco' && x.p && x.p.diasSeco == null && x.p !== x.a ? 9999 : orden.key === 'prox24' ? x.d?.prox24 : x.p?.[orden.key]);
            const va = valor(a) ?? -1, vb = valor(b) ?? -1;
            return orden.dir * (va - vb);
        });
    }, [sitios, datos, aemet, principal, orden]);

    const hoyLocal = fechaMadrid();
    const aemetAtrasado = (a) => a?.hasta && a.hasta < sumarDias(hoyLocal, -1);
    const fechaCorta = (d) => d.split('-').reverse().slice(0, 2).join('/');

    const cargandoP = fuente === 'aemet' ? estadoAemet === 'cargando' : estado === 'cargando';
    // Utilidades de presentación de los valores AEMET de una fila (tabla y tarjetas).
    const ayudasAemet = (a) => {
        // Periodos que AEMET cubre con valores diarios (que llegan con unos días de retraso).
        const parcial = (k) => ['d7', 'd30', 'anio', 'diasSeco'].includes(k) && aemetAtrasado(a);
        // Si la estación no cubre las 24 h completas, se dice cuántas horas son.
        const horas24 = a?.est24?.horas && a.est24.horas < 20 ? ` (${a.est24.horas} h)` : '';
        const extra = (k) => (k === 'h24' ? horas24 : parcial(k) ? '*' : '');
        const notaAemet = (k) => (k === 'd7' && a && a.d7 == null && a.hasta ? `AEMET aún no tiene suficientes días de esta semana (datos hasta el ${fechaCorta(a.hasta)})` : parcial(k) ? `Datos AEMET hasta el ${fechaCorta(a.hasta)}` : k === 'h24' && a?.est24 ? `Estación ${a.est24.nombre} (${a.est24.km} km) · ${a.est24.horas} h de datos` : a?.estacion ? `Estación ${a.estacion.nombre} (${a.estacion.km} km)` : '');
        const textoSeco = (x) => (x?.diasSeco == null ? (x === a ? '—' : `> ${DIAS_PASADOS}`) : x.diasSeco === 0 ? 'hoy' : x.diasSeco);
        return { parcial, extra, notaAemet, textoSeco };
    };
    const colorSeco = (x) => (x?.diasSeco == null ? '#4ade80' : x.diasSeco >= 3 ? '#4ade80' : x.diasSeco >= 1 ? '#fbbf24' : '#f87171');

    // Al pulsar un punto del mapa en móvil, se lleva la vista a su tarjeta (donde se abre el detalle).
    const seleccionarDesdeMapa = useCallback((id) => {
        setDetalle(id);
        if (movil) setTimeout(() => document.getElementById(`lluvia-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
    }, [movil]);

    const ordenarPor = (key) => setOrden(o => (o?.key === key ? (o.dir === -1 ? { key, dir: 1 } : null) : { key, dir: -1 }));
    const flecha = (key) => (orden?.key === key ? (orden.dir === -1 ? ' ▼' : ' ▲') : '');

    const celda = (v, max, rgb = '56,189,248') => ({
        padding: '9px 10px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 700,
        background: v ? `rgba(${rgb},${0.08 + 0.55 * Math.min(1, v / max)})` : 'transparent',
        color: v ? 'white' : '#64748b', borderBottom: '1px solid rgba(255,255,255,0.06)', whiteSpace: 'nowrap',
    });

    const ejemplo = Object.values(datos)[0];
    const sitioDetalle = sitios.find(s => s.id === detalle);
    const dDetalle = detalle ? datos[detalle] : null;

    // Gráficos de la ubicación elegida: debajo del mapa en escritorio, dentro de su tarjeta en móvil.
    const panelDetalle = sitioDetalle && dDetalle && (
        <div style={{ marginTop: movil ? 12 : 16, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(14,165,233,0.4)', borderRadius: movil ? 12 : 16, padding: movil ? 12 : 18 }}>
            {!movil && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
                    <h2 style={{ margin: 0, fontSize: '1.3rem' }}>📍 {sitioDetalle.nombre}</h2>
                    <span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>{sitioDetalle.lat.toFixed(3)}, {sitioDetalle.lon.toFixed(3)}</span>
                </div>
            )}
            <h3 style={{ ...sub, marginTop: movil ? 0 : 18 }}>Lluvia diaria · últimos 30 días</h3>
            <Barras color="#38bdf8" alto={movil ? 110 : 140} destacarUltimo datos={dDetalle.ultimos30.map(x => ({ ...x, etiqueta: fechaCorta(x.d) }))} />
            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b', fontSize: '0.7rem', marginTop: 4 }}>
                <span>{fechaCorta(dDetalle.ultimos30[0].d)}</span><span>hoy</span>
            </div>
            <h3 style={sub}>Lluvia por meses · {dDetalle.anioActual}</h3>
            <Barras color="#22c55e" alto={movil ? 100 : 120} datos={dDetalle.porMes.slice(0, dDetalle.mesActual).map((v, i) => ({ v, etiqueta: MESES_LARGO[i] }))} />
            <div style={{ display: 'flex', color: '#64748b', fontSize: movil ? '0.6rem' : '0.7rem', marginTop: 4 }}>
                {dDetalle.porMes.slice(0, dDetalle.mesActual).map((v, i) => (
                    <span key={i} style={{ flex: 1, textAlign: 'center', minWidth: 0 }}>{movil ? MESES[i][0].toUpperCase() : MESES[i]}<br /><span style={{ color: '#94a3b8' }}>{Math.round(v)}</span></span>
                ))}
            </div>
        </div>
    );

    // Tarjeta de una ubicación (vista móvil): cuadrícula de periodos con el valor principal y, debajo, AEMET.
    const TILES = [...COLUMNAS.map(c => ({ ...c, label: c.key === 'mesAnt' && ejemplo ? `Mes ant. (${ejemplo.nombreMesAnt.slice(0, 3)})` : c.key === 'anio' && ejemplo ? `Año ${ejemplo.anioActual}` : c.label.replace('Últimas ', '').replace('Última ', '').replace('Último ', '') })),
        { key: 'diasSeco', label: 'Días sin lluvia' }, { key: 'prox24', label: 'Próx. 24 h' }];
    const tarjeta = ({ s, d, a, p }) => {
        const { parcial, extra, textoSeco } = ayudasAemet(a);
        const abierta = detalle === s.id;
        return (
            <div key={s.id} id={`lluvia-${s.id}`} onClick={() => setDetalle(abierta ? null : s.id)}
                style={{ background: abierta ? 'rgba(14,165,233,0.1)' : 'rgba(255,255,255,0.04)', border: `1px solid ${abierta ? 'rgba(56,189,248,0.6)' : 'rgba(255,255,255,0.1)'}`, borderRadius: 14, padding: 12, scrollMarginTop: 60 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 10 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 800, fontSize: '1.05rem' }}>{s.nombre}</div>
                        <div style={{ color: '#64748b', fontSize: '0.75rem' }}>{s.region}{d?.elevacion != null ? ` · ${Math.round(d.elevacion)} m` : ''}</div>
                        {fuente !== 'om' && a?.estacion && (
                            <div style={{ color: '#d97706', fontSize: '0.72rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>📡 {a.estacion.nombre} · {a.estacion.km} km</div>
                        )}
                    </div>
                    <span style={{ color: '#64748b', fontSize: '0.75rem', paddingTop: 4 }}>{abierta ? '▲' : '▼'}</span>
                    <button onClick={e => { e.stopPropagation(); quitar(s.id); }} aria-label={`Quitar ${s.nombre}`}
                        style={{ background: 'rgba(255,255,255,0.06)', border: 'none', color: '#94a3b8', borderRadius: 8, width: 32, height: 32, cursor: 'pointer', fontSize: '0.9rem', flexShrink: 0 }}>✕</button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 6 }}>
                    {TILES.map(t => {
                        const esSeco = t.key === 'diasSeco', esProx = t.key === 'prox24';
                        const fuenteP = esProx ? d : p;
                        const v = fuenteP?.[t.key];
                        const fondo = esSeco ? 'rgba(255,255,255,0.04)' : v ? `rgba(${esProx ? '167,139,250' : '56,189,248'},${0.1 + 0.5 * Math.min(1, v / maximos[t.key])})` : 'rgba(255,255,255,0.04)';
                        const destacado = t.key === orden?.key;
                        return (
                            <div key={t.key} style={{ background: fondo, borderRadius: 10, padding: '7px 8px', minWidth: 0, outline: destacado ? '1px solid #38bdf8' : 'none' }}>
                                <div style={{ color: esProx ? '#c4b5fd' : '#94a3b8', fontSize: '0.64rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.label}</div>
                                <div style={{ fontWeight: 800, fontSize: '1.05rem', fontVariantNumeric: 'tabular-nums', color: esSeco ? colorSeco(p) : v ? 'white' : '#64748b' }}>
                                    {fuenteP ? (esSeco ? textoSeco(p) : fmt(v)) + (fuente === 'aemet' && !esProx ? extra(t.key) : '') : cargandoP ? '…' : '—'}
                                    {!esSeco && fuenteP && <span style={{ fontSize: '0.62rem', fontWeight: 600, color: '#94a3b8' }}> mm</span>}
                                </div>
                                {fuente === 'ambas' && !esProx && (
                                    <div style={{ fontSize: '0.66rem', fontWeight: 600, color: '#fbbf24', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                        {a ? `AEMET ${esSeco ? textoSeco(a) : fmt(a[t.key])}${esSeco ? (parcial('diasSeco') ? '*' : '') : extra(t.key)}` : estadoAemet === 'cargando' ? 'AEMET …' : ''}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
                {abierta && <div onClick={e => e.stopPropagation()}>{panelDetalle}</div>}
            </div>
        );
    };

    return (
        <div style={{ minHeight: '100vh', background: 'linear-gradient(160deg,#0b1220 0%,#0e2233 60%,#0a2a3a 100%)', color: 'white', fontFamily: "'Segoe UI', sans-serif", padding: movil ? '60px 12px 32px' : '64px 16px 40px', boxSizing: 'border-box', overflowX: 'hidden' }}>
            <div style={{ maxWidth: 960, margin: '0 auto' }}>
                <div style={{ textAlign: 'center', marginBottom: movil ? 14 : 22 }}>
                    <div style={{ fontSize: movil ? '2.2rem' : '3rem', lineHeight: 1 }}>🌧️</div>
                    <h1 style={{ margin: '8px 0 4px', fontSize: 'clamp(1.6rem,4.5vw,2.3rem)', fontWeight: 900 }}>Lluvia acumulada</h1>
                    <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.95rem' }}>Compara cuánto ha llovido en cada zona: ¿dónde estará la roca seca?</p>
                </div>

                <Buscador onAnadir={anadir} yaIds={sitios.map(s => s.id)} movil={movil} />

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
                    <span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>
                        {estado === 'cargando' ? 'Cargando datos…' : actualizado ? `Datos de hoy, consultados a las ${actualizado.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })} (se actualizan una vez al día) · valores en mm (= litros/m²)` : ''}
                        {estadoAemet === 'cargando' && fuente !== 'om' && <span style={{ color: '#fbbf24' }}> · Cargando estaciones AEMET…</span>}
                        {estadoAemet === 'error' && fuente !== 'om' && <span style={{ color: '#f87171' }}> · AEMET no disponible ahora</span>}
                    </span>
                    <div style={{ display: 'flex', gap: 4, background: 'rgba(255,255,255,0.05)', borderRadius: 999, padding: 3, width: movil ? '100%' : 'auto', order: movil ? -1 : 0 }}>
                        {[['ambas', 'Comparar'], ['om', 'Open-Meteo'], ['aemet', 'AEMET']].map(([k, l]) => (
                            <button key={k} onClick={() => setFuente(k)}
                                style={{ flex: movil ? 1 : 'none', background: fuente === k ? (k === 'aemet' ? '#f59e0b' : '#0ea5e9') : 'transparent', border: 'none', color: 'white', borderRadius: 999, padding: movil ? '8px 6px' : '5px 12px', cursor: 'pointer', fontSize: movil ? '0.82rem' : '0.78rem', fontWeight: 700 }}>
                                {l}
                            </button>
                        ))}
                    </div>
                </div>

                {estado === 'error' && (
                    <div style={{ background: '#450a0a', border: '1px solid #ef4444', borderRadius: 12, padding: 14, marginBottom: 14, color: '#fecaca', display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                        <span style={{ flex: 1 }}>No se han podido cargar los datos ({error}). Revisa la conexión.</span>
                        <button onClick={() => setRecarga(r => r + 1)} style={btn('#ef4444')}>↻ Reintentar</button>
                    </div>
                )}

                {sitios.length === 0 ? (
                    <div style={{ textAlign: 'center', color: '#94a3b8', padding: 30 }}>Añade alguna ubicación para empezar.</div>
                ) : movil ? (
                    <>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, color: '#94a3b8', fontSize: '0.82rem' }}>
                            Ordenar:
                            <select value={orden ? `${orden.key}:${orden.dir}` : ''} onChange={e => { const [k, dir] = e.target.value.split(':'); setOrden(k ? { key: k, dir: Number(dir) } : null); }}
                                style={{ flex: 1, minWidth: 0, background: '#0b1220', color: 'white', border: '1px solid #334155', borderRadius: 10, padding: '8px 10px', fontSize: 16 }}>
                                <option value="">Orden de la lista</option>
                                <option value="diasSeco:-1">Más días sin lluvia primero</option>
                                {TILES.filter(t => t.key !== 'diasSeco').map(t => <option key={t.key} value={`${t.key}:1`}>Menos lluvia · {t.label}</option>)}
                                {TILES.filter(t => t.key !== 'diasSeco').map(t => <option key={`${t.key}-`} value={`${t.key}:-1`}>Más lluvia · {t.label}</option>)}
                            </select>
                        </label>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>{filas.map(tarjeta)}</div>
                    </>
                ) : (
                    <div style={{ overflowX: 'auto', borderRadius: 14, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.03)' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem', minWidth: 720 }}>
                            <thead>
                                <tr style={{ background: 'rgba(255,255,255,0.06)' }}>
                                    <th style={th('left')}>Lugar</th>
                                    {COLUMNAS.map(c => (
                                        <th key={c.key} style={{ ...th('right'), cursor: 'pointer' }} onClick={() => ordenarPor(c.key)} title="Ordenar">
                                            {c.key === 'mesAnt' && ejemplo ? `Mes anterior (${ejemplo.nombreMesAnt})` : c.key === 'anio' && ejemplo ? `Año ${ejemplo.anioActual}` : c.label}{flecha(c.key)}
                                        </th>
                                    ))}
                                    <th style={{ ...th('right'), cursor: 'pointer' }} onClick={() => ordenarPor('diasSeco')} title="Días desde el último día con ≥1 mm">Días sin lluvia{flecha('diasSeco')}</th>
                                    <th style={{ ...th('right'), cursor: 'pointer', color: '#c4b5fd' }} onClick={() => ordenarPor('prox24')} title="Previsión">Próx. 24 h{flecha('prox24')}</th>
                                    <th style={th('center')} />
                                </tr>
                            </thead>
                            <tbody>
                                {filas.map(({ s, d, a, p }) => {
                                    const { parcial, extra, notaAemet, textoSeco } = ayudasAemet(a);
                                    return (
                                    <tr key={s.id} onClick={() => setDetalle(detalle === s.id ? null : s.id)} style={{ cursor: 'pointer', background: detalle === s.id ? 'rgba(14,165,233,0.12)' : 'transparent' }}>
                                        <td style={{ padding: '9px 12px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                                            <div style={{ fontWeight: 800 }}>{s.nombre}</div>
                                            <div style={{ color: '#64748b', fontSize: '0.72rem' }}>{s.region}{d?.elevacion != null ? ` · ${Math.round(d.elevacion)} m` : ''}</div>
                                            {fuente !== 'om' && a?.estacion && (
                                                <div style={{ color: '#d97706', fontSize: '0.68rem' }} title={`Estación AEMET ${a.estacion.id}`}>📡 {a.estacion.nombre} · {a.estacion.km} km</div>
                                            )}
                                        </td>
                                        {COLUMNAS.map(c => (
                                            <td key={c.key} style={celda(p?.[c.key], maximos[c.key])} title={fuente !== 'om' ? notaAemet(c.key) : undefined}>
                                                {p ? `${fmt(p[c.key])}${fuente === 'aemet' ? extra(c.key) : ''}` : cargandoP ? '…' : '—'}
                                                {fuente === 'ambas' && (
                                                    <div style={{ fontSize: '0.7rem', fontWeight: 600, color: '#fbbf24' }}>
                                                        {a ? `AEMET ${fmt(a[c.key])}${extra(c.key)}` : estadoAemet === 'cargando' ? 'AEMET …' : ''}
                                                    </div>
                                                )}
                                            </td>
                                        ))}
                                        <td style={{ ...celda(0, 1), color: p?.diasSeco == null ? '#4ade80' : p.diasSeco >= 3 ? '#4ade80' : p.diasSeco >= 1 ? '#fbbf24' : '#f87171' }}>
                                            {p ? textoSeco(p) : '—'}
                                            {fuente === 'ambas' && a && <div style={{ fontSize: '0.7rem', fontWeight: 600, color: '#fbbf24' }}>AEMET {textoSeco(a)}{parcial('diasSeco') ? '*' : ''}</div>}
                                        </td>
                                        <td style={celda(d?.prox24, maximos.prox24, '167,139,250')}>{d ? fmt(d.prox24) : '—'}</td>
                                        <td style={{ textAlign: 'center', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                                            <button onClick={e => { e.stopPropagation(); quitar(s.id); }} title="Quitar" style={{ background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '1rem', padding: '4px 8px' }}>✕</button>
                                        </td>
                                    </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}

                {ejemplo?.sinArchivo && (
                    <p style={{ color: '#fbbf24', fontSize: '0.78rem', marginTop: 8 }}>⚠️ No se ha podido cargar el histórico del año: el total anual solo incluye los últimos {DIAS_PASADOS} días.</p>
                )}
                <p style={{ color: '#64748b', fontSize: '0.75rem', marginTop: 8 }}>
                    {movil ? 'Toca una tarjeta (o un punto del mapa) para ver sus gráficos.' : 'Pulsa una fila (o un punto del mapa) para ver el detalle. Pulsa una cabecera para ordenar.'}
                    {fuente !== 'om' && <> AEMET usa la estación más cercana{movil ? '' : ' (pasa el ratón por una cifra para verla)'}; <span style={{ color: '#fbbf24' }}>*</span> = los valores diarios de AEMET llegan con unos días de retraso.</>}
                </p>

                {sitios.length > 0 && (
                    <div style={{ marginTop: 16 }}>
                        <div style={{ display: 'flex', gap: 6, flexWrap: movil ? 'nowrap' : 'wrap', overflowX: movil ? 'auto' : 'visible', marginBottom: 10, alignItems: 'center', paddingBottom: movil ? 4 : 0 }}>
                            <span style={{ color: '#94a3b8', fontSize: '0.8rem', fontWeight: 700, marginRight: 4, flexShrink: 0 }}>🗺️ Mapa:</span>
                            {[...COLUMNAS, { key: 'prox24', label: 'Próx. 24 h' }].map(c => (
                                <button key={c.key} onClick={() => setMetricaMapa(c.key)}
                                    style={{ flexShrink: 0, whiteSpace: 'nowrap', background: metricaMapa === c.key ? '#0ea5e9' : 'rgba(255,255,255,0.06)', border: `1px solid ${metricaMapa === c.key ? '#38bdf8' : 'rgba(255,255,255,0.15)'}`, color: 'white', borderRadius: 999, padding: movil ? '7px 12px' : '5px 11px', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 700 }}>
                                    {c.label}
                                </button>
                            ))}
                        </div>
                        <Mapa sitios={sitios} datos={principal} metrica={metricaMapa} seleccionado={detalle} onSeleccionar={seleccionarDesdeMapa} />
                    </div>
                )}

                {!movil && panelDetalle}

                <div style={{ marginTop: 22, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: '14px 16px', color: '#94a3b8', fontSize: '0.82rem', lineHeight: 1.55 }}>
                    <strong style={{ color: '#e2e8f0' }}>💡 ¿Qué significa 1 mm de lluvia?</strong> Que en cada metro cuadrado de suelo ha caído 1 litro de agua
                    (1 L / 1 m² = 0,001 m³ / 1 m² = 1 mm de altura). Un chubasco fuerte deja 10–30 mm en una hora; en buena parte de España llueven
                    entre 300 y 800 mm al año.
                    <br />
                    <strong style={{ color: '#e2e8f0' }}>🧗 Para escalar:</strong> la caliza suele secar en 1–2 días de sol y viento, pero el conglomerado
                    (Riglos, Montserrat) y la arenisca (Albarracín) absorben agua: con la arenisca mojada se rompen presas, espera al menos 2–3 días secos.
                    <br />
                    <span style={{ fontSize: '0.72rem' }}>Datos: <a href="https://open-meteo.com/" target="_blank" rel="noreferrer" style={{ color: '#38bdf8' }}>Open-Meteo</a> (modelos meteorológicos y reanálisis ERA5, CC BY 4.0): estimaciones en una rejilla de 1–25 km, no lecturas de pluviómetro.
                        {' '}<a href="https://opendata.aemet.es/" target="_blank" rel="noreferrer" style={{ color: '#fbbf24' }}>© AEMET</a>: pluviómetros de la estación más cercana (observación horaria para 24 h y valores climatológicos diarios para el resto).</span>
                </div>
            </div>
        </div>
    );
}

const th = (align) => ({ padding: '10px 10px', textAlign: align, fontSize: '0.74rem', textTransform: 'uppercase', letterSpacing: 0.4, color: '#94a3b8', fontWeight: 700, whiteSpace: 'nowrap' });
const sub = { margin: '18px 0 8px', fontSize: '0.85rem', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 };
