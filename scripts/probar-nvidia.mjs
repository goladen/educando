// Prueba local del generador de Pasapalabra con NVIDIA, sin desplegar.
// Llama directamente a NVIDIA con el mismo prompt, modelos y validación que la web.
//
//   node scripts/probar-nvidia.mjs                       → prueba todos los modelos
//   node scripts/probar-nvidia.mjs google/gemma-4-31b-it → solo ese modelo
//   TEMA="El cuerpo humano" IDIOMA=Inglés NIVEL="1º-2º ESO" N=20 node scripts/probar-nvidia.mjs
//
// La clave se lee de la variable NVIDIA_API_KEY o de .env.local (NVIDIA_API_KEY=...).
import { readFileSync } from 'node:fs';
import { MODELOS, opcionesModelo } from '../api/nvidia.js';
import { mensajesPasapalabra, extraerArrayJSON, validarRosco } from '../src/nvidiaPasapalabra.js';

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

const tema = process.env.TEMA || 'El sistema solar';
const idioma = process.env.IDIOMA || 'Español';
const nivel = process.env.NIVEL || '5º-6º Primaria';
const n = Number(process.env.N) || 20;
const modelos = process.argv[2] ? [process.argv[2]] : MODELOS;
const mensajes = mensajesPasapalabra({ tema, idioma, nivel, n });

console.log(`Tema: ${tema} · ${idioma} · ${nivel} · ${n} preguntas\n`);

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
        let validas = [];
        let errorJSON = null;
        try { validas = validarRosco(extraerArrayJSON(texto)); } catch (e) { errorJSON = e.message; }
        const ok = validas.length >= Math.ceil(n * 0.6);
        console.log(`${ok ? '✅' : '⚠️'} ${validas.length}/${n} válidas · primer texto ${primerToken || '-'} · total ${seg()}${errorJSON ? ` · ${errorJSON}` : ''}`);
        if (ok && process.argv[2]) validas.forEach(q => console.log(`   ${q.letra}: ${q.pregunta} → ${q.respuesta}`));
        if (!ok) console.log('   Respuesta (inicio):', texto.slice(0, 300).replace(/\s+/g, ' '));
    } catch (e) {
        console.log(`❌ ${e.name === 'TimeoutError' ? 'más de 180 s' : e.message} (${seg()})`);
    }
}
