// ─── Fichas PDF del simulador de conducción ─────────────────────────────────
// · 'test'    : examen teórico en papel (3 opciones, señales con imagen),
//               hoja de respuestas y soluciones con la explicación.
// · 'senales' : lámina de señales para identificar (nombre + qué hacer) y soluciones.
// jsPDF se carga bajo demanda.
import { SENALES, SENAL_POR_ID, CATEGORIAS_SENAL, senalDataURL } from './senales';
import { generarTest, TEMAS_TEST } from './preguntasTest';

const W = 210, H = 297, M = 14, ANCHO = W - 2 * M;
const limpiar = (t) => String(t ?? '')
    .replace(/…/g, '...').replace(/[–—−]/g, '-').replace(/[“”]/g, '"').replace(/[‘’]/g, "'")
    .replace(/[^\x20-\x7E\xA0-\xFF\n]/g, '');

function cabecera(doc, titulo, subtitulo) {
    doc.setFillColor(251, 140, 0); doc.rect(0, 0, W, 4, 'F');
    // icono: señal de STOP pequeña
    doc.addImage(senalDataURL('R-2', 160), 'PNG', W - M - 16, M - 2, 16, 16);
    doc.setTextColor(17, 24, 39);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(17);
    doc.text(limpiar(titulo), M, M + 6);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(75, 85, 99);
    doc.text(limpiar(subtitulo), M, M + 12);
    doc.setDrawColor(203, 213, 225); doc.setLineWidth(0.3);
    doc.setTextColor(55, 65, 81); doc.setFontSize(10);
    doc.text('Nombre:', M, M + 21); doc.line(M + 16, M + 21.5, M + 110, M + 21.5);
    doc.text('Curso:', M + 116, M + 21); doc.line(M + 129, M + 21.5, M + 152, M + 21.5);
    doc.text('Fecha:', M + 156, M + 21); doc.line(M + 168, M + 21.5, W - M, M + 21.5);
    return M + 30;
}

function pie(doc, texto) {
    const n = doc.getNumberOfPages();
    for (let p = 1; p <= n; p++) {
        doc.setPage(p);
        doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(148, 163, 184);
        doc.text(`pikt.es/conducir · ${texto}`, M, H - 8);
        doc.text(`${p} / ${n}`, W - M, H - 8, { align: 'right' });
    }
}

function tituloSeccion(doc, y, texto) {
    doc.setFillColor(255, 243, 224); doc.roundedRect(M, y, ANCHO, 9, 2, 2, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.setTextColor(180, 83, 9);
    doc.text(limpiar(texto), M + 3, y + 6.2);
    return y + 13;
}

/**
 * @param {object} o
 * @param {'test'|'senales'} o.tipo
 * @param {number} o.n            nº de preguntas (test) o de señales (lámina)
 * @param {string[]} o.temas      temas del test (vacío = examen mezclado)
 * @param {string[]} o.categorias categorías de señales (vacío = todas)
 * @param {boolean} o.soluciones  añadir hoja de soluciones
 */
export async function generarFichaConduccion({ tipo = 'test', n = 20, temas = [], categorias = [], soluciones = true } = {}) {
    const { jsPDF } = await import('jspdf');
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    if (tipo === 'senales') fichaSenales(doc, { n, categorias, soluciones });
    else fichaTest(doc, { n, temas, soluciones });
    pie(doc, tipo === 'senales' ? 'Señales de tráfico' : 'Test teórico de conducir');
    return doc;
}

function fichaTest(doc, { n, temas, soluciones }) {
    const preguntas = generarTest({ n, temas, modo: temas.length ? 'practica' : 'examen' });
    const nombresTemas = temas.length ? TEMAS_TEST.filter(t => temas.includes(t.id)).map(t => t.nombre).join(', ') : 'Examen tipo DGT (todos los temas)';
    let y = cabecera(doc, 'Test teórico de conducir', `${preguntas.length} preguntas · ${nombresTemas} · Marca una sola respuesta`);
    const IMG = 24;
    preguntas.forEach((p, i) => {
        doc.setFont('helvetica', 'bold'); doc.setFontSize(10.5);
        const anchoTexto = ANCHO - 8 - (p.senal ? IMG + 4 : 0);
        const lineas = doc.splitTextToSize(limpiar(p.pregunta), anchoTexto);
        doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5);
        const ops = p.opciones.map(o => doc.splitTextToSize(limpiar(o), anchoTexto - 10));
        const alto = Math.max(lineas.length * 4.6 + ops.reduce((s, l) => s + l.length * 4.2 + 1.6, 0) + 4, p.senal ? IMG + 3 : 0);
        if (y + alto > H - 16) { doc.addPage(); y = M + 4; }
        // número
        doc.setFillColor(251, 140, 0); doc.circle(M + 3, y + 1.6, 3, 'F');
        doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5);
        doc.text(String(i + 1), M + 3, y + 2.7, { align: 'center' });
        let x = M + 8;
        if (p.senal) { doc.addImage(senalDataURL(p.senal, 200), 'PNG', x, y - 1, IMG, IMG); x += IMG + 4; }
        doc.setTextColor(17, 24, 39); doc.setFont('helvetica', 'bold'); doc.setFontSize(10.5);
        doc.text(lineas, x, y + 2.6);
        let yy = y + 2.6 + lineas.length * 4.6 + 0.8;
        doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); doc.setTextColor(31, 41, 55);
        ops.forEach((l, k) => {
            doc.setDrawColor(100, 116, 139); doc.setLineWidth(0.3); doc.rect(x, yy - 3, 3.4, 3.4);
            doc.setFont('helvetica', 'bold'); doc.text(`${'abc'[k]})`, x + 5, yy);
            doc.setFont('helvetica', 'normal'); doc.text(l, x + 10, yy);
            yy += l.length * 4.2 + 1.6;
        });
        y += alto + 2;
        doc.setDrawColor(226, 232, 240); doc.setLineWidth(0.2); doc.line(M, y - 1.5, W - M, y - 1.5);
    });
    // Hoja de respuestas (rejilla)
    if (y + 40 > H - 16) { doc.addPage(); y = M + 4; }
    y = tituloSeccion(doc, y + 2, 'Hoja de respuestas · aprobado con 3 fallos o menos (en el examen de 30)');
    const cols = 6, ancho = ANCHO / cols;
    preguntas.forEach((_, i) => {
        const c = i % cols, f = Math.floor(i / cols);
        const x = M + c * ancho, yy = y + f * 8;
        doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(55, 65, 81);
        doc.text(`${i + 1}.`, x + 1, yy + 3.5);
        ['a', 'b', 'c'].forEach((l, k) => {
            doc.setDrawColor(100, 116, 139); doc.circle(x + 10 + k * 6.5, yy + 2.3, 2.3);
            doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.text(l, x + 10 + k * 6.5, yy + 3.3, { align: 'center' });
        });
    });
    y += Math.ceil(preguntas.length / cols) * 8 + 4;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); doc.setTextColor(55, 65, 81);
    doc.text('Aciertos: ______ / ' + preguntas.length + '        Fallos: ______        Resultado:  APTO  /  NO APTO', M, y + 2);

    if (!soluciones) return;
    doc.addPage(); y = M + 2;
    y = tituloSeccion(doc, y, 'Soluciones y explicaciones (para el profesor)');
    preguntas.forEach((p, i) => {
        doc.setFontSize(9);
        const txt = doc.splitTextToSize(limpiar(`${i + 1}. ${'abc'[p.correcta]}) ${p.opciones[p.correcta]}`), ANCHO - 2);
        const exp = doc.splitTextToSize(limpiar(p.explicacion), ANCHO - 6);
        const alto = txt.length * 4 + exp.length * 3.7 + 2.5;
        if (y + alto > H - 16) { doc.addPage(); y = M + 4; }
        doc.setFont('helvetica', 'bold'); doc.setTextColor(21, 128, 61); doc.text(txt, M, y + 3);
        doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(75, 85, 99);
        doc.text(exp, M + 4, y + 3 + txt.length * 4);
        y += alto;
    });
}

function fichaSenales(doc, { n, categorias, soluciones }) {
    let lista = SENALES.filter(s => !categorias.length || categorias.includes(s.categoria));
    lista = [...lista].sort(() => Math.random() - 0.5).slice(0, n);
    const nomCat = categorias.length ? CATEGORIAS_SENAL.filter(c => categorias.includes(c.id)).map(c => c.nombre).join(', ') : 'Todas las categorías';
    let y = cabecera(doc, '¿Qué significa esta señal?', `${lista.length} señales · ${nomCat} · Escribe su nombre y qué debe hacer el conductor`);
    const cols = 2, ancho = ANCHO / cols, alto = 37.5, IMG = 28;
    lista.forEach((s, i) => {
        const c = i % cols;
        if (c === 0 && i > 0) y += alto;
        if (c === 0 && y + alto > H - 16) { doc.addPage(); y = M + 4; }
        const x = M + c * ancho;
        doc.setDrawColor(226, 232, 240); doc.setLineWidth(0.3); doc.roundedRect(x + 1, y, ancho - 2, alto - 3, 2, 2);
        doc.addImage(senalDataURL(s.id, 240), 'PNG', x + 4, y + 3.5, IMG, IMG);
        doc.setFillColor(251, 140, 0); doc.circle(x + 5, y + 4, 2.8, 'F');
        doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(8);
        doc.text(String(i + 1), x + 5, y + 5, { align: 'center' });
        doc.setTextColor(55, 65, 81); doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5);
        const tx = x + IMG + 8, fin = x + ancho - 4;
        doc.text('Nombre:', tx, y + 7.5); doc.setDrawColor(148, 163, 184); doc.line(tx, y + 13, fin, y + 13);
        doc.text('Qué debo hacer:', tx, y + 18.5); doc.line(tx, y + 24.5, fin, y + 24.5); doc.line(tx, y + 30.5, fin, y + 30.5);
    });
    if (!soluciones) return;
    doc.addPage(); y = M + 2;
    y = tituloSeccion(doc, y, 'Soluciones');
    lista.forEach((s, i) => {
        doc.setFontSize(9);
        const nombre = doc.splitTextToSize(limpiar(`${i + 1}. ${s.nombre}${/^[RPS]-/.test(s.codigo) ? ` (${s.codigo})` : ''}`), ANCHO - 18);
        const acc = doc.splitTextToSize(limpiar(s.accion), ANCHO - 18);
        const alto = Math.max(12, nombre.length * 4 + acc.length * 3.7 + 3);
        if (y + alto > H - 16) { doc.addPage(); y = M + 4; }
        doc.addImage(senalDataURL(s.id, 120), 'PNG', M, y, 10, 10);
        doc.setFont('helvetica', 'bold'); doc.setTextColor(17, 24, 39); doc.text(nombre, M + 14, y + 4);
        doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(75, 85, 99);
        doc.text(acc, M + 14, y + 4 + nombre.length * 4);
        y += alto;
    });
}

export { SENAL_POR_ID };
