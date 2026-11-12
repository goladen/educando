// Comprueba que un enlace del Banco de recursos se abre SIN iniciar sesión
// (como lo vería otro profesor). POST { url } con Authorization: Bearer <idToken>.
//
// Respuesta: { estado, status, urlFinal, titulo, servicio, mensaje }
//   estado: 'ok' | 'privado' | 'roto' | 'dudoso'
//   servicio: 'drive' | 'docs' | 'onedrive' | 'youtube' | null
//
// Protección SSRF: solo http/https, puertos estándar, y cada salto de redirección
// se resuelve por DNS y se rechaza si apunta a una IP privada/local.
import dns from 'node:dns/promises';
import net from 'node:net';
import { usuarioDelToken } from './_auth.js';

const MAX_SALTOS = 6;
const TIMEOUT_MS = 9000;
const MAX_BYTES = 256 * 1024;
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36 PiktLinkChecker';

function ipPrivada(ip) {
    if (net.isIPv4(ip)) {
        const [a, b] = ip.split('.').map(Number);
        return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254)
            || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168)
            || (a === 100 && b >= 64 && b <= 127) || a >= 224;
    }
    const x = ip.toLowerCase();
    if (x.startsWith('::ffff:')) return ipPrivada(x.slice(7));
    return x === '::1' || x === '::' || x.startsWith('fc') || x.startsWith('fd') || x.startsWith('fe80');
}

async function urlSegura(u) {
    let url;
    try { url = new URL(u); } catch { return null; }
    if (!['http:', 'https:'].includes(url.protocol)) return null;
    if (url.port && !['80', '443'].includes(url.port)) return null;
    if (url.username || url.password) return null;
    const host = url.hostname.replace(/^\[|\]$/g, '');
    if (!host || host === 'localhost' || host.endsWith('.local') || host.endsWith('.internal')) return null;
    try {
        const ips = net.isIP(host) ? [{ address: host }] : await dns.lookup(host, { all: true });
        if (!ips.length || ips.some(i => ipPrivada(i.address))) return null;
    } catch { return 'dns'; }
    return url;
}

function servicioDe(host) {
    if (/(^|\.)drive\.google\.com$/.test(host)) return 'drive';
    if (/(^|\.)docs\.google\.com$/.test(host)) return 'docs';
    if (/(^|\.)(onedrive\.live\.com|1drv\.ms|sharepoint\.com)$/.test(host)) return 'onedrive';
    if (/(^|\.)(youtube\.com|youtu\.be)$/.test(host)) return 'youtube';
    return null;
}

const esLogin = (u) => {
    try {
        const h = new URL(u).hostname;
        return h === 'accounts.google.com' || h === 'login.microsoftonline.com' || h === 'login.live.com';
    } catch { return false; }
};

async function leerTitulo(resp) {
    const tipo = resp.headers.get('content-type') || '';
    if (!tipo.includes('html') || !resp.body) { try { await resp.body?.cancel(); } catch { /* */ } return null; }
    const reader = resp.body.getReader();
    let total = 0, texto = '';
    const dec = new TextDecoder();
    try {
        while (total < MAX_BYTES) {
            const { done, value } = await reader.read();
            if (done) break;
            total += value.length;
            texto += dec.decode(value, { stream: true });
            if (/<\/title>/i.test(texto)) break;
        }
    } catch { /* */ }
    try { await reader.cancel(); } catch { /* */ }
    const m = texto.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    if (!m) return null;
    return m[1].replace(/\s+/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
        .replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim().slice(0, 150) || null;
}

async function comprobarYoutube(url) {
    const r = await fetch(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(url)}`,
        { signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (r.ok) {
        const d = await r.json().catch(() => ({}));
        return { estado: 'ok', status: 200, urlFinal: url, titulo: d.title || null, servicio: 'youtube', mensaje: 'Vídeo público o no listado: se puede ver.' };
    }
    if (r.status === 401 || r.status === 403)
        return { estado: 'privado', status: r.status, urlFinal: url, servicio: 'youtube', mensaje: 'El vídeo es privado o no permite insertarse. Ponlo como «Público» o «No listado» en YouTube Studio.' };
    if (r.status === 404 || r.status === 400)
        return { estado: 'roto', status: r.status, urlFinal: url, servicio: 'youtube', mensaje: 'No existe ningún vídeo con ese enlace (puede haberse borrado).' };
    return null; // otro caso: comprobación genérica
}

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Usa POST.' });

    const idToken = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    if (!idToken) return res.status(401).json({ error: 'Inicia sesión para comprobar enlaces.' });
    try {
        if (!(await usuarioDelToken(idToken))) return res.status(401).json({ error: 'Sesión no válida.' });
    } catch (e) { return res.status(500).json({ error: e.message }); }

    let body = req.body;
    if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
    const original = String(body?.url || '').trim();
    if (!original || original.length > 2000) return res.status(400).json({ error: 'Falta el enlace.' });

    let actual = original;
    const primera = await urlSegura(actual);
    if (!primera) return res.status(200).json({ estado: 'roto', status: 0, urlFinal: original, servicio: null, mensaje: 'El enlace no es una dirección web pública válida (debe empezar por https://).' });
    if (primera === 'dns') return res.status(200).json({ estado: 'roto', status: 0, urlFinal: original, servicio: null, mensaje: 'El dominio no existe. Revisa que el enlace esté bien copiado.' });
    const servicio = servicioDe(primera.hostname);

    try {
        if (servicio === 'youtube') {
            const yt = await comprobarYoutube(original);
            if (yt) return res.status(200).json(yt);
        }

        let resp = null;
        for (let salto = 0; salto <= MAX_SALTOS; salto++) {
            const seguro = await urlSegura(actual);
            if (!seguro || seguro === 'dns')
                return res.status(200).json({ estado: 'roto', status: 0, urlFinal: actual, servicio, mensaje: 'El enlace redirige a una dirección que no se puede abrir.' });
            resp = await fetch(seguro.href, {
                method: 'GET', redirect: 'manual', signal: AbortSignal.timeout(TIMEOUT_MS),
                headers: { 'User-Agent': UA, 'Accept': 'text/html,application/xhtml+xml,*/*;q=0.8', 'Accept-Language': 'es-ES,es;q=0.9' },
            });
            const loc = resp.headers.get('location');
            if (resp.status >= 300 && resp.status < 400 && loc) {
                try { await resp.body?.cancel(); } catch { /* */ }
                actual = new URL(loc, seguro.href).href;
                if (esLogin(actual)) {
                    return res.status(200).json({
                        estado: 'privado', status: resp.status, urlFinal: actual, servicio,
                        mensaje: servicio === 'onedrive'
                            ? 'El archivo pide iniciar sesión: compártelo como «Cualquier persona con el vínculo».'
                            : 'El archivo es privado: pide iniciar sesión. Cambia el acceso a «Cualquier persona con el enlace».',
                    });
                }
                continue;
            }
            break;
        }

        const st = resp.status;
        if (st >= 300 && st < 400)
            return res.status(200).json({ estado: 'dudoso', status: st, urlFinal: actual, servicio, mensaje: 'El enlace redirige demasiadas veces. Ábrelo para comprobarlo tú.' });

        if (st >= 200 && st < 300) {
            const titulo = await leerTitulo(resp);
            // Drive a veces responde 200 con la página de «Solicitar acceso»
            if ((servicio === 'drive' || servicio === 'docs') && titulo && /iniciar sesi|sign.?in|solicitar acceso|request access|acceso denegado|access denied/i.test(titulo))
                return res.status(200).json({ estado: 'privado', status: st, urlFinal: actual, servicio, mensaje: 'El archivo no es público: pide permiso para abrirlo.' });
            const limpio = titulo && servicio ? titulo.replace(/\s*[-–]\s*(Google (Drive|Docs|Sheets|Slides|Forms)|Documentos de Google|Hojas de cálculo de Google|Presentaciones de Google|Formularios de Google)\s*$/i, '') : titulo;
            return res.status(200).json({ estado: 'ok', status: st, urlFinal: actual, titulo: limpio || null, servicio, mensaje: 'El enlace funciona y se abre sin iniciar sesión.' });
        }
        try { await resp.body?.cancel(); } catch { /* */ }

        if (st === 401 || st === 403) {
            if (servicio) return res.status(200).json({ estado: 'privado', status: st, urlFinal: actual, servicio, mensaje: 'Acceso denegado: el archivo no está compartido públicamente.' });
            // Muchas webs bloquean a los robots aunque funcionen en el navegador
            return res.status(200).json({ estado: 'dudoso', status: st, urlFinal: actual, servicio, mensaje: 'La web no deja comprobarla automáticamente (puede bloquear robots). Ábrela para confirmar que funciona.' });
        }
        // Drive/Docs responden 404 o 5xx cuando el ID no existe
        if (st === 404 || st === 410 || ((servicio === 'drive' || servicio === 'docs') && st >= 500))
            return res.status(200).json({ estado: 'roto', status: st, urlFinal: actual, servicio, mensaje: 'La página no existe (error ' + st + '). Puede que se haya borrado o que el enlace esté mal copiado.' });
        return res.status(200).json({ estado: 'dudoso', status: st, urlFinal: actual, servicio, mensaje: `La web respondió con el código ${st}. Ábrela para comprobar que funciona.` });
    } catch (e) {
        const timeout = e?.name === 'TimeoutError' || e?.name === 'AbortError';
        return res.status(200).json({
            estado: timeout ? 'dudoso' : 'roto', status: 0, urlFinal: actual, servicio,
            mensaje: timeout ? 'La web tarda demasiado en responder. Ábrela para comprobar que funciona.' : 'No se ha podido conectar con esa web.',
        });
    }
}
