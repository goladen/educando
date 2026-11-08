// Cálculos geográficos para la carrera de orientación.
// Las distancias de una carrera escolar son cortas (< 2 km): se usa la
// aproximación plana local (equirectangular), con error < 0,1 %.

const R = 6371000;
const rad = (g) => (g * Math.PI) / 180;
const grad = (r) => (r * 180) / Math.PI;

/** Desplazamiento de A a B en metros: { norte, este } (negativos = sur / oeste). */
export function desplazamiento(a, b) {
    const latMedia = rad((a.lat + b.lat) / 2);
    return {
        norte: rad(b.lat - a.lat) * R,
        este: rad(b.lng - a.lng) * R * Math.cos(latMedia),
    };
}

/** Distancia en metros (haversine). */
export function distancia(a, b) {
    if (!a || !b) return Infinity;
    const dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
}

/** Rumbo de A a B en grados (0 = Norte, 90 = Este), respecto al norte geográfico. */
export function rumbo(a, b) {
    const { norte, este } = desplazamiento(a, b);
    return (grad(Math.atan2(este, norte)) + 360) % 360;
}

export const ROSA8 = [
    { abr: 'N', nombre: 'Norte' }, { abr: 'NE', nombre: 'Noreste' },
    { abr: 'E', nombre: 'Este' }, { abr: 'SE', nombre: 'Sureste' },
    { abr: 'S', nombre: 'Sur' }, { abr: 'SO', nombre: 'Suroeste' },
    { abr: 'O', nombre: 'Oeste' }, { abr: 'NO', nombre: 'Noroeste' },
];

export const direccion8 = (grados) => ROSA8[Math.round(((grados % 360) + 360) % 360 / 45) % 8];

/** Redondeo «humano» de distancias: al metro hasta 50 m, de 5 en 5 después. */
export const redondearM = (m) => (m < 50 ? Math.round(m) : Math.round(m / 5) * 5);

export const pasosDe = (m, longPaso = 0.65) => Math.round(m / longPaso);

export const fmtGrados = (g) => String(Math.round(g) % 360).padStart(3, '0') + '°';

/**
 * Indicación de un tramo en los 3 formatos.
 * Devuelve { distancia, rumbo, norte, este, componentes, rosa8, rumboTxt, partes }.
 */
export function indicacion(a, b) {
    const d = desplazamiento(a, b);
    const dist = distancia(a, b);
    const rb = rumbo(a, b);
    const partes = [];
    const n = redondearM(Math.abs(d.norte)), e = redondearM(Math.abs(d.este));
    if (n >= 2) partes.push({ m: n, dir: d.norte >= 0 ? 'Norte' : 'Sur', abr: d.norte >= 0 ? 'N' : 'S' });
    if (e >= 2) partes.push({ m: e, dir: d.este >= 0 ? 'Este' : 'Oeste', abr: d.este >= 0 ? 'E' : 'O' });
    if (!partes.length) partes.push({ m: Math.max(1, redondearM(dist)), dir: 'aquí al lado', abr: '·' });
    const d8 = direccion8(rb);
    return {
        distancia: redondearM(dist),
        rumbo: rb,
        norte: d.norte,
        este: d.este,
        partes,
        componentes: partes.map(p => `${p.m} m al ${p.dir}`).join(' y luego '),
        rosa8: `${redondearM(dist)} m hacia el ${d8.nombre} (${d8.abr})`,
        dir8: d8,
        rumboTxt: `Rumbo ${fmtGrados(rb)} · ${redondearM(dist)} m`,
    };
}

/** Recorrido: [salida, b1, b2, …, (meta)] → lista de tramos { desde, hasta, ind }. */
export function tramosDe(carrera) {
    const pts = puntosRecorrido(carrera);
    const out = [];
    for (let i = 1; i < pts.length; i++) out.push({ desde: pts[i - 1], hasta: pts[i], ind: indicacion(pts[i - 1], pts[i]) });
    return out;
}

export function puntosRecorrido(carrera) {
    const sal = carrera?.salida ? [{ ...carrera.salida, nombre: 'Salida', esSalida: true }] : [];
    const bal = (carrera?.balizas || []).map((b, i) => ({ ...b, num: i + 1 }));
    const meta = carrera?.salida && carrera?.config?.metaEnSalida ? [{ ...carrera.salida, nombre: 'Meta (salida)', esMeta: true }] : [];
    return [...sal, ...bal, ...meta];
}

export const longitudRecorrido = (carrera) => tramosDe(carrera).reduce((s, t) => s + distancia(t.desde, t.hasta), 0);

// Códigos de baliza: 3 caracteres sin ambiguos (sin 0/O, 1/I/L)
const ALF = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const codigoAleatorio = (n = 3) => Array.from({ length: n }, () => ALF[Math.floor(Math.random() * ALF.length)]).join('');
export const codigoAcceso = () => codigoAleatorio(6);

export const normalizar = (s) => String(s || '').trim().toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9ñ ]/g, '').replace(/\s+/g, ' ');

export const fmtTiempo = (ms) => {
    const s = Math.max(0, Math.round(ms / 1000));
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), ss = s % 60;
    return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(ss).padStart(2, '0');
};

/**
 * Captura de posición promediada: escucha el GPS `ms` milisegundos y hace la media
 * ponderada por 1/precisión² (las lecturas malas pesan poco).
 * onProgreso({ n, precision, lat, lng }) en cada lectura.
 */
export function capturarPosicion({ ms = 6000, onProgreso } = {}) {
    return new Promise((resolve, reject) => {
        if (!navigator.geolocation) { reject(new Error('Este dispositivo no tiene GPS o el navegador no lo permite.')); return; }
        const lecturas = [];
        const calc = () => {
            let sw = 0, la = 0, ln = 0, mejor = Infinity;
            lecturas.forEach(p => { const w = 1 / Math.max(1, p.acc) ** 2; sw += w; la += p.lat * w; ln += p.lng * w; mejor = Math.min(mejor, p.acc); });
            return { lat: la / sw, lng: ln / sw, precision: Math.round(mejor), n: lecturas.length };
        };
        const id = navigator.geolocation.watchPosition(
            (pos) => {
                lecturas.push({ lat: pos.coords.latitude, lng: pos.coords.longitude, acc: pos.coords.accuracy || 50 });
                onProgreso?.(calc());
            },
            (err) => { navigator.geolocation.clearWatch(id); clearTimeout(t); reject(new Error(mensajeErrorGps(err))); },
            { enableHighAccuracy: true, maximumAge: 0, timeout: ms + 8000 },
        );
        const t = setTimeout(() => {
            navigator.geolocation.clearWatch(id);
            if (!lecturas.length) reject(new Error('No llegó ninguna lectura del GPS. Sal al exterior y vuelve a intentarlo.'));
            else resolve(calc());
        }, ms);
    });
}

export function mensajeErrorGps(err) {
    if (!err) return 'Error de GPS.';
    if (err.code === 1) return 'Permiso de ubicación denegado. Actívalo en los ajustes del navegador.';
    if (err.code === 2) return 'Ubicación no disponible. Sal al exterior y activa el GPS del móvil.';
    if (err.code === 3) return 'El GPS tardó demasiado en responder.';
    return err.message || 'Error de GPS.';
}
