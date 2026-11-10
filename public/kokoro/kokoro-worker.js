// Worker (module) que genera voz con Kokoro-82M en el navegador del profesor.
// Lo maneja src/utils/kokoroTTS.js (Listening del profesor), que trocea el
// texto y, sin WebGPU, reparte los trozos entre varios workers en paralelo
// (en WASM cada worker usa un solo hilo: la web no es crossOriginIsolated).
//
// · Inglés: kokoro-js tal cual (su fonemizador solo trae inglés).
// · es/fr/it/pt: fonemas con espeak-ng (./espeak-ng.js, versión recortada a esos
//   4 idiomas con scripts/kokoro/recortar-espeak.cjs; GPL-3.0 → COPYING-espeak-ng.txt)
//   y luego generate_from_ids() con la voz del idioma.
//
// Mensajes:
//   ← { tipo:'trozo', id, idioma, voz, texto, speed, dispositivo? }
//   → { tipo:'progreso', id, fase:'modelo', hecho, total }   (descarga del modelo)
//   → { tipo:'pcm', id, pcm: ArrayBuffer (Float32, 24 kHz), dispositivo }
//   ← { tipo:'mp3', id, pcm: ArrayBuffer }  → { tipo:'mp3', id, mp3: ArrayBuffer }
//   → { tipo:'error', id, mensaje }

import { KokoroTTS } from 'https://cdn.jsdelivr.net/npm/kokoro-js@1.2.1/dist/kokoro.web.js';

const MODELO = 'onnx-community/Kokoro-82M-v1.0-ONNX';
const SR = 24000;
const LANG_ESPEAK = { es: 'es', fr: 'fr', it: 'it', pt: 'pt-br' };

let ttsPromesa = null;
let dispositivo = 'wasm';
let espeakPromesa = null;

async function webgpuDisponible() {
    try {
        if (!self.navigator?.gpu) return false;
        return !!(await self.navigator.gpu.requestAdapter());
    } catch { return false; }
}

function cargarModelo(preferido, avisar) {
    if (ttsPromesa) return ttsPromesa;
    ttsPromesa = (async () => {
        const archivos = {};
        const progress_callback = (p) => {
            if (p.status !== 'progress' || !p.file) return;
            archivos[p.file] = { loaded: p.loaded || 0, total: p.total || 0 };
            const v = Object.values(archivos);
            avisar(v.reduce((a, x) => a + x.loaded, 0), v.reduce((a, x) => a + x.total, 0));
        };
        // WebGPU: mucho más rápido, pero con el modelo fp32 (326 MB).
        // WASM: modelo cuantizado q8 (92 MB), más lento.
        if (preferido !== 'wasm' && await webgpuDisponible()) {
            try {
                const tts = await KokoroTTS.from_pretrained(MODELO, { dtype: 'fp32', device: 'webgpu', progress_callback });
                dispositivo = 'webgpu';
                return tts;
            } catch (e) {
                console.warn('[kokoro] WebGPU falló, se usa WASM:', e?.message || e);
            }
        }
        const tts = await KokoroTTS.from_pretrained(MODELO, { dtype: 'q8', device: 'wasm', progress_callback });
        dispositivo = 'wasm';
        return tts;
    })();
    ttsPromesa.catch(() => { ttsPromesa = null; });
    return ttsPromesa;
}

function cargarEspeak() {
    if (!espeakPromesa) {
        espeakPromesa = import('./espeak-ng.js')
            .then(m => m.default())
            .then(mod => new mod.eSpeakNGWorker());
        espeakPromesa.catch(() => { espeakPromesa = null; });
    }
    return espeakPromesa;
}

// Fonemas IPA (es/fr/it/pt) conservando la puntuación, que el modelo usa para
// las pausas y la entonación
function fonemizar(espeak, texto, idioma) {
    espeak.set_voice(LANG_ESPEAK[idioma] || 'es');
    return texto.split(/([,.;:!?…]+)/).map((p, i) => {
        if (i % 2) return p.replace(/…/g, '...') + ' ';
        const limpio = p.replace(/[¿¡«»“”"()[\]{}*_#]/g, ' ').trim();
        if (!limpio) return '';
        const r = espeak.synthesize_ipa(limpio, () => {});
        return String(r?.ipa || '').replace(/_/g, '').replace(/\s+/g, ' ').trim();
    }).join('').trim();
}

let lame = null;
async function aMp3(muestras) {
    lame ??= await import('https://cdn.jsdelivr.net/npm/@breezystack/lamejs@1.2.7/dist/lamejs.js');
    const enc = new lame.Mp3Encoder(1, SR, 48);
    const pcm = new Int16Array(muestras.length);
    for (let i = 0; i < muestras.length; i++) {
        const s = Math.max(-1, Math.min(1, muestras[i]));
        pcm[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    const bloques = [];
    const PASO = 1152 * 20;
    for (let i = 0; i < pcm.length; i += PASO) {
        const b = enc.encodeBuffer(pcm.subarray(i, i + PASO));
        if (b.length) bloques.push(b);
    }
    const fin = enc.flush();
    if (fin.length) bloques.push(fin);
    const bytes = new Uint8Array(bloques.reduce((a, b) => a + b.length, 0));
    let o = 0;
    for (const b of bloques) { bytes.set(b, o); o += b.length; }
    return bytes.buffer;
}

async function trozo({ id, idioma, voz, texto, speed = 1, dispositivo: preferido }) {
    const tts = await cargarModelo(preferido, (hecho, total) => self.postMessage({ id, tipo: 'progreso', fase: 'modelo', hecho, total }));
    const vel = Math.min(1.3, Math.max(0.6, Number(speed) || 1));
    let audio;
    if (idioma === 'en') {
        audio = await tts.generate(texto, { voice: voz, speed: vel });
    } else {
        const fonemas = fonemizar(await cargarEspeak(), texto, idioma);
        if (!fonemas) { self.postMessage({ id, tipo: 'pcm', pcm: new ArrayBuffer(0), dispositivo }); return; }
        const { input_ids } = tts.tokenizer(fonemas, { truncation: true });
        audio = await tts.generate_from_ids(input_ids, { voice: voz, speed: vel });
    }
    const pcm = new Float32Array(audio.audio).buffer;
    self.postMessage({ id, tipo: 'pcm', pcm, dispositivo }, [pcm]);
}

self.onmessage = async (e) => {
    const m = e.data || {};
    try {
        if (m.tipo === 'trozo') await trozo(m);
        else if (m.tipo === 'mp3') {
            const mp3 = await aMp3(new Float32Array(m.pcm));
            self.postMessage({ id: m.id, tipo: 'mp3', mp3 }, [mp3]);
        }
    } catch (err) {
        self.postMessage({ id: m.id, tipo: 'error', mensaje: err?.message || String(err) });
    }
};
