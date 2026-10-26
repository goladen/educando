// Ficha imprimible (PDF A4) de Ovni Abducción para trabajar el contenido antes
// de jugar en clase: un ejercicio «rodea los que abduce el ovni» por ronda,
// una tabla de clasificación (si el contenido son categorías de palabras) y
// una hoja de soluciones con la explicación de cada trampa.
// jsPDF se carga bajo demanda para no engordar el bundle del juego.

const W = 210;
const H = 297;
const M = 14;
const ANCHO = W - 2 * M;

// Helvetica de jsPDF solo trae Latin-1: los superíndices ⁴…⁹ y algunos signos no existen.
const SUP_A_TEXTO = { '⁰': '^0', '⁴': '^4', '⁵': '^5', '⁶': '^6', '⁷': '^7', '⁸': '^8', '⁹': '^9' };
const limpiar = (t) => String(t ?? '')
    .replace(/[⁰⁴⁵⁶⁷⁸⁹]/g, c => SUP_A_TEXTO[c])
    .replace(/−/g, '-').replace(/→/g, '->').replace(/…/g, '...')
    .replace(/[^\x20-\x7E\xA0-\xFF\n]/g, '');

const dibujarOvni = (doc, cx, cy) => {
    doc.setFillColor(207, 250, 254);
    doc.triangle(cx - 3, cy + 2, cx + 3, cy + 2, cx + 9, cy + 16, 'F');
    doc.triangle(cx - 3, cy + 2, cx - 9, cy + 16, cx + 9, cy + 16, 'F');
    doc.setDrawColor(30, 41, 59); doc.setLineWidth(0.5);
    doc.setFillColor(165, 243, 252);
    doc.ellipse(cx, cy - 2.5, 4.5, 4, 'FD');
    doc.setFillColor(203, 213, 225);
    doc.ellipse(cx, cy, 12, 3.4, 'FD');
    doc.setFillColor(34, 211, 238);
    [-7, -3.5, 0, 3.5, 7].forEach(dx => doc.circle(cx + dx, cy + 0.6, 0.8, 'F'));
};

const pie = (doc) => {
    const n = doc.getNumberOfPages();
    for (let p = 1; p <= n; p++) {
        doc.setPage(p);
        doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(148, 163, 184);
        doc.text('pikt.es · Ovni Abducción', M, H - 8);
        doc.text(`${p} / ${n}`, W - M, H - 8, { align: 'right' });
    }
};

/** Texto centrado en una caja, reduciendo la letra si no cabe. */
const textoEnCaja = (doc, txt, x, y, w, h, tamaño = 12) => {
    let fs = tamaño;
    doc.setFontSize(fs);
    while (fs > 7 && doc.getTextWidth(txt) > w - 3) { fs -= 0.5; doc.setFontSize(fs); }
    doc.text(txt, x + w / 2, y + h / 2 + fs * 0.13, { align: 'center' });
};

/**
 * @param {object} o
 * @param {string} o.titulo        contenido (p. ej. «Números (Primaria)»)
 * @param {{objetivo:string, items:{texto:string, correcta:boolean, explicacion?:string}[]}[]} o.rondas
 * @param {Object<string,string[]>|null} o.clasificacion  categorías para la tabla de clasificar
 * @param {boolean} o.soluciones   añadir hoja de soluciones
 * @param {number}  o.escala       tamaño del texto y de las cajas de los ejercicios (1 = normal)
 * @returns {Promise<import('jspdf').jsPDF>}
 */
export async function generarFichaOvni({ titulo, rondas, clasificacion = null, soluciones = true, escala = 1 }) {
    const k = escala;
    const { jsPDF } = await import('jspdf');
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    let y = M;

    const saltoSi = (alto) => {
        if (y + alto > H - 16) { doc.addPage(); y = M + 4; }
    };

    // ── Cabecera ──
    dibujarOvni(doc, W - M - 14, M + 8);
    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(18);
    doc.text('Ovni Abducción · Ficha de preparación', M, y + 6);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(11); doc.setTextColor(71, 85, 105);
    doc.text(limpiar(titulo), M, y + 12.5);
    y += 21;
    doc.setTextColor(15, 23, 42); doc.setFontSize(10.5);
    doc.text('Nombre: ______________________________   Curso: __________   Fecha: __________', M, y);
    y += 7;

    doc.setFillColor(236, 254, 255); doc.setDrawColor(34, 211, 238); doc.setLineWidth(0.4);
    doc.roundedRect(M, y, ANCHO, 15, 3, 3, 'FD');
    doc.setFontSize(10); doc.setTextColor(14, 116, 144);
    doc.setFont('helvetica', 'bold');
    doc.text('Misión:', M + 4, y + 6);
    doc.setFont('helvetica', 'normal');
    doc.text(doc.splitTextToSize('en cada ejercicio, rodea los animales que tiene que abducir el ovni (pueden ser varios). Después, en clase, jugaremos a Ovni Abducción con este mismo contenido.', ANCHO - 22), M + 18, y + 6);
    y += 21;

    // ── Ejercicios «rodea» ──
    const COLS = 4, GAP = 4;
    const wCaja = (ANCHO - GAP * (COLS - 1)) / COLS, hCaja = 11 * k;
    // Con letra pequeña, si todas caben, las 8 cajas van en una sola fila (ocupa la mitad de alto)
    const ancho = (cols) => (ANCHO - GAP * (cols - 1)) / cols;
    const columnasDe = (r) => {
        if (k > 0.85 || r.items.length > 8) return COLS;
        doc.setFont('helvetica', 'normal'); doc.setFontSize(12 * k);
        const cols = r.items.length;
        return r.items.every(it => doc.getTextWidth(limpiar(it.texto)) <= ancho(cols) - 3) ? cols : COLS;
    };
    rondas.forEach((r, i) => {
        const cols = columnasDe(r);
        const wC = ancho(cols);
        const filas = Math.ceil(r.items.length / cols);
        saltoSi(9 * k + filas * (hCaja + 3 * k) + 11 * k + 1);
        doc.setFont('helvetica', 'bold'); doc.setFontSize(12.5 * k); doc.setTextColor(15, 23, 42);
        doc.text(`${i + 1}. Abduce: ${limpiar(r.objetivo)}`, M, y + 5 * k);
        y += 9 * k;
        doc.setFont('helvetica', 'normal'); doc.setDrawColor(30, 41, 59); doc.setLineWidth(0.45);
        r.items.forEach((it, n) => {
            const x = M + (n % cols) * (wC + GAP);
            const yy = y + Math.floor(n / cols) * (hCaja + 3 * k);
            doc.setFillColor(255, 251, 234);
            doc.roundedRect(x, yy, wC, hCaja, 2.5, 2.5, 'FD');
            doc.setTextColor(30, 41, 59);
            textoEnCaja(doc, limpiar(it.texto), x, yy, wC, hCaja, 12 * k);
        });
        y += filas * (hCaja + 3 * k) + 2 * k;
        doc.setFontSize(9.5 * Math.min(k, 1.15)); doc.setTextColor(100, 116, 139);
        doc.text('Elige uno que NO hayas rodeado y explica por qué: ___________________________________________', M, y + 4 * k);
        y += 11 * k;
    });

    // ── Tabla de clasificación (solo con categorías de palabras) ──
    let clasif = null;
    if (clasificacion) {
        const cats = Object.keys(clasificacion).slice(0, 4);
        const porCat = cats.length <= 2 ? 5 : cats.length === 3 ? 4 : 3;
        const palabras = [];
        cats.forEach(c => {
            [...clasificacion[c]].sort(() => Math.random() - 0.5).slice(0, porCat).forEach(p => palabras.push({ p, c }));
        });
        palabras.sort(() => Math.random() - 0.5);
        clasif = { cats, palabras };
        const filasP = Math.ceil(palabras.length / COLS);
        const filasT = Math.max(...cats.map(c => palabras.filter(x => x.c === c).length)) + 1;
        saltoSi(9 * k + filasP * 10 * k + 3 + 9 * k + filasT * 8 * k + 1);
        doc.setFont('helvetica', 'bold'); doc.setFontSize(12.5 * k); doc.setTextColor(15, 23, 42);
        doc.text(`${rondas.length + 1}. Clasifica cada palabra en su categoría`, M, y + 5 * k);
        y += 9 * k;
        doc.setFont('helvetica', 'normal');
        palabras.forEach((w, n) => {
            const x = M + (n % COLS) * (wCaja + GAP);
            const yy = y + Math.floor(n / COLS) * 10 * k;
            doc.setTextColor(30, 41, 59);
            textoEnCaja(doc, `·  ${limpiar(w.p)}`, x, yy, wCaja, 8 * k, 11 * k);
        });
        y += filasP * 10 * k + 3;
        const wCol = ANCHO / cats.length;
        doc.setDrawColor(30, 41, 59); doc.setLineWidth(0.4);
        cats.forEach((c, n) => {
            doc.setFillColor(207, 250, 254);
            doc.rect(M + n * wCol, y, wCol, 9 * k, 'FD');
            doc.setFont('helvetica', 'bold'); doc.setTextColor(14, 116, 144);
            textoEnCaja(doc, limpiar(c), M + n * wCol, y, wCol, 9 * k, 11 * k);
            for (let f = 0; f < filasT; f++) doc.rect(M + n * wCol, y + 9 * k + f * 8 * k, wCol, 8 * k, 'S');
        });
        y += 9 * k + filasT * 8 * k + 6;
    }

    doc.paginasAlumno = doc.getNumberOfPages();

    // ── Soluciones ──
    if (soluciones) {
        doc.addPage(); y = M + 4;
        doc.setFont('helvetica', 'bold'); doc.setFontSize(15); doc.setTextColor(15, 23, 42);
        doc.text('Soluciones (para el profesor)', M, y + 4);
        y += 12;
        rondas.forEach((r, i) => {
            const ok = r.items.filter(it => it.correcta).map(it => limpiar(it.texto)).join(', ');
            const no = r.items.filter(it => !it.correcta).map(it => `${limpiar(it.texto)}${it.explicacion ? ` (${limpiar(it.explicacion)})` : ''}`).join('; ');
            doc.setFontSize(10);
            const lineasNo = doc.splitTextToSize(`No: ${no}`, ANCHO - 6);
            saltoSi(7 + lineasNo.length * 4.4 + 4);
            doc.setFont('helvetica', 'bold'); doc.setTextColor(15, 23, 42); doc.setFontSize(11);
            doc.text(doc.splitTextToSize(`${i + 1}. ${limpiar(r.objetivo)}: ${ok}`, ANCHO), M, y + 4);
            y += 6.5;
            doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); doc.setTextColor(100, 116, 139);
            doc.text(lineasNo, M + 4, y + 3);
            y += lineasNo.length * 4.4 + 4;
        });
        if (clasif) {
            saltoSi(8 + clasif.cats.length * 6);
            doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(15, 23, 42);
            doc.text(`${rondas.length + 1}. Clasificación`, M, y + 4);
            y += 7;
            doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(51, 65, 85);
            clasif.cats.forEach(c => {
                const lineas = doc.splitTextToSize(`${limpiar(c)}: ${clasif.palabras.filter(w => w.c === c).map(w => limpiar(w.p)).join(', ')}`, ANCHO - 4);
                doc.text(lineas, M + 4, y + 3);
                y += lineas.length * 4.6 + 1.5;
            });
        }
    }

    pie(doc);
    return doc;
}
