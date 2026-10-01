// Serverless function — Vercel
// Genera recursos de juego con IA (NVIDIA y, como último recurso, Gemini).
//
//   POST { accion: 'estado' }                      → { disponible, proximo, ilimitado }
//   POST { tipo, params, excluir: [] }             → streaming SSE (formato OpenAI)
//
// - Cualquier usuario con sesión; el prompt se construye AQUÍ a partir de los
//   parámetros (nadie puede usar la clave para otra cosa).
// - Límite: 1 generación correcta cada 7 días por usuario (ia_uso/{uid}),
//   guardado con la cuenta de servicio. El administrador no tiene límite.
// - Cada petición prueba UN modelo y responde en streaming para no chocar con
//   el límite de 100 s de Cloudflare (524). Si falla: 500 { error, model, quedan }
//   y el navegador pide el siguiente con `excluir`.
import { usuarioDelToken, ADMIN_EMAIL } from './_auth.js';
import { leerDoc, escribirDoc } from './_google.js';
import { MODELOS, opcionesModelo } from './_ia-modelos.js';
import { JUEGOS_IA, mensajesRecurso, interpretarRespuesta, minimoValidas, normalizarParams } from '../src/iaRecursos.js';

const SEMANA_MS = 7 * 24 * 60 * 60 * 1000;
const TIMEOUT_INICIO_MS = 60000;   // hasta que el modelo empieza a responder
const TIMEOUT_SILENCIO_MS = 30000; // sin recibir nada a mitad del streaming
const TIMEOUT_GEMINI_MS = 80000;   // Gemini sin streaming: por debajo de los 100 s de Cloudflare

async function estadoUso(uid, esAdmin) {
    if (esAdmin) return { disponible: true, proximo: null, ilimitado: true };
    const doc = await leerDoc(`ia_uso/${uid}`);
    const ultimo = doc?.ultimo ? new Date(doc.ultimo).getTime() : 0;
    const proximo = ultimo + SEMANA_MS;
    return proximo > Date.now()
        ? { disponible: false, proximo: new Date(proximo).toISOString(), ilimitado: false }
        : { disponible: true, proximo: null, ilimitado: false };
}

// --- Gemini (sin streaming): se emite como un único evento SSE ---------------
async function llamarGemini(modelo, messages, maxTokens) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('GEMINI_API_KEY no configurada');
    const system = messages.find(m => m.role === 'system')?.content;
    const user = messages.filter(m => m.role !== 'system').map(m => m.content).join('\n\n');
    const generationConfig = { temperature: 0.6, maxOutputTokens: maxTokens };
    if (modelo.includes('2.5')) generationConfig.thinkingConfig = { thinkingBudget: 0 };

    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            systemInstruction: system ? { parts: [{ text: system }] } : undefined,
            contents: [{ role: 'user', parts: [{ text: user }] }],
            generationConfig,
        }),
        signal: AbortSignal.timeout(TIMEOUT_GEMINI_MS),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data.error?.message || `HTTP ${r.status}`);
    const texto = (data.candidates?.[0]?.content?.parts || []).map(p => p.text || '').join('');
    if (!texto) throw new Error('respuesta vacía');
    return texto;
}

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const idToken = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    let usuario;
    try { usuario = idToken ? await usuarioDelToken(idToken) : null; }
    catch (e) { return res.status(500).json({ error: e.message }); }
    if (!usuario?.uid) return res.status(401).json({ error: 'Inicia sesión para usar la IA.' });
    const esAdmin = usuario.email === ADMIN_EMAIL;

    const { accion, tipo, params, excluir = [] } = req.body || {};

    let estado;
    try { estado = await estadoUso(usuario.uid, esAdmin); }
    catch (e) { return res.status(500).json({ error: `No se pudo comprobar el límite de uso: ${e.message}` }); }

    if (accion === 'estado') return res.status(200).json(estado);

    if (!JUEGOS_IA[tipo]) return res.status(400).json({ error: 'Juego no soportado por la IA.' });
    if (!estado.disponible) {
        return res.status(429).json({ error: 'Ya has usado la generación automática esta semana.', limite: true, proximo: estado.proximo });
    }

    let p, messages;
    try {
        p = normalizarParams(tipo, params);
        if (!p.tema && !p.texto) return res.status(400).json({ error: 'Indica una temática o un texto de referencia.' });
        messages = mensajesRecurso(tipo, p);
    } catch (e) {
        return res.status(400).json({ error: e.message });
    }

    const candidatos = MODELOS.filter(m => !excluir.includes(m));
    const modelo = candidatos[0];
    if (!modelo) return res.status(500).json({ error: 'No quedan modelos por probar.', quedan: 0 });
    const quedan = candidatos.length - 1;
    const fallo = (motivo) => res.status(500).json({ error: motivo, model: modelo, quedan });
    const maxTokens = p.texto ? 6144 : 4096;

    // Al terminar: si la respuesta es válida, se gasta el uso semanal
    const registrarUso = async (texto) => {
        if (esAdmin) return;
        try {
            const { validas } = interpretarRespuesta(tipo, texto, p);
            if (validas < minimoValidas(p.n)) return;
            await escribirDoc(`ia_uso/${usuario.uid}`, {
                ultimo: new Date(), email: usuario.email || '', tipo, modelo, tema: p.tema,
            });
        } catch (e) {
            console.error('ia-recurso: no se pudo registrar el uso', e.message);
        }
    };

    const cabecerasStream = {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        'X-Accel-Buffering': 'no',
        'X-Modelo': modelo,
        'X-Quedan': String(quedan),
    };

    // --- Gemini ---
    if (modelo.startsWith('gemini:')) {
        let texto;
        try { texto = await llamarGemini(modelo.slice(7), messages, maxTokens); }
        catch (e) { return fallo(e.name === 'TimeoutError' ? 'tiempo agotado' : e.message); }
        await registrarUso(texto);
        res.writeHead(200, cabecerasStream);
        res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: texto } }] })}\n\n`);
        res.write('data: [DONE]\n\n');
        return res.end();
    }

    // --- NVIDIA (streaming) ---
    const apiKey = process.env.NVIDIA_API_KEY;
    if (!apiKey) return fallo('NVIDIA_API_KEY no configurada');

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
            body: JSON.stringify({
                model: modelo, messages, temperature: 0.6, max_tokens: maxTokens, stream: true,
                ...opcionesModelo(modelo),
            }),
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

    res.writeHead(200, cabecerasStream);

    // Se reenvía el streaming tal cual y a la vez se acumula el texto para validar
    let texto = '';
    let buffer = '';
    const decoder = new TextDecoder();
    try {
        const reader = upstream.body.getReader();
        for (;;) {
            clearTimeout(timer);
            timer = setTimeout(() => ctrl.abort(), TIMEOUT_SILENCIO_MS);
            const { done, value } = await reader.read();
            if (done) break;
            res.write(Buffer.from(value));
            buffer += decoder.decode(value, { stream: true });
            const lineas = buffer.split('\n');
            buffer = lineas.pop();
            for (const l of lineas) {
                const payload = l.trim().replace(/^data:\s*/, '');
                if (!l.trim().startsWith('data:') || payload === '[DONE]') continue;
                try { texto += JSON.parse(payload).choices?.[0]?.delta?.content || ''; } catch { /* fragmento */ }
            }
        }
        clearTimeout(timer);
        await registrarUso(texto);
    } catch (err) {
        res.write(`data: ${JSON.stringify({ error: err.name === 'AbortError' ? 'el modelo dejó de responder' : err.message })}\n\n`);
    } finally {
        clearTimeout(timer);
        res.end();
    }
}
