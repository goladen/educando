// Serverless function — Vercel
//
// Graba el audio de un listening creado por un profesor y lo guarda en
// Cloudinary. Usa las voces neuronales de Edge (paquete msedge-tts, el mismo
// que scripts/generar-audios-fr.mjs): gratis y sin clave de API.
//
// POST { texto, voz, voz2?, dialogo?, rate?, anterior? }
//   · dialogo: true → cada línea "Nombre: frase" se lee con la voz de ese
//     personaje (1º personaje = voz, 2º = voz2, y se alternan si hay más).
//     El nombre del personaje no se locuta.
//   · anterior: public_id del audio previo; se borra si es del mismo usuario.
//   · destino: 'tour' → carpeta tour-solar/<uid> (voces del tour del Sistema Solar).
// → { url, publicId, bytes, duracion }
//
// Exige sesión de Firebase (cualquier usuario, no solo el admin): la
// subida va a la carpeta listening/<uid> para poder borrar solo lo propio.
//
// Variables de entorno: las mismas que api/cloudinary.js
//     CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET, VITE_CLOUDINARY_CLOUD

import { createHash } from 'node:crypto';
import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';
import { usuarioDelToken, credencialesCloudinary } from './_auth.js';

const MAX_CARACTERES = 6000;          // ≈ 6-7 minutos de audio
const MAX_TROZO = 1200;               // caracteres por petición a Edge (trozos cortos → en paralelo)
const RATE_VALIDO = /^[+-]?\d{1,2}%$/;
const VOZ_VALIDA = /^[a-z]{2,3}-[A-Z]{2}-[A-Za-z]+Neural$/;

// Desde el 10/10/2026 Microsoft está migrando el servicio a api.msedgeservices.com
// y el servidor antiguo responde 403 a casi todo (siempre desde Vercel). Se usa
// el nuevo (mismo token, como Ocp-Apim-Subscription-Key) y, 1 de cada 3
// conexiones, el antiguo por si el nuevo fallara en alguna región.
const WSS_ANTIGUO = 'wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1?TrustedClientToken=';
const WSS_NUEVO = 'wss://api.msedgeservices.com/tts/cognitiveservices/websocket/v1?Ocp-Apim-Subscription-Key=';
const urlOriginal = MsEdgeTTS.getSynthUrl;
let conexiones = 0;
MsEdgeTTS.getSynthUrl = async function () {
    const url = await urlOriginal.call(this);
    return conexiones++ % 3 === 2 ? url : url.replace(WSS_ANTIGUO, WSS_NUEVO);
};

function firmar(params, secret) {
    const cadena = Object.keys(params).sort().map(k => `${k}=${params[k]}`).join('&');
    return createHash('sha1').update(cadena + secret).digest('hex');
}

// msedge-tts pega el texto tal cual dentro del SSML: hay que escaparlo
const escaparXml = (s) => String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&apos;');

// Parte un texto largo en trozos por frases sin pasar de MAX_TROZO
function trocear(texto) {
    const frases = texto.match(/[^.!?\n]+[.!?]*\s*/g) || [texto];
    const trozos = [];
    let actual = '';
    for (const f of frases) {
        if ((actual + f).length > MAX_TROZO && actual) { trozos.push(actual); actual = ''; }
        actual += f;
    }
    if (actual.trim()) trozos.push(actual);
    return trozos;
}

// Lista de { voz, texto } a locutar en orden
function planificar(texto, voz, voz2, dialogo) {
    if (!dialogo) return trocear(texto).map(t => ({ voz, texto: t }));
    const voces = [voz, voz2 || voz];
    const personajes = [];
    const turnos = [];
    for (const linea of texto.split(/\n+/)) {
        const l = linea.trim();
        if (!l) continue;
        // Nombre = letras y espacios (así "At 10:30…" no se toma por personaje)
        const m = l.match(/^(\p{L}[\p{L} .'-]{0,28}):\s*(.+)$/u);
        if (m) {
            const nombre = m[1].trim().toLowerCase();
            if (!personajes.includes(nombre)) personajes.push(nombre);
            turnos.push({ voz: voces[personajes.indexOf(nombre) % 2], texto: m[2] });
        } else {
            // Línea sin personaje (narrador): la voz principal
            turnos.push({ voz, texto: l });
        }
    }
    return turnos.flatMap(t => trocear(t.texto).map(x => ({ voz: t.voz, texto: x })));
}

const INTENTOS = 8;                   // Edge rechaza (403) muchas conexiones nuevas
const LIMITE_TROZO_MS = 25000;        // un trozo que no acaba en este tiempo se reintenta
const LIMITE_TOTAL_MS = 50000;        // margen antes del maxDuration (60 s) de Vercel
const EN_PARALELO = 5;

const esperar = (ms) => new Promise(r => setTimeout(r, ms));

function conLimite(promesa, ms, mensaje) {
    let t;
    return Promise.race([
        promesa,
        new Promise((_, rej) => { t = setTimeout(() => rej(new Error(mensaje)), ms); }),
    ]).finally(() => clearTimeout(t));
}

// Ojo: el servicio de Edge corta la conexión si el SSML lleva <break>; cada
// trozo ya trae un pequeño silencio final, que sirve de pausa entre turnos.
//
// msedge-tts hace `this._send(request).then()` sin catch: si la (re)conexión
// falla con 403 el error se pierde y el stream no termina nunca (→ 504 de
// Vercel). Por eso se intercepta _send para cortar el stream, todo va con
// tiempo límite y, si algo falla, se descarta esa conexión y se reintenta.
// Las conexiones se reutilizan: el 403 solo aparece al conectar.
// Si un trozo se descarta (tiempo agotado) y luego llegan más datos suyos, la
// librería hace this._streams[id].audio.push() sobre undefined y tumba el
// proceso: los ids desconocidos van a un destino vacío.
const HUERFANO = { audio: { push() {}, destroy() {} }, metadata: { push() {}, destroy() {} }, turnEnded: true };
const streamsSeguros = () => new Proxy({}, { get: (o, k) => (k in o || typeof k !== 'string' ? o[k] : HUERFANO) });

async function conectar(voz) {
    const tts = new MsEdgeTTS();
    tts._streams = streamsSeguros();
    try {
        await conLimite(tts.setMetadata(voz, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3),
            LIMITE_TROZO_MS, 'El servicio de voz no responde.');
    } catch (e) { cerrar(tts); throw e; }
    const enviar = tts._send.bind(tts);
    tts._send = (msg) => enviar(msg).catch(e => {
        Object.values(tts._streams || {}).forEach(s => s.audio.destroy(e));
    });
    return tts;
}

function cerrar(tts) { try { tts?.close(); } catch { /* ya cerrado */ } }

async function pedirAudio(tts, texto, rate) {
    const { audioStream } = tts.toStream(escaparXml(texto.trim()), { rate });
    const leer = (async () => {
        const chunks = [];
        for await (const c of audioStream) chunks.push(c);
        return Buffer.concat(chunks);
    })();
    const audio = await conLimite(leer, LIMITE_TROZO_MS, 'El servicio de voz tardó demasiado.')
        .catch(e => { audioStream.destroy(); throw e; });
    if (!audio.length) throw new Error('audio vacío');
    return audio;
}

// motores: conexiones { voz: MsEdgeTTS } de un mismo hilo de trabajo
async function sintetizar(motores, voz, texto, rate, fin) {
    let ultimo;
    for (let i = 0; i < INTENTOS && Date.now() < fin; i++) {
        try {
            if (!motores[voz] || motores[voz]._ws?.readyState !== 1) {
                cerrar(motores[voz]);
                motores[voz] = await conectar(voz);
            }
            return await pedirAudio(motores[voz], texto, rate);
        } catch (e) {
            ultimo = e;
            console.error(`[listening-tts] intento ${i + 1} (${voz}): ${e.message}`);
            cerrar(motores[voz]);
            delete motores[voz];
            await esperar(200 * (i + 1));
        }
    }
    throw ultimo || new Error('Se agotó el tiempo para generar la voz.');
}

// Ejecuta las tareas con concurrencia limitada conservando el orden; cada
// hilo recibe sus propias conexiones, que se cierran al terminar
async function enParalelo(tareas, n) {
    const res = new Array(tareas.length);
    let sig = 0;
    await Promise.all(Array.from({ length: Math.min(n, tareas.length) }, async () => {
        const motores = {};
        try {
            while (sig < tareas.length) { const i = sig++; res[i] = await tareas[i](motores); }
        } finally {
            Object.values(motores).forEach(cerrar);
        }
    }));
    return res;
}

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    // ── sesión ──────────────────────────────────────────────────────────────
    const idToken = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    if (!idToken) return res.status(401).json({ error: 'Inicia sesión para grabar el audio.' });
    let usuario;
    try { usuario = await usuarioDelToken(idToken); }
    catch (e) { return res.status(500).json({ error: e.message }); }
    if (!usuario?.uid) return res.status(401).json({ error: 'Sesión no válida.' });

    const creds = credencialesCloudinary();
    if (!creds) return res.status(500).json({ error: 'Cloudinary no está configurado en el servidor.' });
    const { cloud, apiKey, secret } = creds;

    // ── parámetros ──────────────────────────────────────────────────────────
    const { texto = '', voz = 'en-GB-SoniaNeural', voz2 = null, dialogo = false, rate = '-10%', anterior = null, destino = null } = req.body || {};
    const limpio = String(texto).replace(/[ \t]+/g, ' ').trim();
    if (!limpio) return res.status(400).json({ error: 'El texto está vacío.' });
    if (limpio.length > MAX_CARACTERES) return res.status(400).json({ error: `El texto es demasiado largo (máx. ${MAX_CARACTERES} caracteres).` });
    if (!VOZ_VALIDA.test(voz) || (voz2 && !VOZ_VALIDA.test(voz2))) return res.status(400).json({ error: 'Voz no válida.' });
    const rateOk = RATE_VALIDO.test(rate) ? rate : '-10%';

    // ── síntesis ────────────────────────────────────────────────────────────
    const plan = planificar(limpio, voz, voz2, !!dialogo);
    const fin = Date.now() + LIMITE_TOTAL_MS;
    let audio;
    try {
        const partes = await enParalelo(plan.map(p => (motores) => sintetizar(motores, p.voz, p.texto, rateOk, fin)), EN_PARALELO);
        // Los fotogramas mp3 del mismo formato se pueden concatenar sin más
        audio = Buffer.concat(partes);
    } catch (e) {
        console.error("[listening-tts] sin voz:", e.message);
        return res.status(502).json({ error: 'No se pudo generar la voz (inténtalo de nuevo en un momento): ' + e.message });
    }
    if (audio.length < 2048) return res.status(502).json({ error: 'El servicio de voz devolvió un audio vacío.' });

    // ── subida firmada a Cloudinary (el mp3 va como resource_type "video") ───
    // destino "tour": narraciones del tour del Sistema Solar (SimuladorSistemaSolar)
    const carpeta = `${destino === 'tour' ? 'tour-solar' : 'listening'}/${usuario.uid}`;
    const timestamp = Math.round(Date.now() / 1000);
    const form = new FormData();
    form.append('file', new Blob([audio], { type: 'audio/mpeg' }), 'listening.mp3');
    form.append('api_key', apiKey);
    form.append('timestamp', String(timestamp));
    form.append('folder', carpeta);
    form.append('signature', firmar({ folder: carpeta, timestamp }, secret));

    let subida;
    try {
        const r = await fetch(`https://api.cloudinary.com/v1_1/${cloud}/video/upload`, { method: 'POST', body: form });
        subida = await r.json();
        if (!r.ok) return res.status(r.status).json({ error: subida?.error?.message || 'Error al subir a Cloudinary' });
    } catch (e) {
        console.error('[listening-tts] Cloudinary:', e.message);
        return res.status(502).json({ error: 'Error al subir a Cloudinary: ' + e.message });
    }

    // ── borrar el audio anterior (solo si es de este usuario) ──────────────
    if (anterior && String(anterior).startsWith(`${carpeta}/`) && anterior !== subida.public_id) {
        try {
            const q = new URLSearchParams();
            q.append('public_ids[]', anterior);
            await fetch(`https://api.cloudinary.com/v1_1/${cloud}/resources/video/upload?${q}`, {
                method: 'DELETE',
                headers: { Authorization: 'Basic ' + Buffer.from(`${apiKey}:${secret}`).toString('base64') },
            });
        } catch { /* no es crítico: queda un archivo huérfano */ }
    }

    return res.status(200).json({
        url: subida.secure_url,
        publicId: subida.public_id,
        bytes: subida.bytes || audio.length,
        duracion: subida.duration || null,
    });
}
