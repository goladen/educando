// Utilidades para exportar un elemento del DOM a imagen/PDF y compartir en Classroom.
// html2canvas y jspdf se cargan de forma perezosa (solo al exportar) para no
// engordar el bundle inicial.

async function capturar(el) {
    if (!el) throw new Error('No hay nada que exportar.');
    const html2canvas = (await import('html2canvas')).default;
    return html2canvas(el, { backgroundColor: '#ffffff', scale: 2, useCORS: true, logging: false });
}

export async function descargarPNG(el, nombre = 'export') {
    const canvas = await capturar(el);
    const a = document.createElement('a');
    a.href = canvas.toDataURL('image/png');
    a.download = `${nombre}.png`;
    document.body.appendChild(a); a.click(); a.remove();
}

export async function descargarPDF(el, nombre = 'export', opts = {}) {
    const canvas = await capturar(el);
    const { jsPDF } = await import('jspdf');
    const img = canvas.toDataURL('image/png');
    // Orientación forzada ('l' apaisado / 'p' vertical) → página A4 con la imagen ajustada y centrada
    if (opts.orientacion === 'l' || opts.orientacion === 'p') {
        const pdf = new jsPDF({ orientation: opts.orientacion, unit: 'pt', format: 'a4' });
        const pw = pdf.internal.pageSize.getWidth();
        const ph = pdf.internal.pageSize.getHeight();
        const margin = 24;
        const ratio = Math.min((pw - margin * 2) / canvas.width, (ph - margin * 2) / canvas.height);
        const w = canvas.width * ratio, h = canvas.height * ratio;
        pdf.addImage(img, 'PNG', (pw - w) / 2, (ph - h) / 2, w, h);
        pdf.save(`${nombre}.pdf`);
        return;
    }
    // Auto: la página toma el tamaño del propio contenido
    const orientacion = canvas.width >= canvas.height ? 'l' : 'p';
    const pdf = new jsPDF({ orientation: orientacion, unit: 'pt', format: [canvas.width, canvas.height] });
    pdf.addImage(img, 'PNG', 0, 0, canvas.width, canvas.height);
    pdf.save(`${nombre}.pdf`);
}

// Abre el diálogo oficial "Compartir en Classroom" con un enlace (Classroom no admite
// subir archivos por URL; comparte un enlace público al recurso).
export function compartirClassroom(url, titulo = '') {
    const u = `https://classroom.google.com/share?url=${encodeURIComponent(url)}&title=${encodeURIComponent(titulo)}`;
    window.open(u, '_blank', 'width=600,height=640,noopener');
}
