// Serverless function — Vercel
//
// Puente con la Admin API de Cloudinary para el panel de administración del
// Visor 3D. CLOUDINARY_API_SECRET vive SOLO aquí: el navegador nunca la ve.
//
// Toda llamada exige el idToken de Firebase del usuario y comprueba contra
// Google que ese token es válido y que el email es el del administrador. Sin
// esa comprobación el endpoint quedaría abierto a cualquiera.
//
// Variables de entorno necesarias (Vercel → Settings → Environment Variables):
//     CLOUDINARY_API_KEY
//     CLOUDINARY_API_SECRET
//     VITE_CLOUDINARY_CLOUD     (el mismo cloud name que usa el cliente)
//
// La apiKey de Firebase se reutiliza de VITE_FIREBASE_API_KEY, que ya existe en
// el proyecto: en Vercel todas las variables llegan a las funciones por
// process.env, el prefijo VITE_ solo afecta al empaquetado del cliente.

import { createHash } from 'node:crypto';

const ADMIN_EMAIL = 'goladen@gmail.com';

/**
 * Firma de Cloudinary: parámetros ordenados alfabéticamente, unidos como
 * k=v&k=v, con el api_secret pegado al final, todo en SHA-1.
 */
function firmar(params, secret) {
    const cadena = Object.keys(params).sort().map(k => `${k}=${params[k]}`).join('&');
    return createHash('sha1').update(cadena + secret).digest('hex');
}

/** Valida el idToken contra Google y devuelve el email verificado. */
async function emailDelToken(idToken) {
    const key = process.env.VITE_FIREBASE_API_KEY || process.env.FIREBASE_WEB_API_KEY;
    if (!key) throw new Error('Falta VITE_FIREBASE_API_KEY en el servidor');

    const r = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${key}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
    });
    const data = await r.json();
    if (!r.ok || !data.users?.length) return null;
    return data.users[0].email || null;
}

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    // El cloud name se comparte con el cliente: una sola variable para los dos.
    const cloud  = process.env.VITE_CLOUDINARY_CLOUD || process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const secret = process.env.CLOUDINARY_API_SECRET;
    if (!cloud || !apiKey || !secret) {
        return res.status(500).json({ error: 'Cloudinary no está configurado en el servidor (VITE_CLOUDINARY_CLOUD / CLOUDINARY_API_KEY / CLOUDINARY_API_SECRET).' });
    }

    // ── autenticación ───────────────────────────────────────────────────────
    const idToken = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    if (!idToken) return res.status(401).json({ error: 'Falta el token de sesión.' });

    let email;
    try {
        email = await emailDelToken(idToken);
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
    if (!email) return res.status(401).json({ error: 'Sesión no válida.' });
    if (email !== ADMIN_EMAIL) return res.status(403).json({ error: 'Solo el administrador puede consultar los assets de Cloudinary.' });

    // ── llamada a Cloudinary ────────────────────────────────────────────────
    const { accion = 'listar', carpeta = 'modelos3d', cursor = null, publicId = null } = req.body || {};
    const auth = 'Basic ' + Buffer.from(`${apiKey}:${secret}`).toString('base64');
    const base = `https://api.cloudinary.com/v1_1/${cloud}`;

    try {
        if (accion === 'listar') {
            // Los .glb/.gltf se suben como resource_type "raw".
            const q = new URLSearchParams({ type: 'upload', prefix: carpeta, max_results: '100' });
            if (cursor) q.set('next_cursor', cursor);
            const r = await fetch(`${base}/resources/raw?${q}`, { headers: { Authorization: auth } });
            const data = await r.json();
            if (!r.ok) return res.status(r.status).json({ error: data?.error?.message || 'Error de Cloudinary' });

            const assets = (data.resources || [])
                .filter(a => /\.(glb|gltf)$/i.test(a.public_id) || /\.(glb|gltf)$/i.test(a.secure_url))
                .map(a => ({
                    publicId: a.public_id,
                    url: a.secure_url,
                    bytes: a.bytes,
                    formato: a.format || (a.public_id.match(/\.(glb|gltf)$/i)?.[1] || ''),
                    creado: a.created_at,
                }));
            return res.status(200).json({ assets, cursor: data.next_cursor || null });
        }

        if (accion === 'firmar') {
            // Subida firmada: el navegador manda el archivo DIRECTO a Cloudinary
            // con esta firma, así no pasa por la función (que tiene límite de
            // tamaño) y no hace falta un upload preset unsigned público.
            const timestamp = Math.round(Date.now() / 1000);
            const aFirmar = { folder: carpeta, timestamp };
            return res.status(200).json({
                cloud,
                apiKey,
                timestamp,
                folder: carpeta,
                signature: firmar(aFirmar, secret),
            });
        }

        if (accion === 'uso') {
            const r = await fetch(`${base}/usage`, { headers: { Authorization: auth } });
            const data = await r.json();
            if (!r.ok) return res.status(r.status).json({ error: data?.error?.message || 'Error de Cloudinary' });
            return res.status(200).json({
                creditos: data.credits || null,
                almacenamiento: data.storage || null,
                ancho_banda: data.bandwidth || null,
            });
        }

        if (accion === 'borrar') {
            if (!publicId) return res.status(400).json({ error: 'Falta publicId.' });
            const body = new URLSearchParams();
            body.append('public_ids[]', publicId);
            const r = await fetch(`${base}/resources/raw/upload`, {
                method: 'DELETE',
                headers: { Authorization: auth, 'Content-Type': 'application/x-www-form-urlencoded' },
                body,
            });
            const data = await r.json();
            if (!r.ok) return res.status(r.status).json({ error: data?.error?.message || 'Error de Cloudinary' });
            return res.status(200).json({ ok: true, borrado: data.deleted });
        }

        return res.status(400).json({ error: `Acción desconocida: ${accion}` });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
}
