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

// Captura el elemento y abre el diálogo de impresión del navegador con la imagen
// (permite "Guardar como PDF" o imprimir en papel, respetando la vista actual).
export async function imprimirElemento(el, titulo = '') {
    const canvas = await capturar(el);
    const img = canvas.toDataURL('image/png');
    const w = window.open('', '_blank');
    if (!w) { alert('Permite las ventanas emergentes para imprimir.'); return; }
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${titulo}</title>
<style>@page{margin:8mm}html,body{margin:0;padding:0}img{width:100%;height:auto;display:block}</style></head>
<body><img src="${img}" onload="setTimeout(function(){window.focus();window.print();},150)"></body></html>`);
    w.document.close();
}

// Abre el diálogo oficial "Compartir en Classroom" con un enlace (Classroom no admite
// subir archivos por URL; comparte un enlace público al recurso).
export function compartirClassroom(url, titulo = '') {
    const u = `https://classroom.google.com/share?url=${encodeURIComponent(url)}&title=${encodeURIComponent(titulo)}`;
    window.open(u, '_blank', 'width=600,height=640,noopener');
}
