// Puzzle de imágenes en papel: página 1 = tablero para pegar (con guía tenue opcional
// y miniatura de referencia), página 2 = piezas desordenadas para recortar.
// Las piezas miden lo mismo que las casillas del tablero, así encajan al pegarlas.
//   generarPdfPuzzle({ nombre, img, cols, rows, guia, url, descargar })
//   · img: URL de la imagen (asset del proyecto o externa; si no permite CORS se
//     reintenta con el proxy images.weserv.nl)
//   · url: enlace para jugar después el puzzle en pikt.es (se imprime con QR)

const MM = { margen: 16, ancho: 210, alto: 297 };
const ANCHO_UTIL = MM.ancho - MM.margen * 2;
const MORADO = [76, 29, 149];

const seguro = (s) => String(s ?? '').replace(/[^\x20-\x7E\xA0-\xFF]/g, '').trim();

function cargar(src) {
    return new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        const t = setTimeout(() => resolve(null), 12000);
        img.onload = () => { clearTimeout(t); resolve(img); };
        img.onerror = () => { clearTimeout(t); resolve(null); };
        img.src = src;
    });
}

// Imagen lista para leer píxeles (prueba directa y, si no, por el proxy con CORS)
async function cargarImagen(src) {
    let img = await cargar(src);
    if (!img && /^https?:\/\//.test(src)) {
        img = await cargar(`https://images.weserv.nl/?url=${encodeURIComponent(src.replace(/^https?:\/\//, ''))}`);
    }
    if (!img) return null;
    // Comprobamos que el canvas no queda «contaminado» (sin CORS no se puede exportar)
    try {
        const c = document.createElement('canvas'); c.width = c.height = 1;
        c.getContext('2d').drawImage(img, 0, 0); c.toDataURL();
    } catch { return null; }
    return img;
}

// Recorte de la imagen (en px de la imagen) → dataURL JPEG; alpha < 1 = guía tenue sobre blanco
function recorte(img, sx, sy, sw, sh, alpha = 1, maxLado = 900) {
    const esc = Math.min(1, maxLado / Math.max(sw, sh));
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(sw * esc)); c.height = Math.max(1, Math.round(sh * esc));
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
    ctx.globalAlpha = alpha;
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', 0.9);
}

async function cargarQR(url) {
    try {
        const r = await fetch(`https://api.qrserver.com/v1/create-qr-code/?size=300x300&margin=4&data=${encodeURIComponent(url)}`);
        if (!r.ok) return null;
        const blob = await r.blob();
        return await new Promise(res => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.onerror = () => res(null); fr.readAsDataURL(blob); });
    } catch { return null; }
}

export async function generarPdfPuzzle({ nombre = 'Puzzle', img: src, cols = 4, rows = 3, guia = true, url = null, descargar = true }) {
    const img = await cargarImagen(src);
    if (!img) throw new Error('No se pudo leer la imagen (la web donde está no permite usarla). Prueba con otra imagen.');
    const { jsPDF } = await import('jspdf');
    const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
    const W = img.naturalWidth, H = img.naturalHeight;

    // ── Cabecera ──
    let y = MM.margen;
    pdf.setFont('helvetica', 'bold'); pdf.setFontSize(18); pdf.setTextColor(44, 62, 80);
    pdf.text(seguro(`Puzzle: ${nombre}`), MM.margen, y + 6.5);
    y += 11;
    pdf.setFont('helvetica', 'normal'); pdf.setFontSize(10); pdf.setTextColor(90, 90, 90);
    pdf.text('Nombre: ________________________________________   Curso: __________   Fecha: ___________', MM.margen, y + 3);
    y += 8;

    const qr = url ? await cargarQR(url) : null;
    const altoCaja = url ? (qr ? 26 : 15) : 0;
    if (url) {
        pdf.setDrawColor(196, 181, 253); pdf.setFillColor(245, 243, 255); pdf.setLineWidth(0.4);
        pdf.roundedRect(MM.margen, y, ANCHO_UTIL, altoCaja, 3, 3, 'FD');
        pdf.setFont('helvetica', 'bold'); pdf.setFontSize(11.5); pdf.setTextColor(...MORADO);
        pdf.text('Después lo montamos en pikt.es', MM.margen + 5, y + 6.5);
        pdf.setFont('helvetica', 'normal'); pdf.setFontSize(8); pdf.setTextColor(100, 116, 139);
        pdf.text(pdf.splitTextToSize(seguro(url), ANCHO_UTIL - 40).slice(0, 2), MM.margen + 5, y + 11.5);
        if (qr) pdf.addImage(qr, 'PNG', MM.margen + ANCHO_UTIL - 24, y + 1.5, 22, 22);
        y += altoCaja + 3;
    }

    pdf.setFont('helvetica', 'italic'); pdf.setFontSize(10.5); pdf.setTextColor(71, 85, 105);
    pdf.text(pdf.splitTextToSize(`Recorta las ${cols * rows} piezas de la página siguiente y pégalas en su sitio para reconstruir la imagen.`, ANCHO_UTIL - 48), MM.margen, y + 4);

    // Miniatura de referencia (arriba a la derecha de la zona de instrucciones)
    const refW = W >= H ? 40 : 40 * W / H, refH = W >= H ? 40 * H / W : 40;
    pdf.addImage(recorte(img, 0, 0, W, H, 1, 500), 'JPEG', MM.margen + ANCHO_UTIL - refW, y, refW, refH);
    y += refH + 5;

    // ── Tablero ──
    const maxW = ANCHO_UTIL, maxH = MM.alto - MM.margen - 10 - y;
    const esc = Math.min(maxW / W, maxH / H);
    const bw = W * esc, bh = H * esc;
    const cw = bw / cols, ch = bh / rows;
    const x0 = (MM.ancho - bw) / 2, y0 = y;
    if (guia) pdf.addImage(recorte(img, 0, 0, W, H, 0.16, 1400), 'JPEG', x0, y0, bw, bh);
    pdf.setDrawColor(120, 120, 120); pdf.setLineWidth(0.3);
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) pdf.rect(x0 + c * cw, y0 + r * ch, cw, ch, 'S');
    pdf.setDrawColor(...MORADO); pdf.setLineWidth(0.8);
    pdf.rect(x0, y0, bw, bh, 'S');

    // ── Piezas desordenadas para recortar ──
    pdf.addPage();
    pdf.setFont('helvetica', 'bold'); pdf.setFontSize(13); pdf.setTextColor(...MORADO);
    pdf.text('Piezas para recortar', MM.margen, MM.margen + 5);
    const hueco = 5;
    const porFila = Math.max(1, Math.floor((ANCHO_UTIL + hueco) / (cw + hueco)));
    const orden = Array.from({ length: cols * rows }, (_, i) => i);
    for (let i = orden.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [orden[i], orden[j]] = [orden[j], orden[i]]; }
    const anchoFila = porFila * cw + (porFila - 1) * hueco;
    let px = 0, py = MM.margen + 10;
    orden.forEach((pieza, k) => {
        const col = k % porFila;
        if (k > 0 && col === 0) {
            py += ch + hueco;
            if (py + ch > MM.alto - MM.margen - 6) { pdf.addPage(); py = MM.margen; }
        }
        px = (MM.ancho - anchoFila) / 2 + col * (cw + hueco);
        const pc = pieza % cols, pr = Math.floor(pieza / cols);
        pdf.addImage(recorte(img, pc * W / cols, pr * H / rows, W / cols, H / rows), 'JPEG', px, py, cw, ch);
        pdf.setDrawColor(150, 150, 150); pdf.setLineWidth(0.25);
        pdf.setLineDashPattern([1.2, 1], 0);
        pdf.rect(px, py, cw, ch, 'S');
        pdf.setLineDashPattern([], 0);
    });

    const total = pdf.getNumberOfPages();
    for (let i = 1; i <= total; i++) {
        pdf.setPage(i);
        pdf.setFont('helvetica', 'normal'); pdf.setFontSize(8); pdf.setTextColor(170, 170, 170);
        pdf.text(seguro(`pikt.es · Puzzle ${nombre}`), MM.margen, MM.alto - 8);
        pdf.text(`${i} / ${total}`, MM.ancho - MM.margen, MM.alto - 8, { align: 'right' });
    }
    const archivo = seguro(nombre).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase();
    if (descargar) pdf.save(`puzzle-${archivo || 'imagen'}.pdf`);
    return pdf;
}
