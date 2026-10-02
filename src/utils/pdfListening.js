// Ficha imprimible de un Listening del profesor (LISTENING_RECURSO).
//   generarPdfListening(recurso, { modoHuecos, preguntas, solucionario, codigo })
//   · modoHuecos: 'escribir' → hueco en blanco para escribir la palabra
//                 'opciones' → hueco numerado + debajo del texto las opciones a/b/c/d
//   · preguntas:  incluir las preguntas de comprensión
//   · solucionario: página final con las respuestas (para el profesor)
//   · codigo:     imprimir el código de acceso para escuchar el audio en pikt.es
// Texto real de jsPDF (no captura): nítido y ligero.
import { construirItem, getIdiomaCrear } from '../listeningCrear.js';

const MM = { margen: 18, ancho: 210, alto: 297 };
const ANCHO_UTIL = MM.ancho - MM.margen * 2;
const HUECO_MM = 28;           // largo de la raya del hueco (igual para todos: no da pistas)

// Instrucciones en el idioma del listening
const TEXTOS = {
    en: { nombre: 'Name', curso: 'Class', fecha: 'Date', huecosE: 'Listen and write the missing words.', huecosO: 'Listen and choose the correct word for each gap.', preguntas: 'Listen and answer the questions. Circle the correct option.', opciones: 'Options', soluciones: 'Answer key', escucha: 'Listen again at pikt.es with the code' },
    fr: { nombre: 'Nom', curso: 'Classe', fecha: 'Date', huecosE: 'Écoute et écris les mots qui manquent.', huecosO: 'Écoute et choisis le bon mot pour chaque trou.', preguntas: 'Écoute et réponds aux questions. Entoure la bonne réponse.', opciones: 'Options', soluciones: 'Corrigé', escucha: 'Réécoute sur pikt.es avec le code' },
    de: { nombre: 'Name', curso: 'Klasse', fecha: 'Datum', huecosE: 'Hör zu und schreib die fehlenden Wörter.', huecosO: 'Hör zu und wähle das richtige Wort für jede Lücke.', preguntas: 'Hör zu und beantworte die Fragen. Kreise die richtige Antwort ein.', opciones: 'Optionen', soluciones: 'Lösungen', escucha: 'Hör noch einmal auf pikt.es mit dem Code' },
    it: { nombre: 'Nome', curso: 'Classe', fecha: 'Data', huecosE: 'Ascolta e scrivi le parole mancanti.', huecosO: 'Ascolta e scegli la parola giusta per ogni spazio.', preguntas: 'Ascolta e rispondi alle domande. Cerchia la risposta corretta.', opciones: 'Opzioni', soluciones: 'Soluzioni', escucha: 'Riascolta su pikt.es con il codice' },
    pt: { nombre: 'Nome', curso: 'Turma', fecha: 'Data', huecosE: 'Ouve e escreve as palavras que faltam.', huecosO: 'Ouve e escolhe a palavra certa para cada espaço.', preguntas: 'Ouve e responde às perguntas. Assinala a opção correta.', opciones: 'Opções', soluciones: 'Soluções', escucha: 'Ouve outra vez em pikt.es com o código' },
    es: { nombre: 'Nombre', curso: 'Curso', fecha: 'Fecha', huecosE: 'Escucha y escribe las palabras que faltan.', huecosO: 'Escucha y elige la palabra correcta para cada hueco.', preguntas: 'Escucha y contesta las preguntas. Rodea la opción correcta.', opciones: 'Opciones', soluciones: 'Soluciones', escucha: 'Vuelve a escucharlo en pikt.es con el código' },
    ca: { nombre: 'Nom', curso: 'Curs', fecha: 'Data', huecosE: 'Escolta i escriu les paraules que falten.', huecosO: 'Escolta i tria la paraula correcta per a cada buit.', preguntas: 'Escolta i respon les preguntes. Encercla l’opció correcta.', opciones: 'Opcions', soluciones: 'Solucions', escucha: 'Torna a escoltar-lo a pikt.es amb el codi' },
};

// Las fuentes estándar de jsPDF (WinAnsi) no tienen comillas tipográficas raras ni emojis
const seguro = (s) => String(s ?? '')
    .replace(/[’‘‚‛]/g, "'").replace(/[“”„‟«»]/g, '"').replace(/…/g, '...')
    .replace(/[–—]/g, '-').replace(/ /g, ' ')
    .replace(/[^\x09\x0A\x0D\x20-\x7E -ÿ]/g, '');

export async function generarPdfListening(recurso, { modoHuecos = 'escribir', preguntas: conPreguntas = true, solucionario = true, codigo = true, descargar = true } = {}) {
    const { jsPDF } = await import('jspdf');
    const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
    const T = TEXTOS[recurso.idioma] || TEXTOS.en;
    const idi = getIdiomaCrear(recurso.idioma);
    const item = construirItem(recurso);                 // opciones ya barajadas, una vez
    const preguntas = conPreguntas ? (recurso.preguntas || []).filter(p => p.enunciado && p.opciones?.length >= 2) : [];
    const hayHuecos = item.gaps.length > 0;

    let y = MM.margen;
    const saltoSiNoCabe = (alto) => {
        if (y + alto > MM.alto - MM.margen) { pdf.addPage(); y = MM.margen; }
    };
    const fuente = (estilo = 'normal', tam = 11, color = [30, 30, 30]) => {
        pdf.setFont('helvetica', estilo); pdf.setFontSize(tam); pdf.setTextColor(...color);
    };
    // Párrafo con ajuste de línea; devuelve la altura usada
    const parrafo = (texto, { x = MM.margen, ancho = ANCHO_UTIL, tam = 11, estilo = 'normal', color, interlinea = 1.45 } = {}) => {
        fuente(estilo, tam, color);
        const lineas = pdf.splitTextToSize(seguro(texto), ancho);
        const alto = lineas.length * tam * 0.3528 * interlinea;
        saltoSiNoCabe(alto);
        lineas.forEach((l, i) => pdf.text(l, x, y + tam * 0.3528 + i * tam * 0.3528 * interlinea));
        y += alto;
        return alto;
    };
    const titulo = (texto) => {
        saltoSiNoCabe(14);
        y += 4;
        fuente('bold', 12.5, [108, 52, 131]);
        pdf.text(seguro(texto), MM.margen, y + 4.5);
        y += 8;
    };

    // ── Cabecera ──
    fuente('bold', 17, [44, 62, 80]);
    const tit = pdf.splitTextToSize(seguro(recurso.titulo || 'Listening'), ANCHO_UTIL - 30);
    tit.forEach((l, i) => pdf.text(l, MM.margen, y + 6 + i * 7.5));
    fuente('bold', 10, [108, 52, 131]);
    pdf.text(seguro(`${idi.label}${recurso.nivel ? ' · ' + recurso.nivel : ''}`), MM.ancho - MM.margen, y + 6, { align: 'right' });
    y += 6 + tit.length * 7.5;

    fuente('normal', 10, [90, 90, 90]);
    pdf.text(`${T.nombre}: ________________________________   ${T.curso}: __________   ${T.fecha}: ___________`, MM.margen, y + 3);
    y += 7;
    if (codigo && recurso.accessCode) {
        fuente('italic', 9, [120, 120, 120]);
        pdf.text(seguro(`${T.escucha}: ${recurso.accessCode}`), MM.margen, y + 3);
        y += 6;
    }
    pdf.setDrawColor(220, 205, 230); pdf.setLineWidth(0.5);
    pdf.line(MM.margen, y, MM.ancho - MM.margen, y);
    y += 3;

    // ── Partes en el orden elegido por el profesor ──
    const orden = (recurso.ordenPartes === 'huecos' ? ['HUECOS', 'PREGUNTAS'] : ['PREGUNTAS', 'HUECOS'])
        .filter(p => p === 'HUECOS' ? hayHuecos : preguntas.length > 0);
    let nParte = 0;
    for (const parte of orden) {
        nParte++;
        if (parte === 'HUECOS') {
            titulo(`${nParte}. ${modoHuecos === 'opciones' ? T.huecosO : T.huecosE}`);
            textoConHuecos(pdf, item, () => y, v => { y = v; }, saltoSiNoCabe);
            if (modoHuecos === 'opciones') {
                y += 3;
                saltoSiNoCabe(10);
                fuente('bold', 10, [108, 52, 131]);
                pdf.text(seguro(T.opciones), MM.margen, y + 3.5);
                y += 6;
                listaOpciones(pdf, item.gaps, () => y, v => { y = v; }, saltoSiNoCabe);
            }
        } else {
            titulo(`${nParte}. ${T.preguntas}`);
            preguntas.forEach((p, i) => {
                saltoSiNoCabe(8 + p.opciones.length * 6.2);
                parrafo(`${i + 1}. ${p.enunciado}`, { estilo: 'bold', tam: 10.5 });
                y += 1;
                p.opciones.forEach((o, k) => {
                    parrafo(`${String.fromCharCode(97 + k)})  ${o}`, { x: MM.margen + 6, ancho: ANCHO_UTIL - 6, tam: 10.5, interlinea: 1.35 });
                    y += 0.8;
                });
                y += 3;
            });
        }
    }

    // ── Solucionario ──
    if (solucionario) {
        pdf.addPage(); y = MM.margen;
        fuente('bold', 15, [44, 62, 80]);
        pdf.text(seguro(`${T.soluciones} · ${recurso.titulo || 'Listening'}`), MM.margen, y + 5);
        y += 11;
        if (hayHuecos) {
            titulo(T.huecosE.replace(/\.$/, ''));
            const lineas = item.gaps.map(g => {
                const k = g.multiple_choice_options.indexOf(g.answer);
                return `${g.gap_number}. ${g.answer}${modoHuecos === 'opciones' && k >= 0 ? `  (${String.fromCharCode(97 + k)})` : ''}`;
            });
            columnas(pdf, lineas, () => y, v => { y = v; }, saltoSiNoCabe);
        }
        if (preguntas.length) {
            titulo(T.preguntas.split('.')[0]);
            columnas(pdf, preguntas.map((p, i) => `${i + 1}. ${String.fromCharCode(97 + p.correcta)}) ${p.opciones[p.correcta] || ''}`), () => y, v => { y = v; }, saltoSiNoCabe, 2);
        }
        y += 4;
        titulo('Transcript');
        parrafo(item.fullTranscript, { tam: 9.5, color: [80, 80, 80] });
    }

    // ── Pie de página ──
    const total = pdf.getNumberOfPages();
    for (let i = 1; i <= total; i++) {
        pdf.setPage(i);
        fuente('normal', 8, [170, 170, 170]);
        pdf.text(`pikt.es · Listening`, MM.margen, MM.alto - 8);
        pdf.text(`${i} / ${total}`, MM.ancho - MM.margen, MM.alto - 8, { align: 'right' });
    }

    const nombre = (recurso.titulo || 'listening').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase();
    if (descargar) pdf.save(`${nombre || 'listening'}-ficha.pdf`);
    return pdf;
}

// Texto corrido con los huecos «(n) ____» dentro, respetando saltos de línea
function textoConHuecos(pdf, item, getY, setY, saltoSiNoCabe) {
    const tam = 11.5;
    const alto = tam * 0.3528 * 2.0;                      // interlineado amplio para escribir
    const x0 = MM.margen, xMax = MM.margen + ANCHO_UTIL;
    pdf.setFont('helvetica', 'normal'); pdf.setFontSize(tam); pdf.setTextColor(30, 30, 30);

    // Fichas: palabras (con su espacio), huecos y saltos de línea
    const fichas = [];
    item.gappedTranscript.split(/(\[___\d+___\]|\n)/).forEach(parte => {
        if (!parte) return;
        if (parte === '\n') { fichas.push({ tipo: 'salto' }); return; }
        const m = parte.match(/^\[___(\d+)___\]$/);
        if (m) { fichas.push({ tipo: 'hueco', n: m[1] }); return; }
        seguro(parte).split(/(\s+)/).forEach(w => { if (w) fichas.push({ tipo: /^\s+$/.test(w) ? 'espacio' : 'texto', t: w }); });
    });

    let x = x0;
    let y = getY() + 2;
    const nuevaLinea = () => {
        x = x0; y += alto;
        if (y + alto > MM.alto - MM.margen) { setY(y); saltoSiNoCabe(alto + 1e3); y = getY(); }
    };
    saltoSiNoCabe(alto);
    y = Math.max(y, getY());
    for (const f of fichas) {
        if (f.tipo === 'salto') { nuevaLinea(); continue; }
        if (f.tipo === 'espacio') { if (x > x0) x += pdf.getTextWidth(' '); continue; }
        if (f.tipo === 'texto') {
            const w = pdf.getTextWidth(f.t);
            if (x + w > xMax && x > x0) nuevaLinea();
            pdf.text(f.t, x, y + tam * 0.3528);
            x += w;
            continue;
        }
        // Hueco: número pequeño + raya
        pdf.setFontSize(8);
        const etiqueta = `(${f.n})`;
        const wEt = pdf.getTextWidth(etiqueta);
        if (x + wEt + HUECO_MM > xMax && x > x0) nuevaLinea();
        pdf.setTextColor(108, 52, 131);
        pdf.text(etiqueta, x, y + tam * 0.3528);
        pdf.setDrawColor(120, 120, 120); pdf.setLineWidth(0.3);
        pdf.line(x + wEt + 0.8, y + tam * 0.3528 + 0.8, x + wEt + 0.8 + HUECO_MM, y + tam * 0.3528 + 0.8);
        x += wEt + 0.8 + HUECO_MM;
        pdf.setFontSize(tam); pdf.setTextColor(30, 30, 30);
    }
    setY(y + alto);
}

// Opciones de cada hueco: «1. ○ a) x  ○ b) y …», en dos columnas si caben
function listaOpciones(pdf, gaps, getY, setY, saltoSiNoCabe) {
    const tam = 10;
    pdf.setFont('helvetica', 'normal'); pdf.setFontSize(tam); pdf.setTextColor(30, 30, 30);
    const textos = gaps.map(g => `${g.gap_number}.   ` + g.multiple_choice_options.map((o, k) => `${String.fromCharCode(97 + k)}) ${seguro(o)}`).join('     '));
    const anchoCol = (ANCHO_UTIL - 8) / 2;
    const dosColumnas = textos.every(t => pdf.getTextWidth(t) <= anchoCol);
    columnas(pdf, textos, getY, setY, saltoSiNoCabe, dosColumnas ? 2 : 1, tam);
}

// Lista en 1-3 columnas, rellenando por filas
function columnas(pdf, textos, getY, setY, saltoSiNoCabe, nCol = 3, tam = 10.5) {
    pdf.setFont('helvetica', 'normal'); pdf.setFontSize(tam); pdf.setTextColor(30, 30, 30);
    const alto = tam * 0.3528 * 1.9;
    const anchoCol = (ANCHO_UTIL - 8 * (nCol - 1)) / nCol;
    for (let i = 0; i < textos.length; i += nCol) {
        saltoSiNoCabe(alto);
        const y = getY();
        textos.slice(i, i + nCol).forEach((t, c) => {
            const linea = pdf.splitTextToSize(seguro(t), anchoCol)[0];
            pdf.text(linea, MM.margen + c * (anchoCol + 8), y + tam * 0.3528);
        });
        setY(y + alto);
    }
}
