// Serverless function — Vercel
// Devuelve los servidores ICE (STUN + TURN) para el vídeo en vivo del Agente de Aula.
// Las credenciales TURN viven SOLO aquí (variables de entorno). El cliente nunca las ve
// "a pelo": con Metered son efímeras (caducan), que es lo recomendable.
//
// Config (Vercel → Environment Variables), por orden de preferencia:
//   A) Metered (credenciales efímeras):  METERED_API_KEY  +  METERED_SUBDOMAIN  (p.ej. "pikt")
//   B) TURN estático:  TURN_URLS (coma-separado)  +  TURN_USERNAME  +  TURN_CREDENTIAL
//   C) Nada → solo STUN (el vídeo funcionará en redes sencillas, no tras NAT estricta).

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();

    const stun = { urls: 'stun:stun.l.google.com:19302' };
    const debug = 'debug' in (req.query || {});
    const diag = { hasKey: false, hasSub: false, sub: null, upstreamStatus: null, upstreamOk: null, count: null, error: null };

    // A) Metered — credenciales efímeras.
    const meteredKey = process.env.METERED_API_KEY;
    const meteredSub = process.env.METERED_SUBDOMAIN;
    diag.hasKey = !!meteredKey;
    diag.hasSub = !!meteredSub;
    diag.sub = meteredSub || null;
    if (meteredKey && meteredSub) {
        try {
            const r = await fetch(`https://${meteredSub}.metered.live/api/v1/turn/credentials?apiKey=${meteredKey}`);
            diag.upstreamStatus = r.status;
            diag.upstreamOk = r.ok;
            diag.keyLen = (meteredKey || '').length;         // longitud (no el valor) para detectar recortes/espacios
            const text = await r.text();
            if (!r.ok) diag.upstreamBody = text.slice(0, 300); // mensaje de error de Metered
            let servers = null;
            try { servers = JSON.parse(text); } catch { /* no JSON */ }
            diag.count = Array.isArray(servers) ? servers.length : -1;
            if (Array.isArray(servers) && servers.length) {
                return res.status(200).json({ iceServers: [stun, ...servers], turn: true, ...(debug ? { diag } : {}) });
            }
        } catch (e) { diag.error = String(e && e.message || e); }
    }

    if (debug) return res.status(200).json({ iceServers: [stun], turn: false, diag });

    // B) TURN estático por variables de entorno.
    const urls = process.env.TURN_URLS;
    if (urls) {
        return res.status(200).json({
            iceServers: [stun, {
                urls: urls.split(',').map((s) => s.trim()).filter(Boolean),
                username: process.env.TURN_USERNAME || '',
                credential: process.env.TURN_CREDENTIAL || '',
            }],
            turn: true,
        });
    }

    // C) Solo STUN.
    return res.status(200).json({ iceServers: [stun], turn: false });
}
