// Vercel serverless — Instagram API con Instagram Login (graph.instagram.com)
//
//   GET /api/instagram                → devuelve el feed cacheado (público)
//   GET /api/instagram?action=sync    → refresca token + descarga media + guarda en Firestore
//                                       (protegido con CRON_SECRET; lo llama el cron diario)
//
// Variables de entorno necesarias en Vercel:
//   IG_TOKEN                     token de larga duración inicial (solo para el primer arranque)
//   CRON_SECRET                  cualquier cadena larga; Vercel la envía en el cron
//   GOOGLE_SERVICE_ACCOUNT_JSON  cuenta de servicio de Firebase (JSON o base64)
//
// Ver INSTAGRAM.md para el paso a paso de Meta.
import { leerDoc, escribirDoc } from './_google.js';

const DOC_TOKEN = 'sitio_publico/instagram_token';
const DOC_FEED  = 'sitio_publico/instagram_feed';
const DIAS      = 24 * 60 * 60 * 1000;

const shortcodeDe = (permalink = '') => (permalink.match(/\/(?:reel|reels|p|tv)\/([^/?#]+)/) || [])[1] || null;

/** Token vigente: lo lee de Firestore, cae al de entorno la primera vez y lo renueva si toca. */
async function tokenVigente() {
    let guardado = null;
    try { guardado = await leerDoc(DOC_TOKEN); } catch { /* primera vez o sin permisos */ }

    let token    = guardado?.token || process.env.IG_TOKEN;
    let obtenido = guardado?.token ? Date.parse(guardado.obtenido || 0) : 0;
    if (!token) throw new Error('No hay token de Instagram: configura IG_TOKEN en Vercel');

    // Los tokens de larga duración duran 60 días y se renuevan pasadas 24 h de vida.
    // Renovamos a los 20 días para tener margen de sobra.
    const toca = !guardado?.token || (Date.now() - obtenido) > 20 * DIAS;
    if (!toca) return { token, renovado: false };

    const r = await fetch(`https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=${encodeURIComponent(token)}`);
    const data = await r.json();
    if (!r.ok || !data.access_token) {
        // Si la renovación falla seguimos con el token actual: puede que aún sea válido.
        if (guardado?.token) return { token, renovado: false, avisoRenovacion: data?.error?.message || `HTTP ${r.status}` };
        throw new Error(`No se pudo renovar el token: ${data?.error?.message || r.status}`);
    }

    const caduca = new Date(Date.now() + (data.expires_in || 60 * 24 * 3600) * 1000).toISOString();
    await escribirDoc(DOC_TOKEN, { token: data.access_token, obtenido: new Date().toISOString(), caduca });
    return { token: data.access_token, renovado: true, caduca };
}

/** Descarga las publicaciones y las guarda normalizadas en Firestore. */
async function sincronizar() {
    const { token, renovado, caduca, avisoRenovacion } = await tokenVigente();

    const campos = 'id,caption,media_type,permalink,thumbnail_url,media_url,timestamp,username';
    const r = await fetch(`https://graph.instagram.com/me/media?fields=${campos}&limit=50&access_token=${encodeURIComponent(token)}`);
    const data = await r.json();
    if (!r.ok) throw new Error(`Instagram: ${data?.error?.message || r.status}`);

    const items = (data.data || []).map(m => ({
        id:         m.id,
        tipo:       m.media_type,                                   // IMAGE | VIDEO | CAROUSEL_ALBUM
        // En los vídeos la miniatura va en thumbnail_url; en las fotos, en media_url.
        miniatura:  m.thumbnail_url || (m.media_type === 'VIDEO' ? '' : m.media_url) || '',
        permalink:  m.permalink || '',
        shortcode:  shortcodeDe(m.permalink),
        texto:      (m.caption || '').slice(0, 400),
        fecha:      m.timestamp || '',
    })).filter(i => i.shortcode);

    const cuenta = data.data?.[0]?.username || 'pikt314';
    await escribirDoc(DOC_FEED, { cuenta, actualizado: new Date().toISOString(), items });

    return { ok: true, guardados: items.length, videos: items.filter(i => i.tipo === 'VIDEO').length, tokenRenovado: renovado, caduca, avisoRenovacion };
}

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'GET')     return res.status(405).json({ error: 'Method not allowed' });

    const secreto   = process.env.CRON_SECRET;
    const cabecera  = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    const autorizado = !!secreto && (cabecera === secreto || req.query?.key === secreto);
    const quiereSync = req.query?.action === 'sync' || autorizado;

    try {
        if (quiereSync) {
            if (!autorizado) return res.status(401).json({ error: 'No autorizado' });
            return res.status(200).json(await sincronizar());
        }
        // Lectura pública del feed cacheado (la web lo lee directo de Firestore;
        // esto queda para comprobar el estado desde el navegador).
        const feed = await leerDoc(DOC_FEED);
        res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=86400');
        return res.status(200).json(feed || { cuenta: null, items: [], actualizado: null });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
}
