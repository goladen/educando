// Graba los audios del Listening en francés con las voces neuronales de Edge
// (gratis, sin clave de API) y los deja en public/audio/fr/<topic>.mp3
//
//   node scripts/generar-audios-fr.mjs                  → graba los que falten
//   node scripts/generar-audios-fr.mjs --force          → regraba todos
//   node scripts/generar-audios-fr.mjs --solo=le-sport  → solo ese tema
//   node scripts/generar-audios-fr.mjs --voz=fr-FR-HenriNeural --rate=-15%
//   node scripts/generar-audios-fr.mjs --voces          → lista las voces francesas
//
// Formato de salida: mp3 mono 24 kHz 48 kbps (~360 KB por minuto de audio).
// Requiere la dependencia de desarrollo `msedge-tts` (npm i -D msedge-tts).

import fs from 'fs';
import path from 'path';
import { pipeline } from 'stream/promises';
import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';
import { LISTENING_ITEMS_FR } from '../src/BibliotecaListeningFR.js';

const args = process.argv.slice(2);
const flag = (nombre, porDefecto = null) => {
    const a = args.find(x => x.startsWith(`--${nombre}=`));
    return a ? a.slice(nombre.length + 3) : porDefecto;
};
const tiene = (nombre) => args.includes(`--${nombre}`);

const VOZ     = flag('voz', 'fr-FR-DeniseNeural');
const RATE    = flag('rate', '-10%');      // un poco más lento que el habla nativa
const PITCH   = flag('pitch', '+0Hz');
const SALIDA  = path.resolve('public/audio/fr');
const FORCE   = tiene('force');
const SOLO    = flag('solo', null);

const kb = (n) => `${Math.round(n / 1024)} KB`;

async function listarVoces() {
    const tts = new MsEdgeTTS();
    const voces = await tts.getVoices();
    console.log('Voces francesas disponibles:\n');
    voces.filter(v => v.Locale.startsWith('fr-'))
        .forEach(v => console.log(`  ${v.ShortName.padEnd(36)} ${v.Gender.padEnd(7)} ${v.FriendlyName}`));
    console.log('\nÚsalas con  --voz=fr-FR-HenriNeural');
}

async function grabar(item, tts) {
    const destino = path.join(SALIDA, `${item.topic}.mp3`);
    if (!FORCE && fs.existsSync(destino)) {
        console.log(`⏭  ${item.topic} — ya existe (${kb(fs.statSync(destino).size)}), usa --force para regrabar`);
        return { saltado: true };
    }

    // El texto que se locuta es la transcripción completa, sin los huecos
    const texto = String(item.fullTranscript).replace(/\s+/g, ' ').trim();
    const tmp = `${destino}.parcial`;

    const { audioStream } = tts.toStream(texto, { rate: RATE, pitch: PITCH });
    await pipeline(audioStream, fs.createWriteStream(tmp));

    const size = fs.statSync(tmp).size;
    if (size < 2048) {                       // respuesta vacía o error del servicio
        fs.unlinkSync(tmp);
        throw new Error('audio vacío (¿voz incorrecta o servicio caído?)');
    }
    fs.renameSync(tmp, destino);
    console.log(`✅ ${item.topic.padEnd(22)} ${kb(size).padStart(8)}  "${item.titulo}"`);
    return { bytes: size };
}

async function main() {
    if (tiene('voces')) return listarVoces();

    const items = SOLO ? LISTENING_ITEMS_FR.filter(i => i.topic === SOLO) : LISTENING_ITEMS_FR;
    if (!items.length) {
        console.error(`No hay ningún tema con topic="${SOLO}".`);
        console.error('Temas: ' + LISTENING_ITEMS_FR.map(i => i.topic).join(', '));
        process.exit(1);
    }

    fs.mkdirSync(SALIDA, { recursive: true });
    console.log(`🎙  Voz ${VOZ} · velocidad ${RATE} · ${items.length} tema(s) → ${SALIDA}\n`);

    const tts = new MsEdgeTTS();
    await tts.setMetadata(VOZ, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);

    let total = 0, hechos = 0, fallos = 0;
    for (const item of items) {
        try {
            const r = await grabar(item, tts);
            if (!r.saltado) { total += r.bytes; hechos++; }
        } catch (e) {
            fallos++;
            console.error(`❌ ${item.topic}: ${e.message}`);
        }
        await new Promise(r => setTimeout(r, 400)); // no saturar el servicio
    }
    tts.close();

    console.log(`\n${hechos} audio(s) grabados${fallos ? `, ${fallos} con error` : ''} · ${kb(total)} en total`);
    if (hechos) console.log('Recuerda escucharlos antes de subirlos: la entonación de un número o una sigla a veces falla.');
}

main().catch(e => { console.error('Error:', e.message); process.exit(1); });
