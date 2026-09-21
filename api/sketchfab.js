// Serverless function — Vercel
//
// Importa un modelo de Sketchfab a Cloudinary en un solo paso:
//   enlace corto (skfb.ly) → uid → metadatos → descarga glTF (zip)
//   → empaquetado a .glb → subida a Cloudinary → ficha lista para publicar.
//
// La descarga exige un token personal de Sketchfab:
//   Sketchfab → Settings → Password & API → API Token
//   Vercel → SKETCHFAB_API_TOKEN
//
// NOTA: no reduce texturas ni comprime con Draco (eso necesita binarios nativos
// que no caben cómodamente en una función). Empaqueta el modelo tal cual viene.
// Para modelos pesados sigue mereciendo la pena optimizar en local con
// `npx @gltf-transform/cli optimize`.

import JSZip from 'jszip';
import { NodeIO } from '@gltf-transform/core';
import { createHash } from 'node:crypto';
import { exigirAdmin, credencialesCloudinary } from './_auth.js';

// Tope del zip descargado. Por encima, la función se arriesga a agotar el
// tiempo o la memoria: mejor avisar que fallar a medias.
const MAX_ZIP_MB = 45;

/** Extrae el uid de 32 hex de cualquier forma de URL de Sketchfab. */
async function resolverUid(entrada) {
    const texto = String(entrada || '').trim();

    const directo = texto.match(/([0-9a-f]{32})/i);
    if (directo) return directo[1];

    if (!/^https?:\/\//i.test(texto)) throw new Error('Pega el enlace del modelo de Sketchfab.');

    // Los enlaces cortos skfb.ly encadenan varias redirecciones hasta la ficha.
    const r = await fetch(texto, { redirect: 'follow', headers: { 'User-Agent': 'pikt.es' } });
    const final = r.url || '';
    const m = final.match(/([0-9a-f]{32})/i);
    if (!m) throw new Error('No he podido identificar el modelo a partir de ese enlace.');
    return m[1];
}

/** Empaqueta glTF + .bin + texturas (ya en memoria) en un único .glb. */
async function empaquetarGlb(zip) {
    const nombres = Object.keys(zip.files).filter(n => !zip.files[n].dir);

    // Si el zip ya trae un .glb, no hay nada que convertir.
    const yaGlb = nombres.find(n => /\.glb$/i.test(n));
    if (yaGlb) return new Uint8Array(await zip.files[yaGlb].async('uint8array'));

    const ruta = nombres.find(n => /\.gltf$/i.test(n));
    if (!ruta) throw new Error('El archivo de Sketchfab no contiene ningún .gltf ni .glb.');

    const json = JSON.parse(await zip.files[ruta].async('string'));

    // Las rutas del .gltf son relativas a su propia carpeta dentro del zip.
    const carpeta = ruta.includes('/') ? ruta.slice(0, ruta.lastIndexOf('/') + 1) : '';
    const resources = {};
    for (const n of nombres) {
        if (n === ruta) continue;
        if (carpeta && !n.startsWith(carpeta)) continue;
        const rel = carpeta ? n.slice(carpeta.length) : n;
        resources[rel] = new Uint8Array(await zip.files[n].async('uint8array'));
        // El .gltf puede referenciar las texturas con %20 u otros escapes.
        resources[encodeURI(rel)] = resources[rel];
    }

    const io = new NodeIO();
    const doc = await io.readJSON({ json, resources });
    return await io.writeBinary(doc);
}

/** Sube un Buffer a Cloudinary como raw, firmando en el servidor. */
async function subirACloudinary(buffer, nombreArchivo, { cloud, apiKey, secret }, carpeta) {
    const timestamp = Math.round(Date.now() / 1000);
    const publicId = `${carpeta}/${nombreArchivo}`;
    const cadena = `public_id=${publicId}&timestamp=${timestamp}`;
    const signature = createHash('sha1').update(cadena + secret).digest('hex');

    const fd = new FormData();
    fd.append('file', new Blob([buffer]), `${nombreArchivo}.glb`);
    fd.append('api_key', apiKey);
    fd.append('timestamp', String(timestamp));
    fd.append('public_id', publicId);
    fd.append('signature', signature);

    const r = await fetch(`https://api.cloudinary.com/v1_1/${cloud}/raw/upload`, { method: 'POST', body: fd });
    const data = await r.json();
    if (!r.ok || !data.secure_url) throw new Error(data?.error?.message || `Cloudinary respondió ${r.status}.`);
    return { url: data.secure_url, publicId: data.public_id, bytes: data.bytes };
}

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    if (!(await exigirAdmin(req, res))) return;

    const creds = credencialesCloudinary();
    if (!creds) return res.status(500).json({ error: 'Cloudinary no está configurado en el servidor.' });

    const token = process.env.SKETCHFAB_API_TOKEN;
    const { enlace, carpeta = 'modelos3d', soloInfo = false } = req.body || {};

    // Los metadatos son públicos; solo la descarga necesita el token. Por eso
    // la comprobación va más abajo: así `soloInfo` funciona sin configurarlo.
    if (!token && !soloInfo) {
        return res.status(500).json({ error: 'Falta SKETCHFAB_API_TOKEN en el servidor (Sketchfab → Settings → Password & API → API Token).' });
    }

    try {
        const uid = await resolverUid(enlace);

        // 1) Metadatos (públicos): nombre, autor y licencia para la atribución.
        const rMeta = await fetch(`https://api.sketchfab.com/v3/models/${uid}`);
        if (!rMeta.ok) return res.status(404).json({ error: 'No he encontrado ese modelo en Sketchfab.' });
        const meta = await rMeta.json();

        const ficha = {
            uid,
            nombre: meta.name || 'Modelo',
            autor: meta.user?.displayName || meta.user?.username || '',
            licencia: meta.license?.label || '',
            fuente: meta.viewerUrl || `https://sketchfab.com/3d-models/${uid}`,
            descripcion: (meta.description || '').split('\n')[0].slice(0, 200),
            descargable: !!meta.isDownloadable,
        };

        if (!ficha.descargable) {
            return res.status(400).json({ error: `«${ficha.nombre}» no es descargable en Sketchfab: solo se puede ver en su web.`, ficha });
        }
        if (soloInfo) return res.status(200).json({ ficha });

        // 2) URL de descarga temporal (requiere el token personal).
        const rDl = await fetch(`https://api.sketchfab.com/v3/models/${uid}/download`, {
            headers: { Authorization: `Token ${token}` },
        });
        const dl = await rDl.json();
        if (!rDl.ok) {
            const detalle = dl?.detail || `error ${rDl.status}`;
            return res.status(rDl.status === 401 ? 401 : 400).json({ error: `Sketchfab no autorizó la descarga (${detalle}). Revisa el SKETCHFAB_API_TOKEN.`, ficha });
        }
        const enlaceZip = dl?.gltf?.url;
        if (!enlaceZip) return res.status(400).json({ error: 'Ese modelo no ofrece descarga en formato glTF.', ficha });

        // 3) Descarga del zip.
        const rZip = await fetch(enlaceZip);
        if (!rZip.ok) return res.status(502).json({ error: 'No se pudo descargar el archivo desde Sketchfab.', ficha });
        const bytes = Buffer.from(await rZip.arrayBuffer());
        const mb = bytes.length / 1048576;
        if (mb > MAX_ZIP_MB) {
            return res.status(413).json({
                error: `El modelo ocupa ${mb.toFixed(1)} MB y supera el límite de ${MAX_ZIP_MB} MB que puede procesar el servidor. Descárgalo y optimízalo en tu ordenador con gltf-transform.`,
                ficha,
            });
        }

        // 4) glTF + texturas → un único .glb.
        const zip = await JSZip.loadAsync(bytes);
        const glb = await empaquetarGlb(zip);

        // 5) A Cloudinary.
        const base = (ficha.nombre || 'modelo')
            .normalize('NFD').replace(/\p{Diacritic}/gu, '')
            .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'modelo';
        const subido = await subirACloudinary(Buffer.from(glb), `${base}-${uid.slice(0, 6)}`, creds, carpeta);

        return res.status(200).json({
            ficha: { ...ficha, ...subido, emoji: '🧊', categoria: 'OTROS', visible: true },
            origen: { zipMB: Number(mb.toFixed(1)), glbMB: Number((glb.length / 1048576).toFixed(1)) },
        });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
}
