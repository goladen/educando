// Graba las frases del narrador de La Mansión Pitagórica con las voces neuronales de Edge
// (paquete msedge-tts, gratis y sin clave) → public/audio/mansion/<id>.mp3
// Copia de generar-voces-escape.mjs con las frases de src/mansion/narracion.js.
//
//   node scripts/generar-voces-mansion.mjs                 (graba las que falten)
//   node scripts/generar-voces-mansion.mjs --force         (regraba todas)
//   node scripts/generar-voces-mansion.mjs --solo=pista    (solo una)
//
// El efecto tenebroso se añade en el navegador (src/utils/audioTenebroso.js → narrar).
import fs from 'node:fs';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';
import { FRASES as FRASES_MANSION } from '../src/mansion/narracion.js';

// Desde octubre de 2026 el servidor antiguo de Edge responde 403: se usa el nuevo (mismo token),
// igual que api/listening-tts.js
const WSS_ANTIGUO = 'wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1?TrustedClientToken=';
const WSS_NUEVO = 'wss://api.msedgeservices.com/tts/cognitiveservices/websocket/v1?Ocp-Apim-Subscription-Key=';
const urlOriginal = MsEdgeTTS.getSynthUrl;
if (urlOriginal) MsEdgeTTS.getSynthUrl = async function () { return (await urlOriginal.call(this)).replace(WSS_ANTIGUO, WSS_NUEVO); };

const args = process.argv.slice(2);
const flag = (n, def) => { const a = args.find(x => x.startsWith(`--${n}=`)); return a ? a.split('=')[1] : def; };
const tiene = (n) => args.includes(`--${n}`);

const IDIOMA = flag('idioma', 'es');
const FRASES = FRASES_MANSION;
const VOZ = flag('voz', IDIOMA === 'en' ? 'en-GB-RyanNeural' : 'es-ES-AlvaroNeural');
const RATE = flag('rate', '-22%');
const PITCH = flag('pitch', '-12%');
const SOLO = flag('solo', null);
const FORCE = tiene('force');
const SALIDA = path.resolve('public/audio/mansion');

async function main() {
    fs.mkdirSync(SALIDA, { recursive: true });
    const ids = SOLO ? [SOLO] : Object.keys(FRASES);
    console.log(`🎙  Voz ${VOZ} · velocidad ${RATE} · tono ${PITCH} → ${SALIDA}\n`);
    let fallos = 0;
    for (const id of ids) {
        const texto = FRASES[id];
        if (!texto) { console.error(`✖ No existe la frase «${id}»`); fallos++; continue; }
        const destino = path.join(SALIDA, `${id}.mp3`);
        if (!FORCE && fs.existsSync(destino)) { console.log(`⏭  ${id} ya existe`); continue; }
        try {
            // Una conexión por frase: el servicio cierra el socket tras cada síntesis larga
            const tts = new MsEdgeTTS();
            await tts.setMetadata(VOZ, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);
            const { audioStream } = tts.toStream(texto, { rate: RATE, pitch: PITCH });
            const tmp = destino + '.parcial';
            await pipeline(audioStream, fs.createWriteStream(tmp));
            const size = fs.statSync(tmp).size;
            if (size < 2048) { fs.unlinkSync(tmp); throw new Error('audio vacío'); }
            fs.renameSync(tmp, destino);
            console.log(`✅ ${id.padEnd(14)} ${String(Math.round(size / 1024)).padStart(4)} KB`);
            tts.close?.();
        } catch (e) {
            console.error(`✖ ${id}: ${e.message}`); fallos++;
        }
    }
    if (fallos) process.exitCode = 1;
}
main();
