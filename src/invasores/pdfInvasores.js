// Ficha imprimible «Invasión Pi»: las mismas preguntas del juego en papel, con estética arcade.
//   generarPdfInvasores({ preguntas, titulo, variante, oscuro, soluciones, qrUrl, piloto })
// · Cada pregunta es un alien numerado dentro de una «cápsula» de color neón.
// · Opciones → casillas A-D para marcar; número / texto → caja para escribir.
// · Math World: su enunciado visual (KaTeX) se captura como imagen con html2canvas.
// · oscuro = fondo negro tipo pantalla (para proyectar o tablet); por defecto ahorra tinta.
// · Al final: marcador de aliens derrotados, estrellas, y página de claves para el profe.
import React from 'react';
import { ALIENS, NAVE } from './ui/Sprites';

const A4 = { w: 210, h: 297, m: 12 };
const NEON_PAPEL = [[8, 145, 178], [192, 38, 211], [77, 124, 15], [217, 119, 6]];   // cyan/fucsia/lima/ámbar legibles en blanco
const NEON_PANTALLA = [[34, 211, 238], [232, 121, 249], [163, 230, 53], [251, 191, 36]];
const LETRAS = ['A', 'B', 'C', 'D', 'E', 'F'];

// jsPDF con fuentes estándar (WinAnsi): fuera emojis y signos que no existen
const seguro = (s) => String(s ?? '')
  .replace(/[’‘]/g, "'").replace(/[“”«»]/g, '"').replace(/…/g, '...')
  .replace(/[–—−]/g, '-').replace(/π/g, 'pi').replace(/√/g, 'raíz ')
  .replace(/≤/g, '<=').replace(/≥/g, '>=').replace(/≠/g, '!=').replace(/⁴/g, '^4')
  .replace(/[^\x09\x0A\x0D\x20-\x7E\xA0-\xFF]/g, '').replace(/\s+/g, ' ').trim();

// ── Pixel art: misma rejilla que los sprites del juego ──
function pixel(pdf, grid, x, y, px, color, blanco) {
  grid.forEach((fila, f) => {
    let c = 0;
    while (c < fila.length) {
      const ch = fila[c];
      if (ch === '.') { c++; continue; }
      let fin = c;
      while (fin + 1 < fila.length && fila[fin + 1] === ch) fin++;
      pdf.setFillColor(...(ch === 'O' ? blanco : color));
      pdf.rect(x + c * px, y + f * px, (fin - c + 1) * px + 0.02, px + 0.02, 'F');
      c = fin + 1;
    }
  });
}
const anchoSprite = (grid, px) => grid[0].length * px;

function estrellaPath(pdf, cx, cy, r, relleno) {
  const pts = [];
  for (let k = 0; k < 10; k++) {
    const a = -Math.PI / 2 + (k * Math.PI) / 5;
    const rr = k % 2 ? r * 0.45 : r;
    pts.push([cx + rr * Math.cos(a), cy + rr * Math.sin(a)]);
  }
  const lines = pts.slice(1).map((p, i) => [p[0] - pts[i][0], p[1] - pts[i][1]]);
  pdf.lines(lines, pts[0][0], pts[0][1], [1, 1], relleno ? 'FD' : 'S', true);
}

// ── QR (mismo servicio que las fichas de recursos) ──
async function cargarQR(url) {
  try {
    const r = await fetch(`https://api.qrserver.com/v1/create-qr-code/?size=300x300&margin=2&data=${encodeURIComponent(url)}`);
    if (!r.ok) return null;
    const blob = await r.blob();
    return await new Promise((res) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.onerror = () => res(null); fr.readAsDataURL(blob); });
  } catch { return null; }
}

// ── Enunciados visuales de Math World → imagen ──
async function capturarEnunciados(preguntas) {
  const conVisual = preguntas.filter((p) => p.Enunciado);
  if (!conVisual.length) return new Map();
  const [{ createRoot }, { flushSync }, { default: html2canvas }] = await Promise.all([
    import('react-dom/client'), import('react-dom'), import('html2canvas'),
  ]);
  const caja = document.createElement('div');
  caja.style.cssText = 'position:fixed;left:-12000px;top:0;width:560px;background:#fff;color:#0f172a;padding:6px 10px;font-family:system-ui,sans-serif;';
  document.body.appendChild(caja);
  const root = createRoot(caja);
  const out = new Map();
  try {
    for (const p of conVisual) {
      const { Enunciado } = p;
      flushSync(() => root.render(React.createElement('div', { style: { display: 'inline-block' } },
        React.createElement(Enunciado, { ap: p.ap, size: '1.6rem' }))));
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      const nodo = caja.firstElementChild || caja;
      try {
        const cv = await html2canvas(nodo, { backgroundColor: '#ffffff', scale: 2, logging: false });
        if (cv.width > 4 && cv.height > 4) out.set(p.id, { data: cv.toDataURL('image/png'), w: cv.width, h: cv.height });
      } catch { /* se queda con el texto */ }
    }
  } finally {
    root.unmount();
    caja.remove();
  }
  return out;
}

// ═════════════════════════════════════════════════════════
export async function generarPdfInvasores({
  preguntas, titulo = '', variante = 'DISPARA', oscuro = false, soluciones = true, qrUrl = null, descargar = true,
}) {
  const { jsPDF } = await import('jspdf');
  const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
  const NEON = oscuro ? NEON_PANTALLA : NEON_PAPEL;
  const FONDO = oscuro ? [2, 6, 23] : [255, 255, 255];
  const TINTA = oscuro ? [226, 232, 240] : [15, 23, 42];
  const SUAVE = oscuro ? [148, 163, 184] : [100, 116, 139];
  const CAJA = oscuro ? [15, 23, 42] : [248, 250, 252];
  const BLANCO = [248, 250, 252];
  const [qrImg, imagenes] = await Promise.all([qrUrl ? cargarQR(qrUrl) : null, capturarEnunciados(preguntas)]);

  const txt = (s, x, y, { tam = 10, font = 'helvetica', estilo = 'normal', color = TINTA, align = 'left', max } = {}) => {
    pdf.setFont(font, estilo); pdf.setFontSize(tam); pdf.setTextColor(...color);
    pdf.text(max ? pdf.splitTextToSize(seguro(s), max) : seguro(s), x, y, { align, baseline: 'top' });
  };
  const lineas = (s, max, tam, font = 'helvetica', estilo = 'normal') => {
    pdf.setFont(font, estilo); pdf.setFontSize(tam);
    return pdf.splitTextToSize(seguro(s), max);
  };

  const estrellasFondo = (y0, y1, n = 60, semilla = 7) => {
    let s = semilla;
    const r = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
    for (let k = 0; k < n; k++) {
      const g = 90 + Math.round(r() * 140);
      pdf.setFillColor(g, g, Math.min(255, g + 30));
      const t = 0.25 + r() * 0.5;
      pdf.rect(A4.m * 0.5 + r() * (A4.w - A4.m), y0 + r() * (y1 - y0), t, t, 'F');
    }
  };

  const fondoPagina = () => {
    if (!oscuro) return;
    pdf.setFillColor(...FONDO); pdf.rect(0, 0, A4.w, A4.h, 'F');
    estrellasFondo(0, A4.h, 140, pdf.getNumberOfPages() * 13);
  };

  // ── Cabecera tipo pantalla de recreativa ──
  const cabecera = () => {
    const alto = 46;
    pdf.setFillColor(2, 6, 23); pdf.roundedRect(A4.m, A4.m, A4.w - 2 * A4.m, alto, 3, 3, 'F');
    estrellasFondo(A4.m + 2, A4.m + alto - 2, 45, 3);
    pdf.setDrawColor(...NEON_PANTALLA[0]); pdf.setLineWidth(0.8);
    pdf.roundedRect(A4.m, A4.m, A4.w - 2 * A4.m, alto, 3, 3, 'S');

    // Desfile de aliens
    const px = 0.62;
    for (let k = 0; k < 5; k++) {
      pixel(pdf, ALIENS[k % 3][k % 2], A4.m + 7 + k * 10, A4.m + 5, px, NEON_PANTALLA[k % 4], BLANCO);
    }
    txt('INVASIÓN PI', A4.m + 7, A4.m + 13, { tam: 26, font: 'courier', estilo: 'bold', color: NEON_PANTALLA[0] });
    txt('MISIÓN DE ENTRENAMIENTO', A4.m + 7.4, A4.m + 24, { tam: 9.5, font: 'courier', estilo: 'bold', color: NEON_PANTALLA[1] });
    txt(titulo, A4.m + 7.4, A4.m + 29.5, { tam: 8.5, color: [203, 213, 225], max: qrImg ? 118 : 160 });

    // Datos del piloto
    const yP = A4.m + alto - 9;
    txt('PILOTO:', A4.m + 7.4, yP, { tam: 9, font: 'courier', estilo: 'bold', color: NEON_PANTALLA[2] });
    pdf.setDrawColor(100, 116, 139); pdf.setLineWidth(0.3);
    pdf.line(A4.m + 24, yP + 3.6, A4.m + 82, yP + 3.6);
    txt('FECHA:', A4.m + 86, yP, { tam: 9, font: 'courier', estilo: 'bold', color: NEON_PANTALLA[2] });
    pdf.line(A4.m + 100, yP + 3.6, A4.m + 126, yP + 3.6);

    if (qrImg) {
      const q = 30, xq = A4.w - A4.m - q - 5, yq = A4.m + 5;
      pdf.setFillColor(255, 255, 255); pdf.roundedRect(xq - 1.5, yq - 1.5, q + 3, q + 3, 1.5, 1.5, 'F');
      pdf.addImage(qrImg, 'PNG', xq, yq, q, q);
      txt('¡JUEGA EN PIKT.ES!', xq + q / 2, yq + q + 3, { tam: 6.5, font: 'courier', estilo: 'bold', color: NEON_PANTALLA[3], align: 'center' });
    }
    return A4.m + alto + 5;
  };

  // ── Instrucciones ──
  const briefing = (y) => {
    const ancho = A4.w - 2 * A4.m;
    const pasos = variante === 'FILTRO'
      ? ['Cada alien trae una pregunta y varias respuestas.', 'Marca SOLO la respuesta correcta: las falsas son aliens que debes derribar.', 'Al acabar, colorea los aliens que hayas derrotado.']
      : ['Cada alien baja con una pregunta.', 'Escribe la respuesta (o marca la opción) para disparar tu láser.', 'Al acabar, colorea los aliens que hayas derrotado.'];
    pdf.setFillColor(...CAJA); pdf.setDrawColor(...NEON[3]); pdf.setLineWidth(0.5);
    pdf.roundedRect(A4.m, y, ancho, 17, 2, 2, 'FD');
    txt('> BRIEFING', A4.m + 4, y + 2.5, { tam: 8.5, font: 'courier', estilo: 'bold', color: NEON[3] });
    pasos.forEach((p, k) => {
      txt(`${k + 1}. ${p}`, A4.m + 4, y + 7 + k * 3.4, { tam: 8.6, color: TINTA });
    });
    pixel(pdf, NAVE, A4.w - A4.m - 16, y + 5, 0.85, NEON[0], oscuro ? FONDO : BLANCO);
    return y + 21;
  };

  // ── Tarjeta de una pregunta ──
  const colAncho = (A4.w - 2 * A4.m - 5) / 2;
  const medirTarjeta = (p) => {
    const anchoTexto = colAncho - 19;
    const img = imagenes.get(p.id);
    let hTexto;
    let imgDim = null;
    if (img) {
      // html2canvas a escala 2 → 1 px CSS ≈ 0,2646 mm; se encoge si no cabe (ancho o 40 mm de alto)
      const w0 = (img.w / 2) * 0.2646 * 0.8;
      const esc = Math.min(1, anchoTexto / w0, 40 / ((img.h / img.w) * w0));
      imgDim = { w: w0 * esc, h: (img.h / img.w) * w0 * esc };
      hTexto = imgDim.h + (p.instruccion ? 4 : 0);
    } else {
      hTexto = lineas(p.enunciado, anchoTexto, 10.5, 'helvetica', 'bold').length * 4.6;
    }
    const conOpciones = p.opciones?.length >= 2 && (p.respuesta === 'opciones' || variante === 'FILTRO');
    const opcLineas = conOpciones ? p.opciones.map((o) => lineas(o, anchoTexto - 7, 9.5)) : [];
    const hResp = conOpciones ? opcLineas.reduce((s, l) => s + Math.max(5.2, l.length * 4 + 1.2), 0) : 10;
    return { alto: Math.max(22, 6 + hTexto + 3 + hResp + 3), img, imgDim, conOpciones, opcLineas, anchoTexto };
  };

  const dibujarTarjeta = (p, k, x, y, med) => {
    const color = NEON[k % 4];
    pdf.setFillColor(...CAJA); pdf.setDrawColor(...color); pdf.setLineWidth(0.6);
    pdf.roundedRect(x, y, colAncho, med.alto, 2, 2, 'FD');
    // Alien + número
    pixel(pdf, ALIENS[k % 3][0], x + 2.5, y + 4, 0.95, color, oscuro ? FONDO : BLANCO);
    txt(`#${String(k + 1).padStart(2, '0')}`, x + 7.7, y + 13.5, { tam: 8, font: 'courier', estilo: 'bold', color, align: 'center' });
    // Casilla «derrotado»
    pdf.setDrawColor(...SUAVE); pdf.setLineWidth(0.3);
    pdf.rect(x + 5.2, y + 18, 5, 5, 'S');
    txt('KO', x + 7.7, y + 23.6, { tam: 5.5, font: 'courier', estilo: 'bold', color: SUAVE, align: 'center' });

    const xt = x + 16;
    let yt = y + 4;
    if (med.img) {
      if (p.instruccion) { txt(p.instruccion, xt, yt, { tam: 7.5, estilo: 'italic', color: SUAVE, max: med.anchoTexto }); yt += 4; }
      if (oscuro) { pdf.setFillColor(255, 255, 255); pdf.roundedRect(xt - 1, yt - 1, med.imgDim.w + 2, med.imgDim.h + 2, 1, 1, 'F'); }
      pdf.addImage(med.img.data, 'PNG', xt, yt, med.imgDim.w, med.imgDim.h);
      yt += med.imgDim.h + 3;
    } else {
      const ls = lineas(p.enunciado, med.anchoTexto, 10.5, 'helvetica', 'bold');
      pdf.setTextColor(...TINTA); pdf.text(ls, xt, yt, { baseline: 'top' });
      yt += ls.length * 4.6 + 3;
    }
    if (med.conOpciones) {
      p.opciones.forEach((o, i) => {
        pdf.setDrawColor(...color); pdf.setLineWidth(0.35);
        pdf.roundedRect(xt, yt - 0.2, 4.4, 4.4, 0.6, 0.6, 'S');
        txt(LETRAS[i], xt + 2.2, yt + 0.5, { tam: 7, font: 'courier', estilo: 'bold', color, align: 'center' });
        pdf.setFont('helvetica', 'normal'); pdf.setFontSize(9.5); pdf.setTextColor(...TINTA);
        pdf.text(med.opcLineas[i], xt + 6.5, yt + 0.3, { baseline: 'top' });
        yt += Math.max(5.2, med.opcLineas[i].length * 4 + 1.2);
      });
    } else {
      // Cápsula de respuesta
      const w = med.anchoTexto - 1;
      pdf.setFillColor(...(oscuro ? [2, 6, 23] : [255, 255, 255])); pdf.setDrawColor(...color); pdf.setLineWidth(0.5);
      pdf.roundedRect(xt, yt, w, 8, 1.5, 1.5, 'FD');
      txt('>', xt + 1.8, yt + 2, { tam: 9, font: 'courier', estilo: 'bold', color });
      if (p.unidad) txt(p.unidad, xt + w - 2, yt + 2.2, { tam: 8.5, color: SUAVE, align: 'right' });
    }
  };

  // ── Marcador final ──
  const altoMarcador = 30;
  const marcador = (y) => {
    const ancho = A4.w - 2 * A4.m;
    pdf.setFillColor(2, 6, 23); pdf.roundedRect(A4.m, y, ancho, altoMarcador - 4, 2.5, 2.5, 'F');
    pdf.setDrawColor(...NEON_PANTALLA[2]); pdf.setLineWidth(0.7); pdf.roundedRect(A4.m, y, ancho, altoMarcador - 4, 2.5, 2.5, 'S');
    txt('ALIENS DERROTADOS', A4.m + 6, y + 4, { tam: 9, font: 'courier', estilo: 'bold', color: NEON_PANTALLA[2] });
    pdf.setDrawColor(203, 213, 225); pdf.setLineWidth(0.4);
    pdf.line(A4.m + 6, y + 18, A4.m + 26, y + 18);
    txt(`/ ${preguntas.length}`, A4.m + 28, y + 12.5, { tam: 15, font: 'courier', estilo: 'bold', color: [226, 232, 240] });
    txt('PUNTOS (x100)', A4.m + 66, y + 4, { tam: 9, font: 'courier', estilo: 'bold', color: NEON_PANTALLA[0] });
    pdf.line(A4.m + 66, y + 18, A4.m + 100, y + 18);
    txt('ESTRELLAS', A4.m + 120, y + 4, { tam: 9, font: 'courier', estilo: 'bold', color: NEON_PANTALLA[3] });
    pdf.setDrawColor(...NEON_PANTALLA[3]); pdf.setLineWidth(0.5);
    for (let s = 0; s < 3; s++) estrellaPath(pdf, A4.m + 124 + s * 10, y + 15, 4, false);
    txt('3 = 90%   2 = 70%   1 = 40%', A4.m + 120, y + 20.3, { tam: 6.5, color: [148, 163, 184] });
    pixel(pdf, NAVE, A4.w - A4.m - 19, y + 8, 1.05, NEON_PANTALLA[0], BLANCO);
  };

  const pie = () => {
    const n = pdf.getNumberOfPages();
    for (let i = 1; i <= n; i++) {
      pdf.setPage(i);
      pdf.setDrawColor(...SUAVE); pdf.setLineWidth(0.2);
      pdf.setLineDashPattern([0.8, 0.8], 0); pdf.line(A4.m, A4.h - 9, A4.w - A4.m, A4.h - 9); pdf.setLineDashPattern([], 0);
      txt('pikt.es · Invasión Pi', A4.m, A4.h - 7.5, { tam: 7, font: 'courier', color: SUAVE });
      txt(`NIVEL ${i}/${n}`, A4.w - A4.m, A4.h - 7.5, { tam: 7, font: 'courier', estilo: 'bold', color: SUAVE, align: 'right' });
    }
  };

  // ════ Maquetación ════
  fondoPagina();
  let y = briefing(cabecera());
  const limite = A4.h - 13;
  const meds = preguntas.map(medirTarjeta);
  for (let k = 0; k < preguntas.length; k += 2) {
    const altoFila = Math.max(meds[k].alto, meds[k + 1]?.alto || 0);
    if (y + altoFila > limite) { pdf.addPage(); fondoPagina(); y = A4.m; }
    dibujarTarjeta(preguntas[k], k, A4.m, y, { ...meds[k], alto: altoFila });
    if (preguntas[k + 1]) dibujarTarjeta(preguntas[k + 1], k + 1, A4.m + colAncho + 5, y, { ...meds[k + 1], alto: altoFila });
    y += altoFila + 4;
  }
  if (y + altoMarcador > limite) { pdf.addPage(); fondoPagina(); y = A4.m; }
  marcador(y);

  // ── Claves para el profe ──
  if (soluciones) {
    pdf.addPage(); fondoPagina();
    let ys = A4.m;
    pdf.setFillColor(2, 6, 23); pdf.roundedRect(A4.m, ys, A4.w - 2 * A4.m, 14, 2, 2, 'F');
    pixel(pdf, ALIENS[1][0], A4.m + 4, ys + 3.3, 0.7, NEON_PANTALLA[1], BLANCO);
    txt('CLAVES DE LA MISIÓN', A4.m + 15, ys + 3.8, { tam: 13, font: 'courier', estilo: 'bold', color: NEON_PANTALLA[1] });
    txt('(solo para el profe)', A4.w - A4.m - 4, ys + 5.5, { tam: 7.5, color: [148, 163, 184], align: 'right' });
    ys += 19;
    const colW = (A4.w - 2 * A4.m - 6) / 3;
    const filas = Math.ceil(preguntas.length / 3);
    const altoLinea = 6.2;
    let fila = 0;
    let y0 = ys;
    preguntas.forEach((p, k) => {
      const col = Math.floor(k / filas);
      if (k % filas === 0) fila = 0;
      const yy = y0 + fila * altoLinea;
      if (yy > limite - 4) return; // más de ~120 preguntas: improbable
      const x = A4.m + col * (colW + 3);
      const idx = p.opciones?.indexOf(p.correcta);
      const marca = (p.respuesta === 'opciones' || variante === 'FILTRO') && idx >= 0 ? `${LETRAS[idx]}) ` : '';
      txt(`#${String(k + 1).padStart(2, '0')}`, x, yy, { tam: 8.5, font: 'courier', estilo: 'bold', color: NEON[k % 4] });
      const r = lineas(`${marca}${p.correcta}${p.unidad ? ` ${p.unidad}` : ''}`, colW - 11, 9)[0] || '';
      pdf.setFont('helvetica', 'normal'); pdf.setFontSize(9); pdf.setTextColor(...TINTA);
      pdf.text(r, x + 10, yy, { baseline: 'top' });
      fila++;
    });
  }

  pie();
  const nombre = `invasion-pi-${seguro(titulo).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'ficha'}.pdf`;
  if (descargar) pdf.save(nombre);
  return pdf;
}
