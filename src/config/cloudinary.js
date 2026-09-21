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
function enviarACloudinary(cloud, campos, file, onProgress) {
    return new Promise((resolve, reject) => {
        const fd = new FormData();
        fd.append('file', file);
        Object.entries(campos).forEach(([k, v]) => fd.append(k, v));

        const xhr = new XMLHttpRequest();
        xhr.open('POST', `https://api.cloudinary.com/v1_1/${cloud}/raw/upload`);
        xhr.upload.onprogress = (e) => {
            if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100));
        };
        xhr.onload = () => {
            let data = {};
            try { data = JSON.parse(xhr.responseText); } catch (_) {}
            if (xhr.status >= 200 && xhr.status < 300 && data.secure_url) {
                resolve({ url: data.secure_url, publicId: data.public_id, bytes: data.bytes });
            } else {
                reject(new Error(data?.error?.message || `Cloudinary respondió ${xhr.status}.`));
            }
        };
        xhr.onerror = () => reject(new Error('No se pudo conectar con Cloudinary.'));
        xhr.send(fd);
    });
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
                reject(new Error(data?.error?.message || `Cloudinary respondió ${xhr.status}.`));
            }
        };
        xhr.onerror = () => reject(new Error('No se pudo conectar con Cloudinary.'));
        xhr.send(fd);
    });
}
