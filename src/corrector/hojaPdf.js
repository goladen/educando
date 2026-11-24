// 🖨️ PDF de la hoja de respuestas del Corrector (y del examen con las preguntas, si las hay).
// Las posiciones salen de omr.js: el lector espera los círculos exactamente ahí.
import { bitsTarjeta } from '../tarjetas/detectorTarjetas.js';
import { HOJA, MARCAS, LADO_MARCA, R, LETRAS, posBurbuja, posNumero, posId, ID, RESP, CAJA, filasTest, plantillaEscritas } from './omr.js';

function marcador(pdf, m) {
  const bits = bitsTarjeta(m.tarjeta);
  const x0 = m.x - LADO_MARCA / 2, y0 = m.y - LADO_MARCA / 2, c = LADO_MARCA / 6;
  pdf.setFillColor(0, 0, 0);
  pdf.rect(x0, y0, LADO_MARCA, LADO_MARCA, 'F');
  pdf.setFillColor(255, 255, 255);
  bits.forEach((fila, y) => fila.forEach((b, x) => { if (b) pdf.rect(x0 + c * (x + 1), y0 + c * (y + 1), c, c, 'F'); }));
}

function burbuja(pdf, x, y, txt, lleno = false) {
  pdf.setDrawColor(90, 90, 90);
  pdf.setLineWidth(0.3);
  if (lleno) { pdf.setFillColor(30, 30, 30); pdf.circle(x, y, R, 'FD'); return; }
  pdf.circle(x, y, R, 'S');
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(6.5);
  pdf.setTextColor(175, 175, 175);
  pdf.text(txt, x, y, { align: 'center', baseline: 'middle' });
}

/** Dibuja una hoja de respuestas en la página actual. */
function hoja(pdf, { titulo, nPreguntas, nOpciones, nombre = '', lista = null, nEscritas = 0, letras = 8 }) {
  const filas = filasTest({ nPreguntas, nEscritas });
  MARCAS.forEach((m) => marcador(pdf, m));

  pdf.setTextColor(15, 23, 42);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(16);
  pdf.text('Hoja de respuestas', 28, 27);
  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'normal');
  if (titulo) pdf.text(pdf.splitTextToSize(titulo, 118)[0], 28, 33);

  pdf.setFontSize(10);
  pdf.setDrawColor(120, 120, 120);
  pdf.setLineWidth(0.25);
  pdf.text('Nombre:', 28, 45);
  if (nombre) { pdf.setFont('helvetica', 'bold'); pdf.text(nombre.slice(0, 40), 45, 44); pdf.setFont('helvetica', 'normal'); }
  pdf.line(44, 46, 150, 46);
  pdf.text('Curso:', 28, 55);
  pdf.line(41, 56, 88, 56);
  pdf.text('Fecha:', 93, 55);
  pdf.line(106, 56, 150, 56);

  // Instrucciones con ejemplo
  pdf.setFillColor(241, 245, 249);
  pdf.roundedRect(26, 63, 126, 40, 2, 2, 'F');
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(9);
  pdf.text('Cómo se rellena', 30, 69);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(8.5);
  const lineas = [
    'Rellena el círculo entero con bolígrafo o lápiz oscuro:',
    'No rodees la letra ni hagas cruces. Una sola respuesta por pregunta.',
    'Para cambiarla, borra bien (con bolígrafo, avisa al profesor).',
    'Nº de lista (arriba a la derecha): decenas y unidades. El 7 = 0 y 7.',
    'No dobles la hoja ni escribas cerca de los cuadros negros.',
  ];
  lineas.forEach((l, i) => pdf.text(l, 30, 75 + i * 6));
  burbuja(pdf, 117, 74.3, '', true);
  pdf.setTextColor(22, 163, 74); pdf.setFont('helvetica', 'bold'); pdf.text('Bien', 121.5, 75.2);
  // ejemplos mal: círculo rodeado (anillo) y cruz
  pdf.setDrawColor(90, 90, 90); pdf.setLineWidth(0.3); pdf.circle(133, 74.3, R, 'S');
  pdf.setDrawColor(30, 30, 30); pdf.setLineWidth(0.6); pdf.line(131, 72.3, 135, 76.3); pdf.line(135, 72.3, 131, 76.3);
  pdf.setTextColor(220, 38, 38); pdf.text('Mal', 137, 75.2);
  pdf.setTextColor(15, 23, 42);

  // Nº de lista
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(9);
  pdf.text('Nº de lista', (ID.xDecenas + ID.xUnidades) / 2, 29, { align: 'center' });
  pdf.setFontSize(7);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(100, 116, 139);
  pdf.text('dec.', ID.xDecenas, 34, { align: 'center' });
  pdf.text('uni.', ID.xUnidades, 34, { align: 'center' });
  pdf.setDrawColor(148, 163, 184);
  pdf.setLineWidth(0.25);
  pdf.roundedRect(ID.xDecenas - 6, 24, ID.xUnidades - ID.xDecenas + 12, ID.y0 + 9 * ID.paso + 6 - 24, 2, 2, 'S');
  // Hoja personalizada: el nº de lista ya viene rellenado
  const digitos = lista ? [Math.floor(lista / 10), lista % 10] : null;
  for (let c = 0; c < 2; c++) for (let d = 0; d < 10; d++) { const p = posId(c, d); burbuja(pdf, p.x, p.y, String(d), !!digitos && digitos[c] === d); }

  // Respuestas
  pdf.setTextColor(15, 23, 42);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(10);
  if (nPreguntas > 0) pdf.text(`Respuestas · ${nPreguntas} ${nPreguntas === 1 ? 'pregunta' : 'preguntas'} (${LETRAS[0]}-${LETRAS[nOpciones - 1]})`, 28, RESP.y0 - 9);
  for (let q = 0; q < nPreguntas; q++) {
    const n = posNumero(q, filas);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(9);
    pdf.setTextColor(15, 23, 42);
    pdf.text(String(q + 1), n.x, n.y, { align: 'right', baseline: 'middle' });
    for (let o = 0; o < nOpciones; o++) { const p = posBurbuja(q, o, filas); burbuja(pdf, p.x, p.y, LETRAS[o]); }
  }

  // Respuestas escritas: una MAYÚSCULA o cifra por casilla
  if (nEscritas > 0) {
    const P = plantillaEscritas({ nPreguntas, nEscritas, letras });
    pdf.setTextColor(15, 23, 42);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(10);
    pdf.text('Respuestas escritas', 28, P.titulo);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(7.4);
    pdf.setTextColor(71, 85, 105);
    // Debe caber en una línea (hasta x≈188): se comprueba en las pruebas con getTextWidth
    pdf.text('· MAYÚSCULAS, una letra o cifra por casilla, sin tildes · el signo - y la coma (-3,5) en su casilla', 61, P.titulo);
    for (const it of P.items) {
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(9);
      pdf.setTextColor(15, 23, 42);
      pdf.text(String(it.num), it.x + 7, it.y, { align: 'right', baseline: 'middle' });
      pdf.setDrawColor(185, 185, 185); // gris claro: se ve, pero el lector no lo confunde con tinta
      pdf.setLineWidth(0.3);
      for (const c of it.cajas) pdf.roundedRect(c.cx - CAJA.w / 2, c.cy - CAJA.h / 2, CAJA.w, CAJA.h, 0.8, 0.8, 'S');
    }
  }

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(7);
  pdf.setTextColor(148, 163, 184);
  pdf.text('PiKT · Corrector de exámenes · pikt.es/corrector', HOJA.W / 2, 287, { align: 'center' });
}

/**
 * Descarga el PDF.
 *   cfg: { titulo, nPreguntas, nOpciones, copias, alumnos: [{ nombre, lista }] (una hoja por alumno, con su nº ya marcado),
 *          preguntas: [{ texto, opciones }] (examen delante), conClave }
 */
export async function descargarPdfCorrector({ titulo = '', nPreguntas, nOpciones, nEscritas = 0, letras = 8, copias = 1, alumnos = [], preguntas = null, preguntasEscritas = null, clave = null, claveEscritas = null, conClave = false, soloExamen = false }) {
  const { jsPDF } = await import('jspdf');
  const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  let primera = true;
  const nueva = () => { if (!primera) pdf.addPage(); primera = false; };

  if (preguntas?.length || preguntasEscritas?.length) {
    // Examen: preguntas con sus opciones (y las de respuesta escrita)
    nueva();
    let y = 20;
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(15);
    pdf.setTextColor(15, 23, 42);
    pdf.text(titulo || 'Examen', 20, y);
    y += 6;
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9);
    pdf.setTextColor(100, 116, 139);
    pdf.text('Marca tus respuestas en la hoja de respuestas, no en este papel.', 20, y);
    y += 8;
    preguntas.slice(0, nPreguntas).forEach((p, q) => {
      pdf.setFontSize(10.5);
      pdf.setTextColor(15, 23, 42);
      pdf.setFont('helvetica', 'bold');
      const enun = pdf.splitTextToSize(`${q + 1}. ${p.texto}`, 170);
      pdf.setFont('helvetica', 'normal');
      const ops = p.opciones.slice(0, nOpciones).map((o, i) => pdf.splitTextToSize(`${LETRAS[i]})  ${o}`, 160));
      const alto = enun.length * 5 + ops.reduce((s, l) => s + l.length * 4.6, 0) + 4;
      if (y + alto > 282) { pdf.addPage(); y = 20; }
      pdf.setFont('helvetica', 'bold');
      pdf.text(enun, 20, y);
      y += enun.length * 5;
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(10);
      ops.forEach((l) => { pdf.text(l, 26, y); y += l.length * 4.6; });
      y += 4;
    });
    (preguntasEscritas || []).slice(0, nEscritas).forEach((p, k) => {
      pdf.setFontSize(10.5);
      pdf.setTextColor(15, 23, 42);
      pdf.setFont('helvetica', 'bold');
      const enun = pdf.splitTextToSize(`${nPreguntas + k + 1}. ${p.texto}`, 170);
      if (y + enun.length * 5 + 9 > 282) { pdf.addPage(); y = 20; }
      pdf.text(enun, 20, y);
      y += enun.length * 5;
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(9);
      pdf.setTextColor(100, 116, 139);
      pdf.text('Escribe la respuesta en las casillas de la hoja (mayúsculas).', 26, y);
      y += 8;
    });
  }

  if (!soloExamen) {
    const lista = alumnos.length ? alumnos : Array.from({ length: Math.max(1, copias) }, () => ({ nombre: '', lista: null }));
    lista.forEach((a) => { nueva(); hoja(pdf, { titulo, nPreguntas, nOpciones, nEscritas, letras, nombre: a.nombre || '', lista: a.lista || null }); });
  }

  if (conClave && clave) {
    nueva();
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(14);
    pdf.setTextColor(15, 23, 42);
    pdf.text(`Clave de respuestas${titulo ? ` · ${titulo}` : ''}`, 20, 22);
    pdf.setFontSize(11);
    clave.slice(0, nPreguntas).forEach((c, q) => {
      const col = Math.floor(q / 25), fila = q % 25;
      pdf.setFont('helvetica', 'normal');
      pdf.text(`${q + 1}.`, 25 + col * 60, 35 + fila * 9, { align: 'right' });
      pdf.setFont('helvetica', 'bold');
      pdf.text(c || '—', 29 + col * 60, 35 + fila * 9);
    });
    (claveEscritas || []).slice(0, nEscritas).forEach((c, k) => {
      const q = nPreguntas + k, col = Math.floor(q / 25), fila = q % 25;
      pdf.setFont('helvetica', 'normal');
      pdf.text(`${q + 1}.`, 25 + col * 60, 35 + fila * 9, { align: 'right' });
      pdf.setFont('helvetica', 'bold');
      pdf.text(pdf.splitTextToSize(c || '—', 50)[0], 29 + col * 60, 35 + fila * 9);
    });
  }

  const base = (titulo || 'examen').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'examen';
  pdf.save(soloExamen ? `${base}-preguntas.pdf` : (preguntas?.length || preguntasEscritas?.length) ? `${base}-examen-y-hoja.pdf` : `${base}-hoja-respuestas.pdf`);
}

/** Para pruebas: devuelve el jsPDF de una hoja sin descargar. */
export async function pdfHojaPrueba(cfg) {
  const { jsPDF } = await import('jspdf');
  const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  hoja(pdf, cfg);
  return pdf;
}
