// Captura de la zona animada de un simulador (para ilustrar su ficha PDF).
// Busca dentro de `raiz` el <svg> o <canvas> visible más grande:
//  · <canvas> (2D o WebGL): se lee en un requestAnimationFrame, es decir, en el mismo
//    fotograma en que el simulador acaba de pintar (si no, WebGL lo devuelve vacío).
//  · <svg> (y lo que tenga encima): html2canvas de su contenedor.
// Devuelve una dataURL PNG o null si no se pudo.

const visible = (el) => {
    const r = el.getBoundingClientRect();
    return r.width > 180 && r.height > 120 ? r : null;
};

// ¿Imagen vacía (todo transparente o de un solo color)?
const esVacia = (url) => new Promise((res) => {
    const img = new Image();
    img.onload = () => {
        try {
            const c = document.createElement('canvas');
            c.width = 40; c.height = 30;
            const x = c.getContext('2d');
            x.drawImage(img, 0, 0, 40, 30);
            const d = x.getImageData(0, 0, 40, 30).data;
            let distintos = 0;
            for (let i = 4; i < d.length; i += 4) {
                if (Math.abs(d[i] - d[0]) + Math.abs(d[i + 1] - d[1]) + Math.abs(d[i + 2] - d[2]) + Math.abs(d[i + 3] - d[3]) > 24) distintos++;
            }
            res(distintos < 12);
        } catch { res(false); }
    };
    img.onerror = () => res(true);
    img.src = url;
});

export async function capturarSimulacion(raiz) {
    if (!raiz) return null;
    const cands = [...raiz.querySelectorAll('svg, canvas')]
        .filter((el) => !el.closest('button'))
        .map((el) => ({ el, r: visible(el) }))
        .filter((c) => c.r);
    if (!cands.length) return null;
    cands.sort((a, b) => b.r.width * b.r.height - a.r.width * a.r.height);
    const { el } = cands[0];
    try {
        if (el.tagName.toLowerCase() === 'canvas') {
            const url = await new Promise((res) => requestAnimationFrame(() => {
                try { res(el.toDataURL('image/png')); } catch { res(null); }
            }));
            if (url && !(await esVacia(url))) return url;
            return null;
        }
        const html2canvas = (await import('html2canvas')).default;
        // el contenedor directo suele incluir etiquetas y medidores dibujados encima
        const padre = el.parentElement;
        const rp = padre?.getBoundingClientRect();
        const objetivo = padre && rp.height < el.getBoundingClientRect().height * 1.6 && rp.width < el.getBoundingClientRect().width * 1.6 ? padre : el;
        const canvas = await html2canvas(objetivo, { scale: 1.5, backgroundColor: '#ffffff', logging: false, useCORS: true });
        const url = canvas.toDataURL('image/png');
        return (await esVacia(url)) ? null : url;
    } catch (e) {
        console.warn('[captura simulador]', e);
        return null;
    }
}
