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
const MAX_TROZO = 2500;               // caracteres por petición a Edge
const RATE_VALIDO = /^[+-]?\d{1,2}%$/;
const VOZ_VALIDA = /^[a-z]{2,3}-[A-Z]{2}-[A-Za-z]+Neural$/;

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

// Ojo: el servicio de Edge corta la conexión si el SSML lleva <break>; cada
// trozo ya trae un pequeño silencio final, que sirve de pausa entre turnos.
async function sintetizar(tts, texto, rate) {
    const { audioStream } = tts.toStream(escaparXml(texto.trim()), { rate });
    const chunks = [];
    for await (const c of audioStream) chunks.push(c);
    return Buffer.concat(chunks);
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
    const { texto = '', voz = 'en-GB-SoniaNeural', voz2 = null, dialogo = false, rate = '-10%', anterior = null } = req.body || {};
    const limpio = String(texto).replace(/[ \t]+/g, ' ').trim();
    if (!limpio) return res.status(400).json({ error: 'El texto está vacío.' });
    if (limpio.length > MAX_CARACTERES) return res.status(400).json({ error: `El texto es demasiado largo (máx. ${MAX_CARACTERES} caracteres).` });
    if (!VOZ_VALIDA.test(voz) || (voz2 && !VOZ_VALIDA.test(voz2))) return res.status(400).json({ error: 'Voz no válida.' });
    const rateOk = RATE_VALIDO.test(rate) ? rate : '-10%';

    // ── síntesis ────────────────────────────────────────────────────────────
    const plan = planificar(limpio, voz, voz2, !!dialogo);
    const motores = {};
    let audio;
    try {
        const partes = [];
        for (const p of plan) {
            if (!motores[p.voz]) {
                motores[p.voz] = new MsEdgeTTS();
                await motores[p.voz].setMetadata(p.voz, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);
            }
            partes.push(await sintetizar(motores[p.voz], p.texto, rateOk));
        }
        // Los fotogramas mp3 del mismo formato se pueden concatenar sin más
        audio = Buffer.concat(partes);
    } catch (e) {
        return res.status(502).json({ error: 'No se pudo generar la voz: ' + e.message });
    } finally {
        Object.values(motores).forEach(m => { try { m.close(); } catch { /* ya cerrado */ } });
    }
    if (audio.length < 2048) return res.status(502).json({ error: 'El servicio de voz devolvió un audio vacío.' });

    // ── subida firmada a Cloudinary (el mp3 va como resource_type "video") ───
    const carpeta = `listening/${usuario.uid}`;
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
