// Captura de una zona de la pantalla para el anotador (lápiz de la web).
//
// Plan A (ordenador, Chrome/Edge/Firefox): un fotograma REAL de la pestaña con
// getDisplayMedia. Incluye todo tal cual se ve: imágenes de otras webs (que
// html2canvas no puede copiar por CORS), 3D/WebGL, vídeos y los trazos del lápiz.
// Pide permiso cada vez («Compartir esta pestaña»).
//
// Plan B (móvil/tablet, o si se deniega el permiso): html2canvas. Antes de
// renderizar se sanean en el clon las funciones de color modernas (color-mix(),
// oklch()…) porque html2canvas 1.4.1 aborta con ellas. Las imágenes de otras
// webs sin cabecera CORS no salen en este modo.

const FN_COLOR = /(color-mix|oklch|oklab|lab|lch|color)\(/gi;

let ctxColor = null;
const resolverColor = (css) => {
    try {
        if (!ctxColor) {
            const c = document.createElement('canvas');
            c.width = c.height = 1;
            ctxColor = c.getContext('2d', { willReadFrequently: true });
        }
        ctxColor.clearRect(0, 0, 1, 1);
        ctxColor.fillStyle = '#000000';
        ctxColor.fillStyle = css;           // si el navegador no lo entiende, se queda en negro
        ctxColor.fillRect(0, 0, 1, 1);
        const [r, g, b, a] = ctxColor.getImageData(0, 0, 1, 1).data;
        return `rgba(${r}, ${g}, ${b}, ${+(a / 255).toFixed(3)})`;
    } catch (_) {
        return 'transparent';
    }
};

/** Reemplaza cada función de color moderna (con paréntesis anidados) por rgba(). */
export const sanearColores = (texto) => {
    if (!texto) return texto;
    FN_COLOR.lastIndex = 0;
    if (!FN_COLOR.test(texto)) return texto;
    FN_COLOR.lastIndex = 0;
    let out = '', i = 0, m;
    while ((m = FN_COLOR.exec(texto))) {
        const prev = texto[m.index - 1];
        if (prev && /[\w-]/.test(prev)) continue;   // p. ej. «xcolor(»
        let j = m.index + m[0].length, prof = 1;
        while (j < texto.length && prof > 0) {
            if (texto[j] === '(') prof++;
            else if (texto[j] === ')') prof--;
            j++;
        }
        out += texto.slice(i, m.index) + resolverColor(texto.slice(m.index, j));
        i = j;
        FN_COLOR.lastIndex = j;
    }
    return out + texto.slice(i);
};

const sanearDocumento = (docClon) => {
    const hojas = Array.from(document.styleSheets);
    docClon.querySelectorAll('link[rel="stylesheet"]').forEach((link) => {
        const hoja = hojas.find(h => h.href && h.href === link.href);
        if (!hoja) return;
        try {
            const css = Array.from(hoja.cssRules).map(r => r.cssText).join('\n');
            const st = docClon.createElement('style');
            st.textContent = sanearColores(css);
            link.replaceWith(st);
        } catch (_) { /* hoja de otro origen: se deja tal cual */ }
    });
    docClon.querySelectorAll('style').forEach((st) => {
        const t = st.textContent;
        const s = sanearColores(t);
        if (s !== t) st.textContent = s;
    });
    docClon.querySelectorAll('[style]').forEach((el) => {
        const t = el.getAttribute('style');
        const s = sanearColores(t);
        if (s !== t) el.setAttribute('style', s);
    });
};

const recortar = (fuente, rect, k) => {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(rect.w * k));
    c.height = Math.max(1, Math.round(rect.h * k));
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(fuente, rect.x * k, rect.y * k, rect.w * k, rect.h * k, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', 0.9);   // JPEG: cabe en sessionStorage aunque la zona sea grande
};

export const soportaCapturaPestana = () =>
    typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getDisplayMedia
    && !/Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

// Plan A: fotograma de la pestaña. Debe llamarse justo tras un gesto del usuario.
const zonaDesdePestana = async (rect) => {
    const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { displaySurface: 'browser', frameRate: 30 }, audio: false,
        preferCurrentTab: true, selfBrowserSurface: 'include',
    });
    try {
        const video = document.createElement('video');
        video.muted = true; video.playsInline = true;
        video.srcObject = stream;
        await video.play();
        // deja que se cierre el diálogo de permiso y llegue un fotograma limpio
        await new Promise(r => setTimeout(r, 400));
        const k = (video.videoWidth || window.innerWidth) / window.innerWidth;
        return recortar(video, rect, k);
    } finally {
        stream.getTracks().forEach(t => t.stop());
    }
};

// Plan B: html2canvas de la vista actual (incluye el lienzo del lápiz).
const zonaDesdeHtml2canvas = async (rect) => {
    const h2c = (await import('html2canvas')).default;
    const canvas = await h2c(document.documentElement, {
        scale: 1, logging: false, allowTaint: false, useCORS: true,
        imageTimeout: 2500,
        backgroundColor: '#ffffff',
        x: window.scrollX, y: window.scrollY,
        width: window.innerWidth, height: window.innerHeight,
        scrollX: -window.scrollX, scrollY: -window.scrollY,
        windowWidth: window.innerWidth, windowHeight: window.innerHeight,
        ignoreElements: (el) => el?.dataset?.anotadorUi === '1',
        onclone: (docClon) => { try { sanearDocumento(docClon); } catch (_) {} },
    });
    return recortar(canvas, rect, canvas.width / window.innerWidth);
};

/**
 * Devuelve una data: URL (PNG) de la zona `rect` ({x,y,w,h} en px de la ventana),
 * tal como se ve con los trazos del lápiz encima, o null si no se pudo.
 * `antesDeCapturar` / `despuesDeCapturar` permiten ocultar la barra del lápiz.
 */
export async function capturarZona(rect, { antesDeCapturar, despuesDeCapturar } = {}) {
    if (soportaCapturaPestana()) {
        try {
            await antesDeCapturar?.();
            return await zonaDesdePestana(rect);
        } catch (e) {
            console.warn('[anotador] captura de pestaña no disponible, se usa html2canvas:', e?.message || e);
        } finally {
            await despuesDeCapturar?.();
        }
    }
    try {
        return await zonaDesdeHtml2canvas(rect);
    } catch (e) {
        console.warn('[anotador] html2canvas falló:', e);
        return null;
    }
}
