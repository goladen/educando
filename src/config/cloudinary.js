// Configuración de Cloudinary para modelos 3D (.glb / .gltf).
//
// Los .glb se suben como resource_type = "raw": Cloudinary hace de CDN y
// almacenamiento, pero NO transforma ni comprime el modelo (f_auto / q_auto no
// aplican a "raw"). Optimiza SIEMPRE antes de subir:
//     npx @gltf-transform/cli optimize entrada.glb salida.glb --texture-size 1024 --compress draco
//
// El cloud name y el upload preset "unsigned" son datos públicos por diseño
// (viajan en la propia URL de subida), así que pueden ir en el bundle. El API
// SECRET no debe aparecer nunca aquí.
//
// Configúralos en .env.local:
//     VITE_CLOUDINARY_CLOUD=tu-cloud-name
//     VITE_CLOUDINARY_PRESET=pikt_modelos
// En el preset (Settings → Upload → Upload presets) conviene poner:
//     Signing mode: Unsigned · Folder: modelos3d · Allowed formats: glb,gltf
//     Max file size: ~30 MB   (un preset unsigned es público: limítalo)

import { reportarError } from '../utils/reportarError';

export const CLOUDINARY_CLOUD  = import.meta.env.VITE_CLOUDINARY_CLOUD  || '';
export const CLOUDINARY_PRESET = import.meta.env.VITE_CLOUDINARY_PRESET || '';

/** ¿Está la subida directa disponible? Si no, la herramienta solo acepta pegar URL. */
export const cloudinaryListo = () => Boolean(CLOUDINARY_CLOUD && CLOUDINARY_PRESET);

export const esUrlCloudinary = (url) => /^https:\/\/res\.cloudinary\.com\//i.test(String(url || ''));

/** URL de entrega de un modelo ya subido, a partir de su public_id. */
export const urlModelo = (publicId) =>
    `https://res.cloudinary.com/${CLOUDINARY_CLOUD}/raw/upload/${String(publicId).replace(/^\/+/, '')}`;

export const MAX_MB = 30;

/** Comprueba extensión y tamaño antes de gastar ancho de banda. */
function validarArchivo(file) {
    const nombre = (file?.name || '').toLowerCase();
    if (!/\.(glb|gltf)$/.test(nombre)) return 'Solo se admiten archivos .glb o .gltf.';
    if (file.size > MAX_MB * 1024 * 1024) {
        return `El modelo pesa ${(file.size / 1048576).toFixed(1)} MB. Optimízalo antes de subirlo (máx. ${MAX_MB} MB).`;
    }
    return null;
}

/** POST del archivo a Cloudinary con barra de progreso. */
function enviarACloudinary(cloud, campos, file, onProgress, tipo = 'raw') {
    return new Promise((resolve, reject) => {
        const fd = new FormData();
        fd.append('file', file);
        Object.entries(campos).forEach(([k, v]) => fd.append(k, v));

        const xhr = new XMLHttpRequest();
        xhr.open('POST', `https://api.cloudinary.com/v1_1/${cloud}/${tipo}/upload`);
        xhr.upload.onprogress = (e) => {
            if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100));
        };
        xhr.onload = () => {
            let data = {};
            try { data = JSON.parse(xhr.responseText); } catch (_) {}
            if (xhr.status >= 200 && xhr.status < 300 && data.secure_url) {
                resolve({ url: data.secure_url, publicId: data.public_id, bytes: data.bytes });
            } else {
                const err = new Error(data?.error?.message || `Cloudinary respondió ${xhr.status}.`);
                reportarError('cloudinary', err, { estado: xhr.status, tamano: file?.size || 0 });
                reject(err);
            }
        };
        xhr.onerror = () => {
            const err = new Error('No se pudo conectar con Cloudinary.');
            reportarError('cloudinary', err, { red: true, tamano: file?.size || 0 });
            reject(err);
        };
        xhr.send(fd);
    });
}

/** Reduce una imagen a JPEG de como mucho `maxLado` px (para no subir fotos de 5 MB). */
function reducirImagen(file, maxLado = 1400, calidad = 0.85) {
    return new Promise((resolve, reject) => {
        const url = URL.createObjectURL(file);
        const img = new Image();
        img.onload = () => {
            const k = Math.min(1, maxLado / Math.max(img.width, img.height));
            const c = document.createElement('canvas');
            c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
            const ctx = c.getContext('2d');
            ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, c.width, c.height); // PNG transparente → fondo blanco
            ctx.drawImage(img, 0, 0, c.width, c.height);
            URL.revokeObjectURL(url);
            c.toBlob(b => b ? resolve(new File([b], 'imagen.jpg', { type: 'image/jpeg' })) : reject(new Error('No se pudo procesar la imagen.')), 'image/jpeg', calidad);
        };
        img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('El archivo no es una imagen válida.')); };
        img.src = url;
    });
}

/**
 * Sube la imagen de una comunidad (cualquier usuario con sesión). La firma la
 * da /api/cloudinary con carpeta y formatos fijos. Devuelve { url, publicId, bytes }.
 */
export async function subirImagenComunidad(file, { idToken, onProgress } = {}) {
    if (!/^image\//.test(file?.type || '')) throw new Error('Elige un archivo de imagen (JPG, PNG o WebP).');
    if (file.size > 20 * 1024 * 1024) throw new Error('La imagen pesa demasiado (máx. 20 MB).');
    const reducida = await reducirImagen(file);
    const r = await fetch('/api/cloudinary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({ accion: 'firmarImagenComunidad' }),
    });
    const firma = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(firma?.error || `Error ${r.status} al pedir la firma.`);
    return enviarACloudinary(firma.cloud, {
        api_key: firma.apiKey,
        timestamp: firma.timestamp,
        signature: firma.signature,
        folder: firma.folder,
        allowed_formats: firma.allowed_formats,
    }, reducida, onProgress, 'image');
}

/**
 * Subida FIRMADA (administrador). El servidor firma con el api_secret y el
 * archivo viaja directo del navegador a Cloudinary, sin pasar por la función
 * serverless ni por ningún preset público.
 * `idToken` es el token de Firebase del admin.
 */
export async function subirModeloFirmado(file, { idToken, carpeta = 'modelos3d', onProgress } = {}) {
    const fallo = validarArchivo(file);
    if (fallo) throw new Error(fallo);

    const r = await fetch('/api/cloudinary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({ accion: 'firmar', carpeta }),
    });
    const firma = await r.json();
    if (!r.ok) throw new Error(firma?.error || `Error ${r.status} al pedir la firma.`);

    return enviarACloudinary(firma.cloud, {
        api_key: firma.apiKey,
        timestamp: firma.timestamp,
        signature: firma.signature,
        folder: firma.folder,
    }, file, onProgress);
}

/**
 * Sube un .glb/.gltf a Cloudinary con un preset unsigned.
 * Devuelve { url, publicId, bytes }. onProgress recibe 0..100.
 */
export function subirModelo(file, { carpeta = 'modelos3d', onProgress } = {}) {
    return new Promise((resolve, reject) => {
        if (!cloudinaryListo()) {
            reject(new Error('Cloudinary no está configurado (VITE_CLOUDINARY_CLOUD / VITE_CLOUDINARY_PRESET).'));
            return;
        }
        const nombre = (file?.name || '').toLowerCase();
        if (!/\.(glb|gltf)$/.test(nombre)) {
            reject(new Error('Solo se admiten archivos .glb o .gltf.'));
            return;
        }
        if (file.size > MAX_MB * 1024 * 1024) {
            reject(new Error(`El modelo pesa ${(file.size / 1048576).toFixed(1)} MB. Optimízalo antes de subirlo (máx. ${MAX_MB} MB).`));
            return;
        }

        const fd = new FormData();
        fd.append('file', file);
        fd.append('upload_preset', CLOUDINARY_PRESET);
        if (carpeta) fd.append('folder', carpeta);

        const xhr = new XMLHttpRequest();
        xhr.open('POST', `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/raw/upload`);
        xhr.upload.onprogress = (e) => {
            if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100));
        };
        xhr.onload = () => {
            let data = {};
            try { data = JSON.parse(xhr.responseText); } catch (_) {}
            if (xhr.status >= 200 && xhr.status < 300 && data.secure_url) {
                resolve({ url: data.secure_url, publicId: data.public_id, bytes: data.bytes });
            } else {
                const err = new Error(data?.error?.message || `Cloudinary respondió ${xhr.status}.`);
                reportarError('cloudinary', err, { estado: xhr.status, tamano: file?.size || 0 });
                reject(err);
            }
        };
        xhr.onerror = () => {
            const err = new Error('No se pudo conectar con Cloudinary.');
            reportarError('cloudinary', err, { red: true, tamano: file?.size || 0 });
            reject(err);
        };
        xhr.send(fd);
    });
}
