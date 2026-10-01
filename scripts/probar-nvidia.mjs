// Prueba local de la generación de recursos con IA (NVIDIA), sin desplegar.
// Llama directamente a NVIDIA con el mismo prompt, modelos y validación que la web.
//
//   node scripts/probar-nvidia.mjs                       → prueba todos los modelos NVIDIA
//   node scripts/probar-nvidia.mjs google/gemma-4-31b-it → solo ese modelo (muestra el resultado)
//   (PowerShell) $env:JUEGO="THINKHOOT"; $env:TEMA="El cuerpo humano"; $env:N=10; node scripts/probar-nvidia.mjs
//
// Variables: JUEGO (PASAPALABRA|CAZABURBUJAS|THINKHOOT|RULETA|APAREJADOS), TEMA, IDIOMA,
// NIVEL, N, TEXTO_FICHERO (ruta a un .txt de referencia).
// La clave se lee de la variable NVIDIA_API_KEY o de .env.local (NVIDIA_API_KEY=...).
import { readFileSync } from 'node:fs';
import { MODELOS, opcionesModelo } from '../api/_ia-modelos.js';
import { mensajesRecurso, interpretarRespuesta, minimoValidas, normalizarParams } from '../src/iaRecursos.js';

let apiKey = process.env.NVIDIA_API_KEY;
if (!apiKey) {
    try {
        apiKey = readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
            .match(/^NVIDIA_API_KEY\s*=\s*"?([^"\r\n]+)"?/m)?.[1]?.trim();
    } catch { /* sin .env.local */ }
}
if (!apiKey) {
    console.error('Falta NVIDIA_API_KEY: añádela a .env.local (NVIDIA_API_KEY=nvapi-...) o como variable de entorno.');
    process.exit(1);
}

const tipo = process.env.JUEGO || 'PASAPALABRA';
const params = normalizarParams(tipo, {
    tema: process.env.TEMA || 'El sistema solar',
    idioma: process.env.IDIOMA || 'Español',
    nivel: process.env.NIVEL || '10-12 años (5º-6º Primaria)',
    n: process.env.N,
    texto: process.env.TEXTO_FICHERO ? readFileSync(process.env.TEXTO_FICHERO, 'utf8') : '',
});
const modelos = process.argv[2] ? [process.argv[2]] : MODELOS.filter(m => !m.startsWith('gemini:'));
const mensajes = mensajesRecurso(tipo, params);

console.log(`${tipo} · ${params.tema} · ${params.idioma} · ${params.nivel} · ${params.n}${params.texto ? ` · texto ${params.texto.length} car.` : ''}\n`);

for (const modelo of modelos) {
    const t0 = Date.now();
    const seg = () => ((Date.now() - t0) / 1000).toFixed(1) + ' s';
    process.stdout.write(`▶ ${modelo} … `);
    try {
        const r = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream', Authorization: `Bearer ${apiKey}` },
            body: JSON.stringify({ model: modelo, messages: mensajes, temperature: 0.6, max_tokens: 4096, stream: true, ...opcionesModelo(modelo) }),
            signal: AbortSignal.timeout(180000),
        });
        if (!r.ok) {
            const data = await r.json().catch(() => ({}));
            console.log(`❌ HTTP ${r.status} (${seg()}): ${data.detail || data.error?.message || JSON.stringify(data).slice(0, 200)}`);
            continue;
        }
        let primerToken = null;
        let texto = '';
        let buffer = '';
        const decoder = new TextDecoder();
        for await (const chunk of r.body) {
            buffer += decoder.decode(chunk, { stream: true });
            const lineas = buffer.split('\n');
            buffer = lineas.pop();
            for (const l of lineas) {
                const payload = l.trim().replace(/^data:\s*/, '');
                if (!l.trim().startsWith('data:') || payload === '[DONE]') continue;
                try {
                    const delta = JSON.parse(payload).choices?.[0]?.delta?.content || '';
                    if (delta && !primerToken) primerToken = seg();
                    texto += delta;
                } catch { /* fragmento incompleto */ }
            }
        }
        let resultado = null;
        let errorJSON = null;
        try { resultado = interpretarRespuesta(tipo, texto, params); } catch (e) { errorJSON = e.message; }
        const validas = resultado?.validas || 0;
        const ok = validas >= minimoValidas(params.n);
        console.log(`${ok ? '✅' : '⚠️'} ${validas}/${params.n} válidas · primer texto ${primerToken || '-'} · total ${seg()}${errorJSON ? ` · ${errorJSON}` : ''}`);
        if (ok && process.argv[2]) {
            const hoja = resultado.hojas[0];
            if (hoja.frasesOcultas) console.log('   Frases:', hoja.frasesOcultas.join(' | '));
            hoja.preguntas.forEach(q => console.log('  ', q.terminoA
                ? `${q.terminoA} ↔ ${q.terminoB}`
                : `${q.letra ? q.letra + ': ' : ''}${q.pregunta} → ${q.respuesta}${q.incorrectas?.[0] ? `   ✗ ${q.incorrectas.filter(Boolean).join(' / ')}` : ''}`));
        }
        if (!ok) console.log('   Respuesta (inicio):', texto.slice(0, 300).replace(/\s+/g, ' '));
    } catch (e) {
        console.log(`❌ ${e.name === 'TimeoutError' ? 'más de 180 s' : e.message} (${seg()})`);
    }
}
