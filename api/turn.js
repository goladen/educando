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

    // A) Metered — credenciales efímeras.
    const meteredKey = process.env.METERED_API_KEY;
    const meteredSub = process.env.METERED_SUBDOMAIN;
    if (meteredKey && meteredSub) {
        try {
            const r = await fetch(`https://${meteredSub}.metered.live/api/v1/turn/credentials?apiKey=${meteredKey}`);
            const servers = await r.json();
            if (Array.isArray(servers) && servers.length) {
                return res.status(200).json({ iceServers: [stun, ...servers], turn: true });
            }
        } catch (e) { /* cae al siguiente */ }
    }

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
