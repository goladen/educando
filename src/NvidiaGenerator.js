// Generación de contenido con la API de NVIDIA (proxy api/nvidia.js, solo admin).
import { auth } from './firebase';
import { mensajesPasapalabra, extraerArrayJSON, validarRosco } from './nvidiaPasapalabra';

async function llamarNvidia(messages, opciones = {}) {
    const token = await auth.currentUser?.getIdToken();
    if (!token) throw new Error('Inicia sesión para usar la IA.');

    const r = await fetch('/api/nvidia', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ messages, ...opciones }),
    });
    if (!r.ok) {
        const crudo = await r.text();
        let data = {};
        try { data = JSON.parse(crudo); } catch { /* respuesta no JSON (Cloudflare/Vercel) */ }
        const motivo = data.error?.message || data.error || data.detail
            || crudo.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 300);
        const err = new Error(`${data.model ? `${data.model}: ` : `Error ${r.status}: `}${motivo}`);
        err.modelo = data.model;
        err.quedan = data.quedan ?? 0;
        throw err;
    }

    // Streaming SSE de OpenAI: "data: {choices:[{delta:{content}}]}" ... "data: [DONE]"
    const modelo = r.headers.get('X-Modelo');
    const quedan = Number(r.headers.get('X-Quedan') || 0);
    const reader = r.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let texto = '';
    let errorStream = null;
    for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lineas = buffer.split('\n');
        buffer = lineas.pop();
        for (const linea of lineas) {
            const l = linea.trim();
            if (!l.startsWith('data:')) continue;
            const payload = l.slice(5).trim();
            if (!payload || payload === '[DONE]') continue;
            try {
                const ev = JSON.parse(payload);
                if (ev.error) errorStream = typeof ev.error === 'string' ? ev.error : JSON.stringify(ev.error);
                texto += ev.choices?.[0]?.delta?.content || '';
            } catch { /* fragmento incompleto */ }
        }
    }

    if (!texto.trim() || (errorStream && !texto.includes(']'))) {
        const err = new Error(`${modelo}: ${errorStream || 'respuesta vacía'}`);
        err.modelo = modelo;
        err.quedan = quedan;
        throw err;
    }
    return { texto, modelo, quedan };
}

/**
 * Genera un rosco de Pasapalabra.
 * @returns {Promise<Array>} hojas en el formato del editor: [{ nombreHoja, preguntas: [{letra, pregunta, respuesta}] }]
 */
export async function generarPasapalabraNvidia({ tema, idioma, nivel, numPreguntas }) {
    const n = Math.min(25, Math.max(15, Number(numPreguntas) || 20));

    const mensajes = mensajesPasapalabra({ tema, idioma, nivel, n });
    const minimo = Math.ceil(n * 0.6); // por debajo de esto se considera un fallo del modelo
    const excluir = [];
    const errores = []; // motivos de los modelos descartados en el navegador
    let mejor = [];

    // Cada petición usa un modelo. Si falla (error, vacío, JSON roto o muy pocas
    // preguntas válidas) se excluye y se pide al siguiente de la lista del servidor.
    for (let intento = 0; intento < 12; intento++) {
        let respuesta;
        try {
            respuesta = await llamarNvidia(mensajes, { temperature: 0.6, max_tokens: 4096, excluir });
        } catch (e) {
            errores.push(e.message);
            if (!e.modelo || !e.quedan) break; // no quedan modelos por probar
            excluir.push(e.modelo);
            continue;
        }
        try {
            const preguntas = validarRosco(extraerArrayJSON(respuesta.texto));
            if (preguntas.length > mejor.length) mejor = preguntas;
            if (preguntas.length >= minimo) break;
            console.warn(`NVIDIA ${respuesta.modelo}: respuesta con pocas preguntas válidas:\n`, respuesta.texto);
            errores.push(`${respuesta.modelo}: solo ${preguntas.length} preguntas válidas de ${n}`);
        } catch (e) {
            errores.push(`${respuesta.modelo}: ${e.message}`);
        }
        if (!respuesta.modelo || !respuesta.quedan) break;
        excluir.push(respuesta.modelo);
    }

    if (!mejor.length) throw new Error(errores.join('\n') ||'La IA no generó preguntas válidas. Prueba de nuevo.');
    return [{ nombreHoja: tema.slice(0, 40), preguntas: mejor.slice(0, n) }];
}
