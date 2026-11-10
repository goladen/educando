// Documentos personalizados (combinar correspondencia): plantilla con {{Columna}} + tabla → un documento por fila.
//   rellenar(texto, columnas, fila)      → texto con los campos sustituidos
//   generarDocs({ plantilla, titulo, columnas, filas }) → [{ nombre, titulo, texto, vacios: [col] }]
//   tablaDeTexto(texto)                  → filas (pegado desde Excel/Sheets: tabuladores; o CSV ; ,)
//   tablaDeArchivo(file)                 → filas (xlsx, xls, ods, csv)
//   descargarPdf / descargarTxt (docs, { separados, ... })
// Los campos se escriben como {{Nombre}} (sin distinguir mayúsculas). Los botones los insertan en la plantilla.

export const RE_CAMPO = /\{\{\s*([^{}]+?)\s*\}\}/g;
const clave = (s) => String(s ?? '').trim().toLowerCase();

export function rellenar(texto, columnas, fila, vacios) {
  const idx = Object.fromEntries(columnas.map((c, i) => [clave(c), i]));
  return String(texto ?? '').replace(RE_CAMPO, (todo, nombre) => {
    const i = idx[clave(nombre)];
    if (i === undefined) return todo;                 // campo que no es ninguna columna: se deja tal cual
    const v = String(fila?.[i] ?? '');
    if (!v.trim() && vacios) vacios.add(columnas[i]);
    return v;
  });
}

// Campos usados en la plantilla que no corresponden a ninguna columna
export function camposDesconocidos(textos, columnas) {
  const cols = new Set(columnas.map(clave));
  const out = new Set();
  textos.forEach(t => { for (const m of String(t ?? '').matchAll(RE_CAMPO)) if (!cols.has(clave(m[1]))) out.add(m[1].trim()); });
  return [...out];
}

export const filaVacia = (f) => !(f || []).some(v => String(v ?? '').trim());

const nombreArchivo = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[\\/:*?"<>|\n\r\t]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80);

export function generarDocs({ plantilla, titulo, columnas, filas }) {
  const usados = new Set();
  return filas.map((fila, i) => ({ fila, i })).filter(({ fila }) => !filaVacia(fila)).map(({ fila, i }) => {
    const vacios = new Set();
    const tit = rellenar(titulo, columnas, fila, vacios).trim();
    const texto = rellenar(plantilla, columnas, fila, vacios);
    let base = nombreArchivo(tit) || `Documento ${i + 1}`;
    let nombre = base, k = 2;
    while (usados.has(nombre.toLowerCase())) nombre = `${base} (${k++})`;
    usados.add(nombre.toLowerCase());
    return { n: i + 1, nombre, titulo: tit, texto, vacios: [...vacios] };
  });
}

// ─────────────────────────────────────────────────────────────
// Tablas: pegar desde Excel / Google Sheets / CSV, o importar archivo
// ─────────────────────────────────────────────────────────────
function partirCSV(linea, sep) {
  const out = []; let cur = '', q = false;
  for (let i = 0; i < linea.length; i++) {
    const ch = linea[i];
    if (q) {
      if (ch === '"' && linea[i + 1] === '"') { cur += '"'; i++; }
      else if (ch === '"') q = false;
      else cur += ch;
    } else if (ch === '"' && !cur) q = true;
    else if (ch === sep) { out.push(cur); cur = ''; }
    else cur += ch;
  }
  out.push(cur);
  return out;
}

export function tablaDeTexto(texto) {
  const lineas = String(texto ?? '').replace(/\r\n?/g, '\n').split('\n');
  while (lineas.length && !lineas[lineas.length - 1].trim()) lineas.pop();
  if (!lineas.length) return [];
  const muestra = lineas.slice(0, 5).join('\n');
  const sep = muestra.includes('\t') ? '\t' : muestra.includes(';') ? ';' : muestra.includes(',') ? ',' : '\t';
  return lineas.map(l => (sep === '\t' ? l.split('\t') : partirCSV(l, sep)).map(v => v.trim()));
}

export async function tablaDeArchivo(file) {
  if (/\.(csv|txt|tsv)$/i.test(file.name)) return tablaDeTexto(await file.text());
  const XLSX = await import('xlsx');
  const wb = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: true });
  const hoja = wb.Sheets[wb.SheetNames[0]];
  const filas = XLSX.utils.sheet_to_json(hoja, { header: 1, raw: false, defval: '' });
  return filas.map(f => f.map(v => String(v ?? '').trim())).filter(f => f.some(Boolean));
}

// ─────────────────────────────────────────────────────────────
// Descargas
// ─────────────────────────────────────────────────────────────
function bajar(blob, nombre) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = nombre;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

async function zip(archivos, nombreZip) {
  const JSZip = (await import('jszip')).default;
  const z = new JSZip();
  archivos.forEach(({ nombre, datos }) => z.file(nombre, datos));
  bajar(await z.generateAsync({ type: 'blob' }), nombreZip);
}

const textoDoc = (d) => (d.titulo ? `${d.titulo}\n\n` : '') + d.texto.trim() + '\n';

export async function descargarTxt(docs, { separados, nombre = 'documentos' }) {
  if (separados) return zip(docs.map(d => ({ nombre: `${d.nombre}.txt`, datos: '﻿' + textoDoc(d) })), `${nombreArchivo(nombre) || 'documentos'}.zip`);
  const sep = '\n\n' + '─'.repeat(40) + '\n\n';
  bajar(new Blob(['﻿' + docs.map(textoDoc).join(sep)], { type: 'text/plain;charset=utf-8' }), `${nombreArchivo(nombre) || 'documentos'}.txt`);
}

// Las fuentes estándar de jsPDF solo tienen Latin-1: se cambian los caracteres que no sabría dibujar
const seguro = (s) => String(s ?? '')
  .replace(/[’‘‚‛]/g, "'").replace(/[“”„‟]/g, '"').replace(/…/g, '...').replace(/[–—]/g, '-')
  .replace(/€/g, 'EUR').replace(/[•●▪]/g, '-').replace(/ /g, ' ').replace(/\t/g, '    ')
  .replace(/[^\x0A\x20-\x7E\xA0-\xFF]/g, '');

const MM_PT = 0.3528;

function escribirDoc(pdf, d, { tam, alinear }) {
  const M = 20, ANCHO = 210 - 2 * M, ALTO = 297;
  let y = M;
  const salto = (h) => { if (y + h > ALTO - M) { pdf.addPage(); y = M; } };
  if (d.titulo) {
    pdf.setFont('helvetica', 'bold'); pdf.setFontSize(tam + 4);
    const lh = (tam + 4) * MM_PT * 1.3;
    pdf.splitTextToSize(seguro(d.titulo), ANCHO).forEach(l => { salto(lh); pdf.text(l, M, y + lh * 0.8); y += lh; });
    y += lh * 0.6;
  }
  pdf.setFont('helvetica', 'normal'); pdf.setFontSize(tam);
  const lh = tam * MM_PT * 1.45;
  seguro(d.texto).replace(/\s+$/, '').split('\n').forEach(par => {
    if (!par.trim()) { y += lh; return; }
    const lineas = pdf.splitTextToSize(par, ANCHO);
    lineas.forEach((l, k) => {
      salto(lh);
      const ultima = k === lineas.length - 1;
      if (alinear === 'justify' && !ultima) pdf.text(l, M, y + lh * 0.8, { align: 'justify', maxWidth: ANCHO });
      else if (alinear === 'center') pdf.text(l, M + ANCHO / 2, y + lh * 0.8, { align: 'center' });
      else pdf.text(l, M, y + lh * 0.8);
      y += lh;
    });
  });
}

export async function descargarPdf(docs, { separados, nombre = 'documentos', tam = 12, alinear = 'left' }) {
  const { jsPDF } = await import('jspdf');
  const nuevo = () => new jsPDF({ unit: 'mm', format: 'a4' });
  if (separados) {
    return zip(docs.map(d => {
      const pdf = nuevo(); escribirDoc(pdf, d, { tam, alinear });
      return { nombre: `${d.nombre}.pdf`, datos: pdf.output('arraybuffer') };
    }), `${nombreArchivo(nombre) || 'documentos'}.zip`);
  }
  const pdf = nuevo();
  docs.forEach((d, i) => { if (i) pdf.addPage(); escribirDoc(pdf, d, { tam, alinear }); });
  bajar(pdf.output('blob'), `${nombreArchivo(nombre) || 'documentos'}.pdf`);
}

// ─────────────────────────────────────────────────────────────
// Correo: abrir cada documento como un correo ya escrito (Gmail web o el programa de correo).
// No necesita permisos: el profesor revisa y pulsa «Enviar» en cada uno. Sin adjuntos.
// ─────────────────────────────────────────────────────────────
export const RE_EMAIL = /^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]{2,}$/;

// Índice de la columna que parece de correos (por nombre o por contenido); -1 si no hay
export function columnaCorreo(columnas, filas) {
  const porNombre = columnas.findIndex(c => /correo|e-?mail|mail/i.test(c || ''));
  if (porNombre >= 0) return porNombre;
  return columnas.findIndex((_, i) => filas.some(f => RE_EMAIL.test(String(f?.[i] ?? '').trim())));
}

// «a@x.es; b@y.es» → { validos: [...], invalidos: [...] }
export function correosDe(valor) {
  const partes = String(valor ?? '').split(/[;,\s]+/).map(s => s.trim().replace(/^<|>$/g, '')).filter(Boolean);
  return { validos: partes.filter(p => RE_EMAIL.test(p)), invalidos: partes.filter(p => !RE_EMAIL.test(p)) };
}

// Límites prácticos de longitud del enlace (Outlook y otros cortan los mailto largos)
export const LIMITE_URL = { gmail: 8000, mailto: 1900 };

export function enlaceCorreo({ para = [], asunto = '', cuerpo = '', cliente = 'gmail', cuenta = '' }) {
  const enc = encodeURIComponent;
  const texto = String(cuerpo).replace(/\r?\n/g, '\r\n');
  if (cliente === 'gmail') {
    return `https://mail.google.com/mail/?view=cm&fs=1&to=${enc(para.join(','))}&su=${enc(asunto)}&body=${enc(texto)}`
      + (cuenta.trim() ? `&authuser=${enc(cuenta.trim())}` : '');
  }
  return `mailto:${para.map(p => enc(p).replace(/%40/g, '@')).join(',')}?subject=${enc(asunto)}&body=${enc(texto)}`;
}
