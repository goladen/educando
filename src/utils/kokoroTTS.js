// Voz Kokoro-82M generada en el navegador (worker en public/kokoro/kokoro-worker.js).
// Alternativa a Edge TTS (api/listening-tts.js) para el Listening del profesor:
// no depende del servicio de Microsoft ni del límite de tiempo de Vercel.
//
//   generarKokoro({ texto, idioma, voz, voz2, dialogo, velocidad }, onProgreso)
//     → { mp3: Blob, duracion, dispositivo }
//   subirAudioListening(blob, { anterior, token }) → { url, publicId, bytes, duracion }
//
// Las voces se guardan en el recurso con el prefijo «kokoro:» (p. ej.
// 'kokoro:bf_emma') para distinguirlas de las de Edge.

export const PREFIJO_KOKORO = 'kokoro:';
export const esVozKokoro = (v) => typeof v === 'string' && v.startsWith(PREFIJO_KOKORO);
const vozModelo = (v) => String(v).slice(PREFIJO_KOKORO.length);

// Velocidad del recurso (rate de Edge) → speed de Kokoro
const SPEED = { '-25%': 0.8, '-10%': 0.9, '+0%': 1 };

const SR = 24000;
const PAUSA_TURNO = 0.45;   // s de silencio entre intervenciones del diálogo
const PAUSA_TROZO = 0.12;   // s entre trozos de una misma intervención

// Un worker con sus peticiones pendientes
function crearHilo() {
    const w = new Worker('/kokoro/kokoro-worker.js', { type: 'module' });
    const pend = new Map();
    let sec = 0;
    const fallarTodo = (err) => { pend.forEach(p => p.reject(err)); pend.clear(); };
    w.onmessage = (e) => {
        const m = e.data || {};
        const p = pend.get(m.id);
        if (!p) return;
        if (m.tipo === 'progreso') { p.onProgreso?.(m); return; }
        pend.delete(m.id);
        if (m.tipo === 'error') p.reject(new Error(m.mensaje || 'No se pudo generar la voz.'));
        else p.resolve(m);
    };
    w.onerror = (e) => {
        e.preventDefault?.();
        fallarTodo(new Error('No se pudo cargar el motor de voz Kokoro' + (e?.message ? `: ${e.message}` : '.')));
        hilo.roto = true;
    };
    const hilo = {
        roto: false,
        pedir: (msg, onProgreso, transfer = []) => new Promise((resolve, reject) => {
            const id = ++sec;
            pend.set(id, { resolve, reject, onProgreso });
            w.postMessage({ ...msg, id }, transfer);
        }),
        cerrar: () => { fallarTodo(new Error('Cancelado')); w.terminate(); },
    };
    return hilo;
}

let principal = null;   // se queda vivo entre generaciones (modelo ya cargado)
const hiloPrincipal = () => {
    if (!principal || principal.roto) principal = crearHilo();
    return principal;
};

// Nº de workers en paralelo cuando no hay WebGPU (cada uno carga el modelo, ~300 MB de RAM)
function hilosWasm() {
    const nucleos = navigator.hardwareConcurrency || 4;
    const memoria = navigator.deviceMemory || 4;
    return Math.max(1, Math.min(Math.floor(nucleos / 2), memoria >= 8 ? 4 : 2));
}

const frasesDe = (t) => (t.match(/[^.!?…]+[.!?…]*/g) || [t]).map(x => x.trim()).filter(Boolean);

function agrupar(piezas, max) {
    const grupos = [];
    let actual = '';
    for (const p of piezas) {
        if (actual && (actual + ' ' + p).length > max) { grupos.push(actual); actual = ''; }
        actual = actual ? actual + ' ' + p : p;
    }
    if (actual.trim()) grupos.push(actual);
    return grupos;
}

// Trozos de texto que el modelo puede leer de una vez (≈510 fonemas como máximo)
export function trocearKokoro(texto, idioma) {
    const max = idioma === 'en' ? 300 : 240;
    const piezas = frasesDe(texto).flatMap(f => {
        if (f.length <= max) return [f];
        const comas = f.split(/(?<=[,;:])s+/);
        return agrupar(comas.length > 1 ? comas : f.split(/s+/), max);
    });
    return agrupar(piezas, max);
}

// Igual que planificar() de api/listening-tts.js: en un diálogo cada línea
// «Nombre: frase» se lee con la voz de su personaje (1º = voz, 2º = voz2, y se
// alternan si hay más); el nombre no se locuta. Las líneas sin personaje, con la voz 1.
export function segmentosKokoro(texto, voz, voz2, dialogo) {
    const limpio = String(texto || '').replace(/[ \t]+/g, ' ').trim();
    if (!dialogo) return limpio ? [{ voz: vozModelo(voz), texto: limpio }] : [];
    const voces = [voz, voz2 || voz].map(vozModelo);
    const personajes = [];
    const segs = [];
    for (const linea of limpio.split(/\n+/)) {
        const l = linea.trim();
        if (!l) continue;
        const m = l.match(/^(\p{L}[\p{L} .'-]{0,28}):\s*(.+)$/u);
        if (m) {
            const nombre = m[1].trim().toLowerCase();
            if (!personajes.includes(nombre)) personajes.push(nombre);
            segs.push({ voz: voces[personajes.indexOf(nombre) % 2], texto: m[2] });
        } else {
            segs.push({ voz: voces[0], texto: l });
        }
    }
    return segs;
}

export async function generarKokoro({ texto, idioma, voz, voz2, dialogo, velocidad }, onProgreso) {
    const segmentos = segmentosKokoro(texto, voz, voz2, dialogo);
    const plan = [];
    segmentos.forEach((seg, n) => trocearKokoro(seg.texto, idioma).forEach((t, i) => plan.push({
        voz: seg.voz, texto: t, pausa: i === 0 ? (n > 0 ? PAUSA_TURNO : 0) : PAUSA_TROZO,
    })));
    if (!plan.length) throw new Error('El texto está vacío.');
    const speed = SPEED[velocidad] ?? 0.9;
    const avisar = (m) => { try { onProgreso?.(m); } catch { /* UI */ } };
    const resultados = new Array(plan.length);
    let hechos = 0;
    const pedirTrozo = async (hilo, i, extra = {}) => {
        // Solo el principal informa de la descarga (los demás leen el modelo de la caché)
        const r = await hilo.pedir({ tipo: 'trozo', idioma, voz: plan[i].voz, texto: plan[i].texto, speed, ...extra },
            hilo === principal ? avisar : null);
        resultados[i] = new Float32Array(r.pcm);
        avisar({ fase: 'voz', hecho: ++hechos, total: plan.length });
        return r.dispositivo;
    };

    // El 1er trozo, en el worker principal: carga el modelo y dice si hay WebGPU
    const hilo0 = hiloPrincipal();
    const dispositivo = await pedirTrozo(hilo0, 0);
    let sig = 1;
    const extras = [];
    try {
        if (dispositivo === 'wasm' && plan.length > 2) {
            for (let k = 1; k < Math.min(hilosWasm(), plan.length - 1); k++) extras.push(crearHilo());
        }
        await Promise.all([hilo0, ...extras].map(async (hilo, k) => {
            while (sig < plan.length) {
                const i = sig++;
                await pedirTrozo(hilo, i, k ? { dispositivo: 'wasm' } : {});
            }
        }));
    } finally {
        extras.forEach(h => h.cerrar());
    }

    // Unir con las pausas y pasar a MP3 (en el worker)
    const partes = [];
    plan.forEach((p, i) => { if (p.pausa) partes.push(new Float32Array(Math.round(p.pausa * SR))); partes.push(resultados[i]); });
    partes.push(new Float32Array(Math.round(0.3 * SR)));
    const muestras = new Float32Array(partes.reduce((a, p) => a + p.length, 0));
    let o = 0;
    for (const p of partes) { muestras.set(p, o); o += p.length; }
    const duracion = muestras.length / SR;
    avisar({ fase: 'mp3' });
    const { mp3 } = await hilo0.pedir({ tipo: 'mp3', pcm: muestras.buffer }, null, [muestras.buffer]);
    return { mp3: new Blob([mp3], { type: 'audio/mpeg' }), duracion, dispositivo };
}

// Sube el mp3 directamente a Cloudinary con una firma de api/listening-tts.js
// (carpeta listening/<uid>) y borra el audio anterior si lo había.
export async function subirAudioListening(blob, { anterior = null, token }) {
    const api = (cuerpo) => fetch('/api/listening-tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(cuerpo),
    }).then(async r => {
        const res = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(res.error || `Error ${r.status}`);
        return res;
    });

    const f = await api({ accion: 'firmarSubida' });
    const form = new FormData();
    form.append('file', blob, 'listening.mp3');
    form.append('api_key', f.apiKey);
    form.append('timestamp', String(f.timestamp));
    form.append('folder', f.folder);
    form.append('signature', f.signature);
    const r = await fetch(`https://api.cloudinary.com/v1_1/${f.cloud}/video/upload`, { method: 'POST', body: form });
    const subida = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(subida?.error?.message || 'Error al subir el audio a Cloudinary');

    if (anterior && anterior !== subida.public_id) {
        api({ accion: 'borrar', publicId: anterior }).catch(() => { /* no es crítico */ });
    }
    return { url: subida.secure_url, publicId: subida.public_id, bytes: subida.bytes || blob.size, duracion: subida.duration || null };
}
