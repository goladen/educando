// Serverless function — Vercel
// Proxy a la API de NVIDIA (build.nvidia.com, formato compatible con OpenAI).
// La clave NVIDIA_API_KEY vive SOLO aquí (variable de entorno de servidor).
// Restringido al administrador: la clave es de prueba (uso no productivo).
import { exigirAdmin } from './_auth.js';

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    if (!(await exigirAdmin(req, res))) return;

    const apiKey = process.env.NVIDIA_API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'NVIDIA_API_KEY not configured on server' });

    const {
        model = 'meta/llama-3.3-70b-instruct',
        messages,
        temperature = 0.7,
        max_tokens = 2048,
    } = req.body || {};
    if (!Array.isArray(messages) || !messages.length) return res.status(400).json({ error: 'Missing messages' });

    try {
        const upstream = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({ model, messages, temperature, max_tokens, stream: false }),
        });

        const data = await upstream.json();
        return res.status(upstream.status).json(data);
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
}
