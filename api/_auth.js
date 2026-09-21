// Autenticación compartida por las funciones de administración.
// El prefijo "_" hace que Vercel no lo publique como endpoint.

export const ADMIN_EMAIL = 'goladen@gmail.com';

/** Valida el idToken de Firebase contra Google y devuelve el email verificado. */
export async function emailDelToken(idToken) {
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

/**
 * Comprueba la cabecera Authorization y que sea el administrador.
 * Devuelve null si todo va bien; si no, ya ha respondido con el error.
 */
export async function exigirAdmin(req, res) {
    const idToken = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    if (!idToken) { res.status(401).json({ error: 'Falta el token de sesión.' }); return false; }

    let email;
    try {
        email = await emailDelToken(idToken);
    } catch (e) {
        res.status(500).json({ error: e.message });
        return false;
    }
    if (!email) { res.status(401).json({ error: 'Sesión no válida.' }); return false; }
    if (email !== ADMIN_EMAIL) {
        res.status(403).json({ error: 'Solo el administrador puede usar esta función.' });
        return false;
    }
    return true;
}

/** Credenciales de Cloudinary desde el entorno del servidor. */
export function credencialesCloudinary() {
    const cloud  = process.env.VITE_CLOUDINARY_CLOUD || process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const secret = process.env.CLOUDINARY_API_SECRET;
    if (!cloud || !apiKey || !secret) return null;
    return { cloud, apiKey, secret };
}
