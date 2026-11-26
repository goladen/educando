// ─── Ficha PDF de retos Menseki ─────────────────────────────────────────────
// Varios retos por página (1, 2, 4 o 6), con la figura dibujada igual que en
// pantalla (misma geometría: geometriaMenseki.js), casilla de respuesta, pista
// opcional y hoja de soluciones con la explicación paso a paso.
// jsPDF se carga bajo demanda.
import { geometriaReto, PILL_H } from './geometriaMenseki';

const W = 210, H = 297, M = 12;
const PT = 0.3528; // mm por punto tipográfico

const limpiar = (t) => String(t ?? '')
    .replace(/…/g, '...').replace(/[–—−]/g, '-').replace(/→/g, '->').replace(/[“”]/g, '"').replace(/[‘’]/g, "'")
    .replace(/[^\x20-\x7E\xA0-\xFF\n]/g, '');

const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const C = {
    tinta: hex('#1f2937'), borde: hex('#111827'), gris: hex('#64748b'), grisClaro: hex('#cbd5e1'),
    acento: hex('#D97706'), incognita: hex('#FEF3C7'), cota: hex('#475569'), letra: hex('#94a3b8'),
    teal: hex('#0d9488'), indigo: hex('#4338ca'), estrella: hex('#f59e0b'),
};

function estrella(doc, cx, cy, r, relleno) {
    const pts = [];
    for (let i = 0; i < 10; i++) {
        const ang = -Math.PI / 2 + (i * Math.PI) / 5;
        const rr = i % 2 === 0 ? r : r * 0.45;
        pts.push([cx + rr * Math.cos(ang), cy + rr * Math.sin(ang)]);
    }
    const rel = pts.slice(1).map((p, i) => [p[0] - pts[i][0], p[1] - pts[i][1]]);
    doc.setFillColor(...(relleno ? C.estrella : C.grisClaro));
    doc.lines(rel, pts[0][0], pts[0][1], [1, 1], 'F', true);
}

function flecha(doc, xTip, yTip, dx, dy, tam) {
    // triángulo con la punta en (xTip, yTip) apuntando en la dirección (dx, dy)
    const l = Math.hypot(dx, dy) || 1;
    const ux = dx / l, uy = dy / l;
    const bx = xTip - ux * tam, by = yTip - uy * tam;
    doc.triangle(xTip, yTip, bx - uy * tam * 0.45, by + ux * tam * 0.45, bx + uy * tam * 0.45, by - ux * tam * 0.45, 'F');
}

// Dibuja la figura del reto dentro de la caja (x, y, w, h) en mm.
function dibujarFigura(doc, reto, bx, by, bw, bh) {
    const { vb, cotas } = geometriaReto(reto);
    const s = Math.min(bw / vb[2], bh / vb[3]);
    const ox = bx + (bw - vb[2] * s) / 2 - vb[0] * s;
    const oy = by + (bh - vb[3] * s) / 2 - vb[1] * s;
    const X = (v) => ox + v * s, Y = (v) => oy + v * s;
    const U = 90;

    // Rectángulos (relleno)
    for (const r of reto.rects) {
        const x = X(r.x * U), y = Y(r.y * U), w = r.w * U * s, h = r.h * U * s;
        if (r.area === '?') { doc.setFillColor(...C.incognita); doc.rect(x, y, w, h, 'F'); }
    }
    // Bordes
    doc.setLineDashPattern([], 0);
    for (const r of reto.rects) {
        const x = X(r.x * U), y = Y(r.y * U), w = r.w * U * s, h = r.h * U * s;
        doc.setDrawColor(...(r.area === '?' ? C.acento : C.borde));
        doc.setLineWidth(r.area === '?' ? 0.7 : 0.55);
        doc.rect(x, y, w, h, 'S');
    }
    // Textos de los rectángulos
    for (const r of reto.rects) {
        const x = X(r.x * U), y = Y(r.y * U), w = r.w * U * s, h = r.h * U * s;
        const cx = x + w / 2, cy = y + h / 2;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(Math.max(6, Math.min(9, 15 * s / PT)));
        doc.setTextColor(...C.letra);
        doc.text(r.id, x + 1.4, y + 1.2, { baseline: 'top' });
        if (r.area === '?') {
            doc.setFontSize(Math.max(14, Math.min(34, Math.min(w, h) * 0.55 / PT)));
            doc.setTextColor(...C.acento);
            doc.text('?', cx, cy, { align: 'center', baseline: 'middle' });
        } else if (typeof r.area === 'number') {
            const fsPx = Math.max(14, Math.min(28, (r.w * U) / 4.3, (r.h * U) / 2.4));
            doc.setFontSize(Math.max(8, Math.min(16, fsPx * s / PT)));
            doc.setTextColor(...C.tinta);
            doc.text(limpiar(`${r.area} cm²`), cx, cy, { align: 'center', baseline: 'middle' });
        }
    }
    // Cotas: primero las líneas, luego las pastillas
    const tope = 9 * s, tamFlecha = Math.max(1.2, 7 * s);
    for (const d of cotas) {
        const inc = d.c.valor === '?';
        const col = inc ? C.acento : C.cota;
        doc.setDrawColor(...col); doc.setFillColor(...col);
        const ux = Math.sign(d.ox), uy = Math.sign(d.oy);
        doc.setLineWidth(0.2); doc.setLineDashPattern([0.8, 0.6], 0);
        doc.line(X(d.x1 + ux * 4), Y(d.y1 + uy * 4), X(d.x1 + d.ox + ux * 8), Y(d.y1 + d.oy + uy * 8));
        doc.line(X(d.x2 + ux * 4), Y(d.y2 + uy * 4), X(d.x2 + d.ox + ux * 8), Y(d.y2 + d.oy + uy * 8));
        doc.setLineDashPattern([], 0); doc.setLineWidth(0.35);
        const ax = X(d.x1 + d.ox), ay = Y(d.y1 + d.oy), bx2 = X(d.x2 + d.ox), by2 = Y(d.y2 + d.oy);
        doc.line(ax, ay, bx2, by2);
        flecha(doc, ax, ay, ax - bx2, ay - by2, tamFlecha);
        flecha(doc, bx2, by2, bx2 - ax, by2 - ay, tamFlecha);
        if (d.horizontal) { doc.line(ax, ay - tope, ax, ay + tope); doc.line(bx2, by2 - tope, bx2, by2 + tope); }
        else { doc.line(ax - tope, ay, ax + tope, ay); doc.line(bx2 - tope, by2, bx2 + tope, by2); }
    }
    for (const d of cotas) {
        const inc = d.c.valor === '?';
        const fs = Math.max(7, Math.min(11, (inc ? 21 : 17) * s / PT));
        doc.setFont('helvetica', 'bold'); doc.setFontSize(fs);
        const txt = limpiar(d.txt);
        const ph = Math.max(PILL_H * s, fs * PT * 1.5);
        const pw = Math.max(ph * 1.4, doc.getTextWidth(txt) + ph * 0.9);
        const cx = X(d.px), cy = Y(d.py);
        doc.setLineWidth(inc ? 0.45 : 0.3);
        doc.setDrawColor(...(inc ? C.acento : C.cota));
        doc.setFillColor(...(inc ? C.incognita : [255, 255, 255]));
        doc.roundedRect(cx - pw / 2, cy - ph / 2, pw, ph, ph / 2, ph / 2, 'FD');
        doc.setTextColor(...(inc ? C.acento : C.tinta));
        doc.text(txt, cx, cy, { align: 'center', baseline: 'middle' });
    }
}

function cabecera(doc, titulo, subtitulo, color, conNombre = true) {
    doc.setFillColor(...color); doc.rect(0, 0, W, 4, 'F');
    doc.setTextColor(...C.tinta);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(16);
    doc.text(limpiar(titulo), M, M + 5);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); doc.setTextColor(...C.gris);
    doc.text(limpiar(subtitulo), M, M + 10.5);
    if (!conNombre) return M + 16;
    doc.setDrawColor(...C.grisClaro); doc.setLineWidth(0.3);
    doc.setTextColor(55, 65, 81); doc.setFontSize(10);
    doc.text('Nombre:', M, M + 18); doc.line(M + 16, M + 18.5, M + 110, M + 18.5);
    doc.text('Curso:', M + 116, M + 18); doc.line(M + 129, M + 18.5, M + 152, M + 18.5);
    doc.text('Fecha:', M + 156, M + 18); doc.line(M + 168, M + 18.5, W - M, M + 18.5);
    return M + 24;
}

function pie(doc) {
    const n = doc.getNumberOfPages();
    for (let p = 1; p <= n; p++) {
        doc.setPage(p);
        doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(148, 163, 184);
        doc.text('pikt.es/primaria/menseki · Menseki, laberintos de áreas · Dibujos no a escala', M, H - 7);
        doc.text(`${p} / ${n}`, W - M, H - 7, { align: 'right' });
    }
}

const DISPOSICION = { 1: [1, 1], 2: [1, 2], 4: [2, 2], 6: [2, 3] };

/**
 * @param {object} op
 * @param {Array}  op.retos          retos con el formato de MENSEKI_BASE
 * @param {1|2|4|6} [op.porPagina]
 * @param {boolean} [op.conPista]
 * @param {boolean} [op.conSoluciones]
 * @param {string}  [op.titulo]
 * @param {'descargar'|'url'} [op.salida]  'url' devuelve un blob URL en vez de descargar
 */
export async function descargarFichaMenseki({ retos, porPagina = 4, conPista = false, conSoluciones = true, titulo = 'Menseki · Laberintos de áreas', salida = 'descargar' }) {
    if (!retos?.length) return;
    const { jsPDF } = await import('jspdf');
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const [cols, filas] = DISPOSICION[porPagina] || DISPOSICION[4];
    const sub = 'Calcula la medida marcada con ? usando las áreas y los lados que conoces. Los dibujos no están a escala.';
    const hueco = 4;

    for (let i = 0; i < retos.length; i++) {
        const enPag = i % (cols * filas);
        if (enPag === 0 && i > 0) doc.addPage();
        if (enPag === 0) cabecera(doc, titulo, sub, C.teal); // cabecera en todas las páginas
        const y0 = M + 24;
        const anchoCelda = (W - 2 * M - hueco * (cols - 1)) / cols;
        const altoCelda = (H - y0 - 12 - hueco * (filas - 1)) / filas;
        const col = enPag % cols, fila = Math.floor(enPag / cols);
        const x = M + col * (anchoCelda + hueco), y = y0 + fila * (altoCelda + hueco);
        const r = retos[i];

        doc.setDrawColor(...C.grisClaro); doc.setLineWidth(0.3); doc.setLineDashPattern([], 0);
        doc.roundedRect(x, y, anchoCelda, altoCelda, 3, 3, 'S');
        // número + título + estrellas
        const colorEt = r.nivel === 'secundaria' ? C.indigo : C.teal;
        doc.setFillColor(...colorEt); doc.roundedRect(x + 3, y + 3, 9, 6, 1.5, 1.5, 'F');
        doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(9);
        doc.text(String(i + 1), x + 7.5, y + 6.1, { align: 'center', baseline: 'middle' });
        doc.setTextColor(...C.tinta); doc.setFontSize(10.5);
        const maxTit = anchoCelda - 16 - 26;
        doc.text(doc.splitTextToSize(limpiar(r.titulo), maxTit)[0], x + 14, y + 6.3, { baseline: 'middle' });
        for (let k = 0; k < 5; k++) estrella(doc, x + anchoCelda - 23 + k * 4.4, y + 6, 1.8, k < r.dificultad);

        // pie de la casilla: pista + respuesta
        let pieAlto = 11;
        let lineasPista = [];
        if (conPista && r.pista) {
            doc.setFont('helvetica', 'italic'); doc.setFontSize(8);
            lineasPista = doc.splitTextToSize(limpiar(`Pista: ${r.pista}`), anchoCelda - 8).slice(0, 3);
            pieAlto += lineasPista.length * 3.4 + 1;
        }
        const yPie = y + altoCelda - pieAlto;
        if (lineasPista.length) {
            doc.setTextColor(120, 53, 15);
            doc.text(lineasPista, x + 4, yPie + 2.5);
        }
        doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(...C.tinta);
        const yResp = y + altoCelda - 4.5;
        doc.text('? =', x + 4, yResp);
        doc.setDrawColor(...C.gris); doc.setLineWidth(0.3);
        doc.line(x + 12, yResp + 0.6, x + Math.min(anchoCelda - 16, 60), yResp + 0.6);
        doc.text(limpiar(r.unidad), x + Math.min(anchoCelda - 16, 60) + 1.5, yResp);

        // figura
        dibujarFigura(doc, r, x + 3, y + 11, anchoCelda - 6, yPie - (y + 11) - 1);
    }

    if (conSoluciones) {
        doc.addPage();
        let y = cabecera(doc, 'Soluciones', 'Menseki · explicación paso a paso de cada reto', C.indigo, false);
        for (let i = 0; i < retos.length; i++) {
            const r = retos[i];
            const pasos = String(r.explicacion || '').split(/(?<=\.)\s+(?=[A-ZÁÉÍÓÚÑ0-9(])/).filter(Boolean);
            doc.setFontSize(9);
            const lineas = pasos.map(p => doc.splitTextToSize(limpiar(p), W - 2 * M - 10));
            const alto = 6 + lineas.reduce((s, l) => s + l.length * 3.9, 0) + 3;
            if (y + alto > H - 14) { doc.addPage(); y = cabecera(doc, 'Soluciones', 'Menseki · explicación paso a paso de cada reto', C.indigo, false); }
            doc.setFont('helvetica', 'bold'); doc.setFontSize(10.5); doc.setTextColor(...C.tinta);
            doc.text(limpiar(`${i + 1}. ${r.titulo}`), M, y + 4);
            doc.setTextColor(21, 128, 61);
            doc.text(limpiar(`Solución: ${r.solucion} ${r.unidad}`), W - M, y + 4, { align: 'right' });
            y += 6;
            doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(55, 65, 81);
            lineas.forEach((l, k) => {
                doc.text(`${k + 1})`, M + 3, y + 3);
                doc.text(l, M + 9, y + 3);
                y += l.length * 3.9;
            });
            y += 3;
            doc.setDrawColor(...C.grisClaro); doc.setLineWidth(0.2); doc.line(M, y - 1.5, W - M, y - 1.5);
        }
    }

    pie(doc);
    if (salida === 'url') return doc.output('bloburl');
    doc.save(`menseki-${retos.length}-retos.pdf`);
    return null;
}
