// Acceso a Firestore desde las funciones serverless, sin firebase-admin.
// Firma un JWT con la cuenta de servicio y usa la API REST de Firestore.
// Las peticiones autenticadas con cuenta de servicio SALTAN las reglas de seguridad.
import crypto from 'crypto';

const PROJECT_ID = 'aprendiendo-db0b3';
const BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

function cuentaDeServicio() {
    const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
    if (!raw) throw new Error('Falta GOOGLE_SERVICE_ACCOUNT_JSON en el entorno del servidor');
    const texto = raw.trim().startsWith('{') ? raw : Buffer.from(raw, 'base64').toString('utf8');
    const sa = JSON.parse(texto);
    if (!sa.client_email || !sa.private_key) throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON incompleto');
    return { ...sa, private_key: sa.private_key.replace(/\n/g, '\n') };
}

const b64url = (obj) => Buffer.from(typeof obj === 'string' ? obj : JSON.stringify(obj))
    .toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

let cacheToken = null; // { token, exp } reutilizado mientras la lambda siga caliente

/** Token OAuth2 con scope de Firestore a partir de la cuenta de servicio. */
async function tokenDeAcceso() {
    if (cacheToken && cacheToken.exp > Date.now() + 60_000) return cacheToken.token;

    const sa    = cuentaDeServicio();
    const ahora = Math.floor(Date.now() / 1000);
    const claim = {
        iss:   sa.client_email,
        scope: 'https://www.googleapis.com/auth/datastore',
        aud:   'https://oauth2.googleapis.com/token',
        iat:   ahora,
        exp:   ahora + 3600,
    };
    const cabecera = b64url({ alg: 'RS256', typ: 'JWT' });
    const cuerpo   = b64url(claim);
    const firma    = crypto.createSign('RSA-SHA256').update(`${cabecera}.${cuerpo}`).sign(sa.private_key)
        .toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

    const r = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
            assertion:  `${cabecera}.${cuerpo}.${firma}`,
        }),
    });
    const data = await r.json();
    if (!r.ok) throw new Error(`OAuth: ${data.error_description || data.error || r.status}`);

    cacheToken = { token: data.access_token, exp: Date.now() + (data.expires_in || 3600) * 1000 };
    return cacheToken.token;
}

// ---- Conversión JS <-> valores tipados de Firestore -------------------------

function aValor(v) {
    if (v === null || v === undefined)  return { nullValue: null };
    if (typeof v === 'boolean')         return { booleanValue: v };
    if (typeof v === 'number')          return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
    if (typeof v === 'string')          return { stringValue: v };
    if (Array.isArray(v))               return { arrayValue: { values: v.map(aValor) } };
    if (v instanceof Date)              return { timestampValue: v.toISOString() };
    return { mapValue: { fields: aCampos(v) } };
}
const aCampos = (obj) => Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, aValor(v)]));

function deValor(v) {
    if (!v || typeof v !== 'object') return null;
    if ('nullValue'      in v) return null;
    if ('booleanValue'   in v) return v.booleanValue;
    if ('integerValue'   in v) return Number(v.integerValue);
    if ('doubleValue'    in v) return v.doubleValue;
    if ('stringValue'    in v) return v.stringValue;
    if ('timestampValue' in v) return v.timestampValue;
    if ('arrayValue'     in v) return (v.arrayValue.values || []).map(deValor);
    if ('mapValue'       in v) return deCampos(v.mapValue.fields || {});
    return null;
}
const deCampos = (f) => Object.fromEntries(Object.entries(f).map(([k, v]) => [k, deValor(v)]));

// ---- API pública ------------------------------------------------------------

/** Lee un documento. Devuelve null si no existe. Ej: leerDoc('sitio_publico/instagram_feed') */
export async function leerDoc(ruta) {
    const r = await fetch(`${BASE}/${ruta}`, { headers: { Authorization: `Bearer ${await tokenDeAcceso()}` } });
    if (r.status === 404) return null;
    const data = await r.json();
    if (!r.ok) throw new Error(`Firestore leer ${ruta}: ${data?.error?.message || r.status}`);
    return deCampos(data.fields || {});
}

/** Escribe (crea o reemplaza) un documento. */
export async function escribirDoc(ruta, datos) {
    const r = await fetch(`${BASE}/${ruta}`, {
        method:  'PATCH',
        headers: { Authorization: `Bearer ${await tokenDeAcceso()}`, 'Content-Type': 'application/json' },
        body:    JSON.stringify({ fields: aCampos(datos) }),
    });
    const data = await r.json();
    if (!r.ok) throw new Error(`Firestore escribir ${ruta}: ${data?.error?.message || r.status}`);
    return deCampos(data.fields || {});
}
