// Vercel serverless function — Proxy para Recortes Extrem.
// Descarga una imagen/PDF de otra web (evita el bloqueo CORS del navegador).
// Si la URL es una página HTML, devuelve en JSON las imágenes y PDFs que contiene
// para que el usuario elija cuál recortar.
import dns from 'node:dns/promises';
import net from 'node:net';

const MAX_BYTES = 4 * 1024 * 1024;   // límite de respuesta de Vercel ≈ 4,5 MB
const MAX_REDIRECTS = 5;

// Evita SSRF: no permitimos IPs privadas / locales
function ipPrivada(ip) {
    if (net.isIPv4(ip)) {
        const [a, b] = ip.split('.').map(Number);
        return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) ||
               (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) ||
               (a === 100 && b >= 64 && b <= 127) || a >= 224;
    }
    const v = ip.toLowerCase();
    if (v.startsWith('::ffff:')) return ipPrivada(v.slice(7));
    return v === '::1' || v === '::' || v.startsWith('fc') || v.startsWith('fd') || v.startsWith('fe80');
}

async function validarUrl(raw) {
    let u;
    try { u = new URL(raw); } catch { throw new Error('URL no válida'); }
    if (!/^https?:$/.test(u.protocol)) throw new Error('Solo se admiten URLs http(s)');
    const { address } = await dns.lookup(u.hostname);
    if (ipPrivada(address)) throw new Error('Dirección no permitida');
    return u;
}

async function fetchSeguro(raw) {
    let url = raw;
    for (let i = 0; i <= MAX_REDIRECTS; i++) {
        const u = await validarUrl(url);
        const r = await fetch(u, {
            redirect: 'manual',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36',
                'Accept': 'image/*,application/pdf,text/html;q=0.9,*/*;q=0.5',
            },
        });
        if (r.status >= 300 && r.status < 400 && r.headers.get('location')) {
            url = new URL(r.headers.get('location'), u).href;
            continue;
        }
        return { r, finalUrl: u.href };
    }
    throw new Error('Demasiadas redirecciones');
}

async function leerLimitado(r) {
    const len = Number(r.headers.get('content-length') || 0);
    if (len > MAX_BYTES) throw new Error('El archivo es demasiado grande (máx. 4 MB). Descárgalo y súbelo desde el ordenador.');
    const reader = r.body.getReader();
    const chunks = []; let total = 0;
    for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        total += value.length;
        if (total > MAX_BYTES) { reader.cancel(); throw new Error('El archivo es demasiado grande (máx. 4 MB). Descárgalo y súbelo desde el ordenador.'); }
        chunks.push(value);
    }
    return Buffer.concat(chunks.map(c => Buffer.from(c)));
}

// Extrae imágenes y PDFs de una página HTML
function extraerRecursos(html, base) {
    const abs = (s) => { try { return new URL(s.replace(/&amp;/g, '&').trim(), base).href; } catch { return null; } };
    const imgs = new Set(), pdfs = new Set();
    const meta = /<meta[^>]+(?:property|name)=["'](?:og:image|twitter:image)(?::src)?["'][^>]*>/gi;
    for (const m of html.matchAll(meta)) {
        const c = m[0].match(/content=["']([^"']+)["']/i);
        if (c) { const a = abs(c[1]); if (a) imgs.add(a); }
    }
    for (const m of html.matchAll(/<img\b[^>]*>/gi)) {
        const tag = m[0];
        const src = tag.match(/\s(?:data-src|data-original|src)=["']([^"']+)["']/i)?.[1];
        if (src && !src.startsWith('data:')) { const a = abs(src); if (a) imgs.add(a); }
        const srcset = tag.match(/\ssrcset=["']([^"']+)["']/i)?.[1];
        if (srcset) {
            const ultima = srcset.split(',').map(s => s.trim().split(/\s+/)[0]).filter(Boolean).pop();
            const a = ultima && abs(ultima); if (a) imgs.add(a);
        }
    }
    for (const m of html.matchAll(/href=["']([^"']+\.pdf(?:[?#][^"']*)?)["']/gi)) {
        const a = abs(m[1]); if (a) pdfs.add(a);
    }
    const filtrar = [...imgs].filter(u => /^https?:/.test(u) && !/\.svg(\?|#|$)/i.test(u) && !/(pixel|spacer|blank|tracking)\.(gif|png)/i.test(u));
    return { imagenes: filtrar.slice(0, 60), pdfs: [...pdfs].filter(u => /^https?:/.test(u)).slice(0, 30) };
}

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

    const url = req.query?.url;
    if (!url) return res.status(400).json({ error: 'Falta el parámetro url' });

    try {
        const { r, finalUrl } = await fetchSeguro(url);
        if (!r.ok) return res.status(502).json({ error: `La web respondió con error ${r.status}` });
        const tipo = (r.headers.get('content-type') || '').toLowerCase();

        if (tipo.startsWith('image/') || tipo.includes('application/pdf') ||
            (tipo.includes('octet-stream') && /\.(pdf|png|jpe?g|gif|webp|bmp)(\?|#|$)/i.test(finalUrl))) {
            const buf = await leerLimitado(r);
            res.setHeader('Content-Type', tipo || 'application/octet-stream');
            res.setHeader('Cache-Control', 'public, max-age=3600');
            return res.status(200).send(buf);
        }

        if (tipo.includes('text/html') || tipo.includes('xhtml')) {
            const html = (await leerLimitado(r)).toString('utf8');
            return res.status(200).json({ tipo: 'html', url: finalUrl, ...extraerRecursos(html, finalUrl) });
        }

        return res.status(415).json({ error: `Tipo de contenido no soportado (${tipo || 'desconocido'})` });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
}
