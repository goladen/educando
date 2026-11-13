// PDF A4 a partir de un nodo HTML con bloques [data-bloque]: cada bloque se
// captura con html2canvas y se coloca en la página; si no cabe, página nueva.
// Lo usan las fichas imprimibles (fichas/FichasImprimibles.jsx) y la ficha de
// los simuladores de física (ecuaciones/FichaSimulador.jsx).
// Devuelve { pdf, archivo }: quien llama decide si lo descarga o lo muestra.
export async function generarPdfBloques(nodo, nombre) {
    const [{ jsPDF }, html2canvas] = await Promise.all([import('jspdf'), import('html2canvas').then((m) => m.default)]);
    const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
    const W = 210, H = 297, M = 12, ancho = W - 2 * M;
    let y = M;
    for (const b of nodo.querySelectorAll('[data-bloque]')) {
        // useCORS: imágenes de otras webs (banderas…)
        const canvas = await html2canvas(b, { scale: 2, backgroundColor: '#ffffff', logging: false, useCORS: true });
        const h = (canvas.height * ancho) / canvas.width;
        // data-pagina: el bloque empieza siempre en una página nueva (p. ej. las soluciones)
        if ((b.dataset.pagina && y > M) || (y + h > H - M && y > M)) { pdf.addPage(); y = M; }
        pdf.addImage(canvas.toDataURL('image/jpeg', 0.92), 'JPEG', M, y, ancho, h);
        y += h;
    }
    const total = pdf.getNumberOfPages();
    for (let i = 1; i <= total; i++) {
        pdf.setPage(i); pdf.setFontSize(8); pdf.setTextColor(150);
        pdf.text(`${i} / ${total}`, W / 2, H - 5, { align: 'center' });
    }
    return { pdf, archivo: `${(nombre || 'ficha').replace(/[^\wáéíóúñü -]/gi, '').trim().replace(/\s+/g, '_') || 'ficha'}.pdf` };
}
