// Serverless function — Vercel
// Proxy a la API de NVIDIA (build.nvidia.com, formato compatible con OpenAI).
// La clave NVIDIA_API_KEY vive SOLO aquí (variable de entorno de servidor).
// Restringido al administrador: la clave es de prueba (uso no productivo).
//
// Cada petición prueba UN solo modelo (el primero de la lista que no esté en
// `excluir`) y devuelve el texto en streaming (SSE de OpenAI tal cual), para no
// chocar con el límite de 100 s de Cloudflare (error 524). Si falla, responde
// 500 con { error, model, quedan } y el navegador pide el siguiente.
import { exigirAdmin } from './_auth.js';

// NVIDIA_MODEL (opcional, variable de Vercel) va primero.
// Orden según pruebas con scripts/probar-nvidia.mjs (2026-10-01, rosco de 20):
// Nemotron Super ~10 s, GPT-OSS ~30 s, Gemma 4 60-100 s, Nemotron Lightning ~80 s.
export const MODELOS = [
    process.env.NVIDIA_MODEL,
    'nvidia/nemotron-3-super-120b-a12b',
    'google/gemma-4-31b-it',
    'openai/gpt-oss-20b',
    'nvidia/nemotron-3.5-lightning-30b-a3b',
    'google/gemma-3-12b-it',
    'nv-mistralai/mistral-nemo-12b-instruct',
].filter(Boolean);

// Los modelos que 'razonan' escriben el razonamiento en el texto y se quedan sin
// tokens antes del JSON: se desactiva o se reduce al mínimo.
export function opcionesModelo(modelo) {
    if (modelo.startsWith('nvidia/nemotron')) return { chat_template_kwargs: { enable_thinking: false } };
    if (modelo.startsWith('openai/gpt-oss')) return { reasoning_effort: 'low' };
    return {};
}

const TIMEOUT_INICIO_MS = 60000;   // hasta que NVIDIA empieza a responder
const TIMEOUT_SILENCIO_MS = 30000; // sin recibir nada a mitad del streaming

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    if (!(await exigirAdmin(req, res))) return;

    const apiKey = process.env.NVIDIA_API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'NVIDIA_API_KEY not configured on server' });

    const { model, messages, temperature = 0.7, max_tokens = 2048, excluir = [] } = req.body || {};
    if (!Array.isArray(messages) || !messages.length) return res.status(400).json({ error: 'Missing messages' });

    const candidatos = [...new Set([model, ...MODELOS].filter(Boolean))].filter(m => !excluir.includes(m));
    const modelo = candidatos[0];
    if (!modelo) return res.status(500).json({ error: 'No quedan modelos por probar.', quedan: 0 });
    const quedan = candidatos.length - 1;
    const fallo = (motivo) => res.status(500).json({ error: motivo, model: modelo, quedan });

    const ctrl = new AbortController();
    let timer = setTimeout(() => ctrl.abort(), TIMEOUT_INICIO_MS);

    let upstream;
    try {
        upstream = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Accept: 'text/event-stream',
                Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({ model: modelo, messages, temperature, max_tokens, stream: true, ...opcionesModelo(modelo) }),
            signal: ctrl.signal,
        });
    } catch (err) {
        clearTimeout(timer);
        return fallo(err.name === 'AbortError' ? 'tiempo agotado esperando respuesta' : err.message);
    }

    if (!upstream.ok) {
        clearTimeout(timer);
        const data = await upstream.json().catch(() => ({}));
        const motivo = data.detail || data.error?.message || data.error || `HTTP ${upstream.status}`;
        return fallo(typeof motivo === 'string' ? motivo : JSON.stringify(motivo));
    }

    res.writeHead(200, {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        'X-Accel-Buffering': 'no',
        'X-Modelo': modelo,
        'X-Quedan': String(quedan),
    });

    try {
        const reader = upstream.body.getReader();
        for (;;) {
            clearTimeout(timer);
            timer = setTimeout(() => ctrl.abort(), TIMEOUT_SILENCIO_MS);
            const { done, value } = await reader.read();
            if (done) break;
            res.write(Buffer.from(value));
        }
    } catch (err) {
        res.write(`data: ${JSON.stringify({ error: err.name === 'AbortError' ? 'el modelo dejó de responder' : err.message })}\n\n`);
    } finally {
        clearTimeout(timer);
        res.end();
    }
}
