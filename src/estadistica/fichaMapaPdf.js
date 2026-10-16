// fichaMapaPdf.js — Ficha imprimible (A4) de un mapa temático del Explorador INE.
//  · «resuelto»: mapa coloreado con título, leyenda, valor de España y fuente.
//  · «colorear»: mapa en blanco numerado + leyenda + tabla de datos para que el alumno lo pinte.
//  · «ambas»:    ficha para colorear + página de solución.
// El mapa se dibuja como SVG (misma geometría que en pantalla) y se rasteriza a PNG para jsPDF.

// SVG del mapa como texto. fills: { cod: color }; numeros: { cod: n } (etiquetas numéricas opcionales)
export function svgMapa(mapa, nivel, fills, { numeros = null, trazo = '#4b5563', fondo = '#ffffff', sinColor = '#ffffff' } = {}) {
    const geo = nivel === 'c' ? mapa.ccaa : mapa.prov;
    const c = mapa.canarias;
    let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${mapa.w} ${mapa.h}" width="${mapa.w}" height="${mapa.h}">`;
    s += `<rect width="${mapa.w}" height="${mapa.h}" fill="${fondo}"/>`;
    s += `<rect x="${c.x}" y="${c.y}" width="${c.w}" height="${c.h}" fill="none" stroke="#9ca3af" stroke-width="1.2"/>`;
    for (const [cod, g] of Object.entries(geo)) {
        const f = fills[cod] || sinColor;
        s += `<path d="${g.d}" fill="${f}" stroke="${trazo}" stroke-width="1" stroke-linejoin="round"/>`;
        if (g.a < 60) s += `<circle cx="${g.lx}" cy="${g.ly}" r="10" fill="${f}" stroke="${trazo}" stroke-width="1.4"/>`;
    }
    if (numeros) {
        for (const [cod, g] of Object.entries(geo)) {
            if (numeros[cod] == null) continue;
            const pequeño = g.a < 60;
            const x = pequeño ? g.lx + 14 : g.lx, y = pequeño ? g.ly + 5 : g.ly + 5;
            s += `<text x="${x}" y="${y}" font-family="Helvetica, Arial, sans-serif" font-size="${nivel === 'c' ? 17 : 14}" font-weight="700" text-anchor="${pequeño ? 'start' : 'middle'}" fill="#111827" stroke="#ffffff" stroke-width="3" paint-order="stroke">${numeros[cod]}</text>`;
        }
    }
    return s + '</svg>';
}

// SVG (texto) → PNG (dataURL) a la escala indicada
function svgAPng(svg, ancho) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }));
        img.onload = () => {
            const k = ancho / img.width;
            const cv = document.createElement('canvas');
            cv.width = Math.round(img.width * k); cv.height = Math.round(img.height * k);
            const ctx = cv.getContext('2d');
            ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, cv.width, cv.height);
            ctx.drawImage(img, 0, 0, cv.width, cv.height);
            URL.revokeObjectURL(url);
            resolve(cv.toDataURL('image/png'));
        };
        img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('No se pudo dibujar el mapa')); };
        img.src = url;
    });
}

const hexARgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));

// datos: { titulo, subtitulo, fuente, espana, nivel, mapa, fills, leyenda:[{color, etiqueta, n}], filas:[{cod, nombre, valorTxt}] }
export async function generarFichaMapa(datos, tipo = 'ambas') {
    const { jsPDF } = await import('jspdf');
    const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
    const W = 210, M = 14;
    const ratio = datos.mapa.h / datos.mapa.w;

    const cabecera = (conAlumno) => {
        let y = M;
        if (conAlumno) {
            pdf.setFont('helvetica', 'normal'); pdf.setFontSize(9.5); pdf.setTextColor(60);
            pdf.text('Nombre: ______________________________________   Curso: ________   Fecha: ___________', M, y);
            y += 8;
        }
        pdf.setFont('helvetica', 'bold'); pdf.setFontSize(16); pdf.setTextColor(17, 24, 39);
        const lt = pdf.splitTextToSize(datos.titulo, W - 2 * M);
        pdf.text(lt, W / 2, y + 2, { align: 'center' });
        y += 2 + lt.length * 6.5;
        pdf.setFont('helvetica', 'normal'); pdf.setFontSize(9.5); pdf.setTextColor(90);
        pdf.text(datos.subtitulo, W / 2, y, { align: 'center' });
        return y + 4;
    };

    // Leyenda: cuadros de color (o vacíos para colorear) en 2 columnas
    const leyenda = (y, { conColor = true, conN = true } = {}) => {
        pdf.setFont('helvetica', 'bold'); pdf.setFontSize(10); pdf.setTextColor(17, 24, 39);
        pdf.text('Leyenda', M, y); y += 5;
        pdf.setFont('helvetica', 'normal'); pdf.setFontSize(9.5);
        const colW = (W - 2 * M) / 2;
        datos.leyenda.forEach((l, i) => {
            const x = M + (i % 2) * colW, yy = y + Math.floor(i / 2) * 7;
            const [r, g, b] = hexARgb(l.color);
            pdf.setDrawColor(75, 85, 99); pdf.setLineWidth(0.3);
            if (conColor) { pdf.setFillColor(r, g, b); pdf.rect(x, yy - 3.8, 9, 5, 'FD'); }
            else pdf.rect(x, yy - 3.8, 9, 5, 'S');
            pdf.setTextColor(30);
            pdf.text(`${l.etiqueta}${conN ? `  (${l.n})` : ''}`, x + 12, yy);
        });
        return y + Math.ceil(datos.leyenda.length / 2) * 7;
    };

    const pie = (y) => {
        pdf.setFont('helvetica', 'italic'); pdf.setFontSize(8); pdf.setTextColor(110);
        const t = pdf.splitTextToSize(`Fuente: ${datos.fuente}.${datos.espana ? `  España: ${datos.espana}.` : ''}  Generado con pikt.es`, W - 2 * M);
        pdf.text(t, M, Math.max(y, 285));
    };

    const paginaResuelta = async () => {
        let y = cabecera(false) + 2;
        const ancho = W - 2 * M;
        const png = await svgAPng(svgMapa(datos.mapa, datos.nivel, datos.fills), 1600);
        pdf.addImage(png, 'PNG', M, y, ancho, ancho * ratio);
        y += ancho * ratio + 6;
        y = leyenda(y);
        pie(y + 4);
    };

    const paginaColorear = async () => {
        let y = cabecera(true);
        pdf.setFont('helvetica', 'normal'); pdf.setFontSize(9.5); pdf.setTextColor(40);
        const terr = datos.nivel === 'c' ? 'comunidad autónoma' : 'provincia';
        pdf.text(`Busca el dato de cada ${terr} en la tabla y colorea el mapa con el color que le corresponde según la leyenda.`, W / 2, y + 1, { align: 'center', maxWidth: W - 2 * M });
        y += 6;
        const numeros = Object.fromEntries(datos.filas.map((f, i) => [f.cod, i + 1]));
        const anchoMapa = datos.nivel === 'c' ? 150 : 128;
        const png = await svgAPng(svgMapa(datos.mapa, datos.nivel, {}, { numeros }), 1600);
        pdf.addImage(png, 'PNG', (W - anchoMapa) / 2, y, anchoMapa, anchoMapa * ratio);
        y += anchoMapa * ratio + 4;
        y = leyenda(y, { conColor: true, conN: false }) + 1;
        // Tabla de datos en 3 columnas (provincias) o 2 (comunidades)
        const cols = datos.nivel === 'c' ? 2 : 3, colW = (W - 2 * M) / cols;
        const porCol = Math.ceil(datos.filas.length / cols), alto = datos.nivel === 'c' ? 4.6 : 4.1;
        pdf.setFontSize(datos.nivel === 'c' ? 8.6 : 7.8);
        datos.filas.forEach((f, i) => {
            const c = Math.floor(i / porCol), r = i % porCol;
            const x = M + c * colW, yy = y + r * alto;
            if (r % 2 === 0) { pdf.setFillColor(243, 244, 246); pdf.rect(x, yy - 3, colW - 2, alto, 'F'); }
            pdf.setFont('helvetica', 'bold'); pdf.setTextColor(30); pdf.text(`${i + 1}`, x + 1, yy);
            pdf.setFont('helvetica', 'normal');
            const nombre = pdf.splitTextToSize(f.nombre, colW - 26)[0];
            pdf.text(nombre, x + 7, yy);
            pdf.text(f.valorTxt, x + colW - 3, yy, { align: 'right' });
        });
        pie(y + porCol * alto + 3);
    };

    if (tipo === 'resuelto') await paginaResuelta();
    else {
        await paginaColorear();
        if (tipo === 'ambas') { pdf.addPage(); await paginaResuelta(); }
    }
    const nombre = datos.titulo.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w]+/g, '_').replace(/^_|_$/g, '').slice(0, 60) || 'mapa';
    pdf.save(`${nombre}.pdf`);
}
