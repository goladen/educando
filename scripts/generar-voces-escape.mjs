// Graba las frases del narrador del Escape Room de Halloween con las voces neuronales de Edge
// (paquete msedge-tts, gratis y sin clave) → public/audio/escape/<id>.mp3
//
//   node scripts/generar-voces-escape.mjs                 (graba las que falten)
//   node scripts/generar-voces-escape.mjs --force         (regraba todas)
//   node scripts/generar-voces-escape.mjs --solo=intro    (solo una)
//   node scripts/generar-voces-escape.mjs --voz=es-ES-AlvaroNeural --rate=-22% --pitch=-12%
//
// La voz se graba grave y lenta; el efecto tenebroso (más grave, reverberación de cripta y eco)
// se añade en el navegador (src/escapeHalloween/comunes.jsx → audio.narrar).
import fs from 'node:fs';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';
import { NARRACION } from '../src/escapeHalloween/narracion.js';

const args = process.argv.slice(2);
const flag = (n, def) => { const a = args.find(x => x.startsWith(`--${n}=`)); return a ? a.split('=')[1] : def; };
const tiene = (n) => args.includes(`--${n}`);

const VOZ = flag('voz', 'es-ES-AlvaroNeural');
const RATE = flag('rate', '-22%');
const PITCH = flag('pitch', '-12%');
const SOLO = flag('solo', null);
const FORCE = tiene('force');
const SALIDA = path.resolve('public/audio/escape');

async function main() {
    fs.mkdirSync(SALIDA, { recursive: true });
    const ids = SOLO ? [SOLO] : Object.keys(NARRACION);
    console.log(`🎙  Voz ${VOZ} · velocidad ${RATE} · tono ${PITCH} → ${SALIDA}\n`);
    let fallos = 0;
    for (const id of ids) {
        const texto = NARRACION[id];
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
