// Serverless function — Vercel
// Proxy a la API de NVIDIA (build.nvidia.com, formato compatible con OpenAI).
// La clave NVIDIA_API_KEY vive SOLO aquí (variable de entorno de servidor).
// Restringido al administrador: la clave es de prueba (uso no productivo).
import { exigirAdmin } from './_auth.js';

// Se prueban en orden: si uno falla por cualquier motivo (retirado, saturado,
// error del servidor, tiempo agotado, respuesta vacía) se pasa al siguiente.
// NVIDIA_MODEL (opcional, variable de Vercel) va primero.
const MODELOS = [
    process.env.NVIDIA_MODEL,
    'google/gemma-4-31b-it',
    'nvidia/nemotron-3-super-120b-a12b',
    'nvidia/nemotron-3.5-lightning-30b-a3b',
    'openai/gpt-oss-20b',
    'google/gemma-3-12b-it',
    'nv-mistralai/mistral-nemo-12b-instruct',
    'deepseek-ai/deepseek-v4.1-flash',
].filter(Boolean);

const TIMEOUT_MODELO_MS = 40000;

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    if (!(await exigirAdmin(req, res))) return;

    const apiKey = process.env.NVIDIA_API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'NVIDIA_API_KEY not configured on server' });

    const { model, messages, temperature = 0.7, max_tokens = 2048, excluir = [] } = req.body || {};
    if (!Array.isArray(messages) || !messages.length) return res.status(400).json({ error: 'Missing messages' });

    const candidatos = [...new Set([model, ...MODELOS].filter(Boolean))].filter(m => !excluir.includes(m));
    const fallos = [];

    for (const modelo of candidatos) {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MODELO_MS);
        try {
            const upstream = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${apiKey}`,
                },
                body: JSON.stringify({ model: modelo, messages, temperature, max_tokens, stream: false }),
                signal: ctrl.signal,
            });
            const data = await upstream.json().catch(() => ({}));
            if (upstream.ok && data.choices?.[0]?.message?.content) {
                return res.status(200).json({ ...data, model: modelo, fallos });
            }
            const motivo = data.detail || data.error?.message || data.error || (upstream.ok ? 'respuesta vacía' : `HTTP ${upstream.status}`);
            fallos.push(`${modelo}: ${typeof motivo === 'string' ? motivo : JSON.stringify(motivo)}`);
        } catch (err) {
            fallos.push(`${modelo}: ${err.name === 'AbortError' ? 'tiempo agotado' : err.message}`);
        } finally {
            clearTimeout(timer);
        }
    }

    // 500 y no 502: Cloudflare sustituye el cuerpo de los 502 por su propia página
    return res.status(500).json({ error: `Fallaron todos los modelos de NVIDIA.\n${fallos.join('\n') || 'No quedan modelos por probar.'}` });
}
