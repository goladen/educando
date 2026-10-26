// Ficha imprimible de CUALQUIER recurso del profesor (resources): versión en papel
// para trabajar en clase o en casa y después terminar jugando con el mismo recurso.
//   formatosDisponibles(recurso) → [{ id, label, desc }]
//   generarPdfRecurso(recurso, { formato, hojas, barajar, soluciones, juego, qr, descargar })
//   · hojas: índices de las hojas incluidas (por defecto todas)
//   · juego: { label, url } del juego con el que se jugará después (QR + enlace en la cabecera)
// Texto real de jsPDF (no captura): nítido y ligero. Mismo estilo que utils/pdfListening.js.
import { normalizarPregunta, barajar as mezclar, limpiar } from './normalizarPreguntas';

const MM = { margen: 16, ancho: 210, alto: 297 };
const ANCHO_UTIL = MM.ancho - MM.margen * 2;
const PT = 0.3528;                         // 1 pt en mm
const MORADO = [76, 29, 149];
const GRIS = [100, 116, 139];
const ABC = 'ABCDEFGHIJKLMNÑOPQRSTUVWXYZ'.split('');
const MESES = ['', 'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

// Las fuentes estándar de jsPDF (WinAnsi) no tienen comillas tipográficas raras ni emojis
const seguro = (s) => String(s ?? '')
    .replace(/[’‘‚‛]/g, "'").replace(/[“”„‟«»]/g, '"').replace(/…/g, '...')
    .replace(/[–—]/g, '-').replace(/ /g, ' ')
    .replace(/[^\x09\x0A\x0D\x20-\x7E\xA0-\xFF]/g, '').replace(/\s+/g, ' ').trim();

const letraOpc = (k) => String.fromCharCode(97 + k);

// ─────────────────────────────────────────────────────────────
// Lectura de los datos del recurso
// ─────────────────────────────────────────────────────────────
export const hojasDe = (r) => (Array.isArray(r?.hojas) && r.hojas.length
    ? r.hojas
    : [{ nombreHoja: r?.titulo || 'Preguntas', preguntas: r?.preguntas || [] }]);

const nombreHoja = (h, i) => String(h?.nombreHoja || `Hoja ${i + 1}`).trim() || `Hoja ${i + 1}`;

// Palabra «jugable» en una sopa / anagrama: una sola palabra de letras, 3-14
const palabraSopa = (s) => {
    const w = String(s || '').trim().toUpperCase()
        .replace(/[ÁÀÂÄ]/g, 'A').replace(/[ÉÈÊË]/g, 'E').replace(/[ÍÌÎÏ]/g, 'I').replace(/[ÓÒÔÖ]/g, 'O').replace(/[ÚÙÛÜ]/g, 'U');
    return /^[A-ZÑÇ]{3,14}$/.test(w) ? w : null;
};

// Pasapalabra: { letra, def, resp } ordenados por el abecedario
function roscoDeHoja(h) {
    const items = (h.preguntas || []).map(p => {
        const resp = String(p.respuesta ?? p.correcta ?? '').trim();
        // Quitamos el «Empieza por X:» / «Contiene la X:» si el profe ya lo escribió (lo pone la ficha)
        const def = String(p.pregunta ?? p.definicion ?? '').trim()
            .replace(/^(empieza|comienza|contiene)\s+(por|con|la)?\s*(la\s+)?[a-zñ]\s*[:.\-]\s*/i, '');
        if (!resp || !def) return null;
        const letra = String(p.letra || resp[0] || '?').trim().toUpperCase().slice(0, 1);
        const contiene = !limpiar(resp).startsWith(limpiar(letra));
        return { letra, def, resp, contiene: p.tipo === 'contiene' || contiene };
    }).filter(Boolean);
    const pos = (l) => { const i = ABC.indexOf(l); return i < 0 ? 99 : i; };
    return items.sort((a, b) => pos(a.letra) - pos(b.letra));
}

// Preguntas normalizadas (multiple / corta / rellenar / ordenar)
const preguntasDeHoja = (h) => (h.preguntas || []).map(normalizarPregunta).filter(Boolean);

// Parejas para «unir con flechas»: AparejaDOS o pregunta → respuesta corta
function paresDeHoja(h, tipoJuego) {
    if (tipoJuego === 'APAREJADOS') {
        return (h.preguntas || []).map(p => ({ a: String(p.terminoA ?? '').trim(), b: String(p.terminoB ?? '').trim() }))
            .filter(p => p.a && p.b);
    }
    if (tipoJuego === 'PASAPALABRA') return roscoDeHoja(h).map(x => ({ a: x.def, b: x.resp }));
    return preguntasDeHoja(h).filter(q => q.tipo !== 'ORDENAR' && q.tipo !== 'RELLENAR' && q.correcta.length <= 40)
        .map(q => ({ a: q.enunciado, b: q.correcta }));
}

// Palabras de una sopa / anagrama: { palabra, pista? }
function palabrasDeHoja(h, tipoJuego) {
    if (Array.isArray(h.palabras)) return h.palabras.map(palabraSopa).filter(Boolean).map(palabra => ({ palabra }));
    return paresDeHoja(h, tipoJuego).map(p => ({ palabra: palabraSopa(p.b), pista: p.a })).filter(p => p.palabra);
}

const frasesRuleta = (h) => (h.frasesOcultas?.length ? h.frasesOcultas : [h.fraseOculta]).map(f => String(f || '').trim()).filter(Boolean);

const valorFecha = (ev) => {
    const a = parseInt(ev.anio, 10) || 0;
    const m = ev.fechaTipo === 'dia' ? (parseInt(ev.mes, 10) || 0) : 0;
    const d = ev.fechaTipo === 'dia' ? (parseInt(ev.dia, 10) || 0) : 0;
    return a * 10000 + m * 100 + d;
};
const fechaTexto = (ev) => {
    const a = parseInt(ev.anio, 10);
    if (isNaN(a)) return '?';
    const anio = a < 0 ? `${Math.abs(a)} a.C.` : `${a}`;
    if (ev.fechaTipo === 'dia' && ev.dia && ev.mes) return `${parseInt(ev.dia, 10)} de ${MESES[parseInt(ev.mes, 10)] || '?'} de ${anio}`;
    return anio;
};

// ─────────────────────────────────────────────────────────────
// Formatos posibles según el recurso
// ─────────────────────────────────────────────────────────────
const FORMATOS = {
    ROSCO:     { label: 'Rosco en papel', emoji: '🔤', desc: 'Definiciones por letra con hueco para la respuesta' },
    TEST:      { label: 'Test', emoji: '🔘', desc: 'Preguntas con opciones a/b/c/d para rodear' },
    RESPUESTA: { label: 'Preguntas abiertas', emoji: '✍️', desc: 'Sin opciones: el alumno escribe la respuesta' },
    UNIR:      { label: 'Unir con flechas', emoji: '↔️', desc: 'Dos columnas para emparejar' },
    SOPA:      { label: 'Sopa de letras', emoji: '🔎', desc: 'Cuadrícula con las palabras escondidas' },
    ANAGRAMA:  { label: 'Letras desordenadas', emoji: '🔀', desc: 'Ordena las letras de cada palabra' },
    RULETA:    { label: 'Panel de la Ruleta', emoji: '🎡', desc: 'Pistas + panel con casillas para la frase oculta' },
    LINEA:     { label: 'Ordenar en el tiempo', emoji: '🕰️', desc: 'Eventos desordenados para numerar y fechar' },
    ETIQUETAS: { label: 'Imagen para etiquetar', emoji: '🏷️', desc: 'Imagen con puntos numerados para escribir' },
};

export function formatosDisponibles(r) {
    if (!r) return [];
    const t = r.tipoJuego;
    const hojas = hojasDe(r);
    const cuenta = (fn) => hojas.reduce((s, h) => s + fn(h).length, 0);
    const ids = [];
    if (t === 'PASAPALABRA' && cuenta(roscoDeHoja)) ids.push('ROSCO');
    if (t === 'RULETA' && hojas.some(h => frasesRuleta(h).length)) ids.push('RULETA');
    if (t === 'LINEA_TIEMPO' && cuenta(h => h.eventos || []) >= 2) ids.push('LINEA');
    if (t === 'ETIQUETAS' && hojas.some(h => h.imageUrl && h.markers?.length)) ids.push('ETIQUETAS');
    if (t !== 'PASAPALABRA' && t !== 'APAREJADOS' && cuenta(preguntasDeHoja)) {
        if (cuenta(h => preguntasDeHoja(h).filter(q => q.tipo === 'MULTIPLE'))) ids.push('TEST');
        ids.push('RESPUESTA');
    }
    if (cuenta(h => paresDeHoja(h, t)) >= 3) ids.push('UNIR');
    if (cuenta(h => palabrasDeHoja(h, t)) >= 3) ids.push('SOPA', 'ANAGRAMA');
    return ids.map(id => ({ id, ...FORMATOS[id] }));
}

// ─────────────────────────────────────────────────────────────
// Motor de maquetación (cursor vertical + saltos de página)
// ─────────────────────────────────────────────────────────────
function crearMaquetador(pdf) {
    const D = { pdf, y: MM.margen };
    D.fuente = (estilo = 'normal', tam = 11, color = [30, 30, 30]) => {
        pdf.setFont('helvetica', estilo); pdf.setFontSize(tam); pdf.setTextColor(...color);
    };
    D.salto = (alto) => { if (D.y + alto > MM.alto - MM.margen - 6) { pdf.addPage(); D.y = MM.margen; return true; } return false; };
    D.lineas = (texto, ancho, tam, estilo = 'normal') => { D.fuente(estilo, tam); return pdf.splitTextToSize(seguro(texto), ancho); };
    D.parrafo = (texto, { x = MM.margen, ancho = ANCHO_UTIL, tam = 11, estilo = 'normal', color, interlinea = 1.4 } = {}) => {
        const ls = D.lineas(texto, ancho, tam, estilo);
        const alto = ls.length * tam * PT * interlinea;
        D.salto(alto);
        D.fuente(estilo, tam, color);
        ls.forEach((l, i) => pdf.text(l, x, D.y + tam * PT + i * tam * PT * interlinea));
        D.y += alto;
        return alto;
    };
    D.titulo = (texto, color = MORADO) => {
        D.salto(16);
        D.y += 3;
        D.fuente('bold', 12.5, color);
        pdf.splitTextToSize(seguro(texto), ANCHO_UTIL).forEach(l => { pdf.text(l, MM.margen, D.y + 4.5); D.y += 6; });
        D.y += 1.5;
    };
    D.raya = (x1, x2, y) => { pdf.setDrawColor(150, 150, 150); pdf.setLineWidth(0.3); pdf.line(x1, y, x2, y); };
    D.circulo = (x, y, r, relleno) => {
        pdf.setDrawColor(...MORADO); pdf.setLineWidth(0.35);
        if (relleno) { pdf.setFillColor(...relleno); pdf.circle(x, y, r, 'FD'); } else pdf.circle(x, y, r, 'S');
    };
    return D;
}

// Cabecera común: título, nombre/curso/fecha y caja «después jugamos en clase»
function cabecera(D, recurso, formato, subtitulo, juego, qrImg) {
    const { pdf } = D;
    D.fuente('bold', 18, [44, 62, 80]);
    const tit = pdf.splitTextToSize(seguro(recurso.titulo || 'Ficha'), ANCHO_UTIL);
    tit.forEach((l, i) => pdf.text(l, MM.margen, D.y + 6.5 + i * 7.5));
    D.y += 6.5 + tit.length * 7.5 - 2;
    D.fuente('bold', 10, MORADO);
    pdf.text(seguro(`${FORMATOS[formato]?.label || ''}${subtitulo ? ' · ' + subtitulo : ''}`), MM.margen, D.y + 3);
    D.y += 7;
    D.fuente('normal', 10, [90, 90, 90]);
    pdf.text('Nombre: ________________________________________   Curso: __________   Fecha: ___________', MM.margen, D.y + 3);
    D.y += 7;

    if (juego) {
        const alto = qrImg ? 27 : 16;
        pdf.setDrawColor(196, 181, 253); pdf.setFillColor(245, 243, 255); pdf.setLineWidth(0.4);
        pdf.roundedRect(MM.margen, D.y, ANCHO_UTIL, alto, 3, 3, 'FD');
        const xt = MM.margen + 5;
        D.fuente('bold', 11.5, MORADO);
        pdf.text('Después lo jugaremos en clase', xt, D.y + 6.5);
        D.fuente('normal', 9.5, [60, 60, 60]);
        pdf.text(seguro(`Juego: ${juego.label}${recurso.accessCode ? `   ·   Código en pikt.es: ${recurso.accessCode}` : ''}`), xt, D.y + 11.5);
        if (qrImg) {
            D.fuente('normal', 8, GRIS);
            const url = pdf.splitTextToSize(seguro(juego.url), ANCHO_UTIL - 40);
            url.slice(0, 2).forEach((l, i) => pdf.text(l, xt, D.y + 17 + i * 3.6));
            pdf.addImage(qrImg, 'PNG', MM.margen + ANCHO_UTIL - 25, D.y + 2, 23, 23);
        } else {
            D.fuente('normal', 8, GRIS);
            pdf.text(seguro(juego.url), xt, D.y + 15);
        }
        D.y += alto + 3;
    } else if (recurso.accessCode) {
        D.fuente('italic', 9, GRIS);
        pdf.text(seguro(`Juégalo en pikt.es con el código ${recurso.accessCode}`), MM.margen, D.y + 3);
        D.y += 6;
    }
    pdf.setDrawColor(221, 214, 254); pdf.setLineWidth(0.5);
    pdf.line(MM.margen, D.y, MM.ancho - MM.margen, D.y);
    D.y += 3;
}

// ─────────────────────────────────────────────────────────────
// Formatos
// ─────────────────────────────────────────────────────────────

// TEST / RESPUESTA: preguntas numeradas; devuelve las soluciones
function bloquePreguntas(D, preguntas, abiertas, n0) {
    const { pdf } = D;
    const sol = [];
    preguntas.forEach((q, i) => {
        const n = n0 + i + 1;
        const tipo = abiertas && q.tipo === 'MULTIPLE' ? 'CORTA' : q.tipo;
        // Calcular el alto para no partir la pregunta entre páginas
        const enun = tipo === 'RELLENAR' ? `${q.bloques[0]} __________ ${q.bloques[2]}`.trim() : q.enunciado;
        const lsEnun = D.lineas(`${n}. ${enun}`, ANCHO_UTIL, 10.5, 'bold');
        let altoExtra = 9;
        let enFila = false;
        if (tipo === 'MULTIPLE') {
            D.fuente('normal', 10.5);
            const anchos = q.opciones.map(o => pdf.getTextWidth(seguro(o)) + 14);
            enFila = anchos.reduce((s, w) => s + w, 0) <= ANCHO_UTIL - 6;
            altoExtra = enFila ? 8 : q.opciones.reduce((s, o) => s + D.lineas(o, ANCHO_UTIL - 14, 10.5).length * 5.2 + 1, 2);
        }
        D.salto(lsEnun.length * 5.2 + altoExtra + 3);
        D.fuente('bold', 10.5, [30, 30, 30]);
        lsEnun.forEach((l, k) => pdf.text(l, MM.margen, D.y + 4 + k * 5.2));
        D.y += lsEnun.length * 5.2 + 1.5;

        if (tipo === 'MULTIPLE') {
            const k = q.opciones.indexOf(q.correcta);
            sol.push(`${n}. ${letraOpc(k)}) ${q.correcta}`);
            D.fuente('normal', 10.5, [30, 30, 30]);
            if (enFila) {
                let x = MM.margen + 6;
                q.opciones.forEach((o, j) => {
                    D.circulo(x + 1.6, D.y + 2.6, 1.6);
                    pdf.text(`${letraOpc(j)}) ${seguro(o)}`, x + 4.5, D.y + 4);
                    x += pdf.getTextWidth(`${letraOpc(j)}) ${seguro(o)}`) + 12;
                });
                D.y += 7;
            } else {
                q.opciones.forEach((o, j) => {
                    const ls = D.lineas(`${letraOpc(j)}) ${o}`, ANCHO_UTIL - 14, 10.5);
                    D.circulo(MM.margen + 7.6, D.y + 2.6, 1.6);
                    D.fuente('normal', 10.5, [30, 30, 30]);
                    ls.forEach((l, m) => pdf.text(l, MM.margen + 11, D.y + 4 + m * 5.2));
                    D.y += ls.length * 5.2 + 1;
                });
                D.y += 1;
            }
        } else if (tipo === 'ORDENAR') {
            sol.push(`${n}. ${q.correcta}`);
            D.fuente('normal', 10, [30, 30, 30]);
            let x = MM.margen + 6;
            mezclar(q.bloques).forEach(b => {
                const t = seguro(b); const w = pdf.getTextWidth(t) + 5;
                if (x + w > MM.margen + ANCHO_UTIL) { x = MM.margen + 6; D.y += 7.5; }
                pdf.setDrawColor(167, 139, 250); pdf.setLineWidth(0.3);
                pdf.roundedRect(x, D.y, w, 6, 1.2, 1.2, 'S');
                pdf.text(t, x + 2.5, D.y + 4.2);
                x += w + 3;
            });
            D.y += 9;
            D.raya(MM.margen + 6, MM.margen + ANCHO_UTIL, D.y + 4); D.y += 8;
        } else {
            sol.push(`${n}. ${q.correcta}`);
            if (tipo !== 'RELLENAR') { D.raya(MM.margen + 6, MM.margen + ANCHO_UTIL, D.y + 6); D.y += 9; }
            else D.y += 2;
        }
        D.y += 2.5;
    });
    return sol;
}

// ROSCO de Pasapalabra: dibujo del rosco + lista de definiciones
function bloqueRosco(D, items) {
    const { pdf } = D;
    const letras = [...new Set(items.map(x => x.letra))];
    // Rosco
    const R = 26, cx = MM.ancho / 2, cy = D.y + R + 6;
    D.salto(2 * R + 14);
    const rL = Math.min(4.2, (2 * Math.PI * R) / letras.length / 2.3);
    letras.forEach((l, i) => {
        const a = -Math.PI / 2 + (2 * Math.PI * i) / letras.length;
        const x = cx + R * Math.cos(a), y = D.y + R + 6 + R * Math.sin(a);
        D.circulo(x, y, rL, [237, 233, 254]);
        D.fuente('bold', rL * 2.1, MORADO);
        pdf.text(l, x, y + rL * 0.38, { align: 'center' });
    });
    D.fuente('bold', 10, GRIS);
    pdf.text(`${items.length} preguntas`, cx, cy + 1.5, { align: 'center' });
    D.y += 2 * R + 14;

    const sol = [];
    items.forEach(it => {
        const pre = it.contiene ? `Contiene la ${it.letra}:` : `Empieza por ${it.letra}:`;
        const ls = D.lineas(`${pre} ${it.def}`, ANCHO_UTIL - 14, 10.5);
        D.salto(ls.length * 5.1 + 10);
        D.circulo(MM.margen + 4, D.y + 3.4, 3.4, [237, 233, 254]);
        D.fuente('bold', 10, MORADO);
        pdf.text(it.letra, MM.margen + 4, D.y + 4.8, { align: 'center' });
        D.fuente('normal', 10.5, [30, 30, 30]);
        ls.forEach((l, k) => pdf.text(l, MM.margen + 11, D.y + 4.5 + k * 5.1));
        D.y += ls.length * 5.1 + 1;
        D.raya(MM.margen + 11, MM.margen + 90, D.y + 4.5);
        D.y += 8;
        sol.push(`${it.letra}: ${it.resp}`);
    });
    return sol;
}

// UNIR con flechas: columna izquierda numerada, derecha barajada con letras
function bloqueUnir(D, pares) {
    const { pdf } = D;
    const sol = [];
    const anchoCol = ANCHO_UTIL / 2 - 14;
    // Grupos de 10 como máximo, equilibrados (12 → 6 + 6, no 10 + 2)
    const tam = Math.ceil(pares.length / Math.ceil(pares.length / 10));
    for (let g = 0; g < pares.length; g += tam) {
        const grupo = pares.slice(g, g + tam);
        const derecha = mezclar(grupo.map((p, i) => ({ ...p, i })));
        const filas = grupo.map((p, i) => {
            const la = D.lineas(`${g + i + 1}. ${p.a}`, anchoCol, 10.5);
            const lb = D.lineas(`${letraOpc(i)}) ${derecha[i].b}`, anchoCol, 10.5);
            return { la, lb, alto: Math.max(la.length, lb.length) * 5 + 5 };
        });
        D.salto(Math.min(filas.reduce((s, f) => s + f.alto, 0), 120));
        filas.forEach((f, i) => {
            D.salto(f.alto);
            D.fuente('normal', 10.5, [30, 30, 30]);
            f.la.forEach((l, k) => pdf.text(l, MM.margen, D.y + 4 + k * 5));
            f.lb.forEach((l, k) => pdf.text(l, MM.margen + ANCHO_UTIL / 2 + 12, D.y + 4 + k * 5));
            pdf.setFillColor(...MORADO);
            pdf.circle(MM.margen + anchoCol + 4, D.y + 2.8, 1.1, 'F');
            pdf.circle(MM.margen + ANCHO_UTIL / 2 + 8, D.y + 2.8, 1.1, 'F');
            D.y += f.alto;
        });
        // Casillas de respuesta
        D.salto(10);
        D.fuente('normal', 10, GRIS);
        const casillas = grupo.map((_, i) => `${g + i + 1} - ___`).join('    ');
        pdf.splitTextToSize(casillas, ANCHO_UTIL).forEach(l => { pdf.text(l, MM.margen, D.y + 4); D.y += 5.5; });
        D.y += 5;
        sol.push(grupo.map((_, i) => `${g + i + 1}-${letraOpc(derecha.findIndex(d => d.i === i))}`).join('  '));
    }
    return sol;
}

// SOPA DE LETRAS: genera la cuadrícula y la dibuja (con o sin solución marcada)
function crearSopa(palabras, dificil) {
    const ws = [...new Set(palabras)].sort((a, b) => b.length - a.length);
    const total = ws.reduce((s, w) => s + w.length, 0);
    const N = Math.min(18, Math.max(10, ws[0]?.length + 1 || 10, Math.ceil(Math.sqrt(total * 2.3))));
    const dirs = [[0, 1], [1, 0], [1, 1], [-1, 1]];
    if (dificil) dirs.push([0, -1], [-1, 0], [-1, -1], [1, -1]);
    for (let intento = 0; intento < 30; intento++) {
        const g = Array.from({ length: N }, () => Array(N).fill(null));
        const puestas = [];
        for (const w of ws) {
            let ok = false;
            for (let t = 0; t < 300 && !ok; t++) {
                const [dy, dx] = dirs[Math.floor(Math.random() * dirs.length)];
                const y0 = Math.floor(Math.random() * N), x0 = Math.floor(Math.random() * N);
                const y1 = y0 + dy * (w.length - 1), x1 = x0 + dx * (w.length - 1);
                if (y1 < 0 || y1 >= N || x1 < 0 || x1 >= N) continue;
                let cabe = true;
                for (let k = 0; k < w.length && cabe; k++) { const c = g[y0 + dy * k][x0 + dx * k]; if (c && c !== w[k]) cabe = false; }
                if (!cabe) continue;
                for (let k = 0; k < w.length; k++) g[y0 + dy * k][x0 + dx * k] = w[k];
                puestas.push({ w, y0, x0, y1, x1 });
                ok = true;
            }
        }
        if (puestas.length === ws.length || intento === 29) {
            const relleno = 'ABCDEFGHIJLMNOPRSTUVZ';
            for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (!g[y][x]) g[y][x] = relleno[Math.floor(Math.random() * relleno.length)];
            return { g, N, puestas };
        }
    }
    return null;
}

function dibujarSopa(D, sopa, marcar) {
    const { pdf } = D;
    const celda = Math.min(9, 150 / sopa.N);
    const lado = celda * sopa.N;
    D.salto(lado + 4);
    const x0 = (MM.ancho - lado) / 2, y0 = D.y + 2;
    pdf.setDrawColor(196, 181, 253); pdf.setLineWidth(0.5);
    pdf.roundedRect(x0 - 2, y0 - 2, lado + 4, lado + 4, 2, 2, 'S');
    if (marcar) {
        pdf.setDrawColor(250, 204, 21); pdf.setLineWidth(celda * 0.62); pdf.setLineCap?.('round');
        sopa.puestas.forEach(p => pdf.line(x0 + (p.x0 + 0.5) * celda, y0 + (p.y0 + 0.5) * celda, x0 + (p.x1 + 0.5) * celda, y0 + (p.y1 + 0.5) * celda));
        pdf.setLineCap?.('butt');
    }
    D.fuente('bold', celda * 1.75, [30, 30, 30]);
    for (let y = 0; y < sopa.N; y++) for (let x = 0; x < sopa.N; x++) {
        pdf.text(sopa.g[y][x], x0 + (x + 0.5) * celda, y0 + (y + 0.5) * celda + celda * 0.22, { align: 'center' });
    }
    D.y += lado + 8;
}

function columnas(D, textos, nCol = 3, tam = 10.5) {
    const { pdf } = D;
    const alto = tam * PT * 1.9;
    const anchoCol = (ANCHO_UTIL - 6 * (nCol - 1)) / nCol;
    for (let i = 0; i < textos.length; i += nCol) {
        D.salto(alto);
        D.fuente('normal', tam, [30, 30, 30]);
        textos.slice(i, i + nCol).forEach((t, c) => {
            pdf.text(pdf.splitTextToSize(seguro(t), anchoCol)[0] || '', MM.margen + c * (anchoCol + 6), D.y + tam * PT);
        });
        D.y += alto;
    }
}

// Panel de la Ruleta: casillas por letra, partiendo por palabras
function panelRuleta(D, frase, conLetras) {
    const { pdf } = D;
    const MAX = 16, c = 9;
    const filas = [];
    let fila = '';
    seguro(frase).toUpperCase().split(' ').filter(Boolean).forEach(w => {
        const cand = fila ? `${fila} ${w}` : w;
        if (cand.length > MAX && fila) { filas.push(fila); fila = w; } else fila = cand;
    });
    if (fila) filas.push(fila);
    D.salto(filas.length * (c + 1.5) + 8);
    pdf.setFillColor(30, 64, 175); pdf.setDrawColor(30, 64, 175);
    pdf.roundedRect(MM.margen, D.y, ANCHO_UTIL, filas.length * (c + 1.5) + 5, 2.5, 2.5, 'F');
    D.y += 3;
    filas.forEach(f => {
        const x0 = MM.ancho / 2 - (f.length * (c + 1)) / 2;
        f.split('').forEach((ch, i) => {
            if (ch === ' ') return;
            const x = x0 + i * (c + 1);
            const esLetra = /[A-ZÁÉÍÓÚÜÑÇ0-9]/.test(ch);
            pdf.setFillColor(255, 255, 255); pdf.rect(x, D.y, c, c, 'F');
            if (!esLetra || conLetras) {
                D.fuente('bold', 13, [30, 30, 30]);
                pdf.text(ch, x + c / 2, D.y + c * 0.72, { align: 'center' });
            }
        });
        D.y += c + 1.5;
    });
    D.y += 6;
}

// Imagen por URL → dataURL (necesita CORS; Cloudinary/Wikimedia lo permiten)
function cargarImagen(url) {
    return new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        const t = setTimeout(() => resolve(null), 12000);
        img.onload = () => {
            clearTimeout(t);
            try {
                const esc = Math.min(1, 1600 / Math.max(img.naturalWidth, img.naturalHeight));
                const cv = document.createElement('canvas');
                cv.width = Math.round(img.naturalWidth * esc); cv.height = Math.round(img.naturalHeight * esc);
                const ctx = cv.getContext('2d');
                ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, cv.width, cv.height);
                ctx.drawImage(img, 0, 0, cv.width, cv.height);
                resolve({ data: cv.toDataURL('image/jpeg', 0.88), w: cv.width, h: cv.height });
            } catch { resolve(null); }
        };
        img.onerror = () => { clearTimeout(t); resolve(null); };
        img.src = url;
    });
}

async function cargarQR(url) {
    try {
        const r = await fetch(`https://api.qrserver.com/v1/create-qr-code/?size=300x300&margin=4&data=${encodeURIComponent(url)}`);
        if (!r.ok) return null;
        const blob = await r.blob();
        return await new Promise(res => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.onerror = () => res(null); fr.readAsDataURL(blob); });
    } catch { return null; }
}

// ─────────────────────────────────────────────────────────────
// Generador principal
// ─────────────────────────────────────────────────────────────
export async function generarPdfRecurso(recurso, {
    formato, hojas: indices = null, barajar = false, soluciones = true, juego = null, qr = true, dificil = false, descargar = true,
} = {}) {
    const { jsPDF } = await import('jspdf');
    const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
    const D = crearMaquetador(pdf);
    const t = recurso.tipoJuego;
    const todas = hojasDe(recurso);
    const elegidas = todas.map((h, i) => ({ h, i, nombre: nombreHoja(h, i) }))
        .filter(x => !indices || indices.includes(x.i));
    const varias = elegidas.length > 1;
    const orden = (arr) => (barajar ? mezclar(arr) : arr);
    const subtitulo = elegidas.length === 1 && todas.length > 1 ? elegidas[0].nombre : '';
    const qrImg = juego?.url && qr ? await cargarQR(juego.url) : null;

    cabecera(D, recurso, formato, subtitulo, juego, qrImg);

    const instruccion = (txt) => { D.parrafo(txt, { tam: 10.5, estilo: 'italic', color: [71, 85, 105] }); D.y += 2; };
    const seccion = (nombre) => { if (varias) D.titulo(nombre); };
    const sol = [];                                         // [{ titulo, lineas, sopa? }]

    if (formato === 'TEST' || formato === 'RESPUESTA') {
        instruccion(formato === 'TEST' ? 'Rodea la opción correcta. Si no hay opciones, escribe la respuesta en la línea.' : 'Contesta a cada pregunta en la línea.');
        let n = 0;
        elegidas.forEach(({ h, nombre }) => {
            const qs = orden(preguntasDeHoja(h));
            if (!qs.length) return;
            seccion(nombre);
            sol.push({ titulo: nombre, lineas: bloquePreguntas(D, qs, formato === 'RESPUESTA', n) });
            n += qs.length;
        });
    } else if (formato === 'ROSCO') {
        elegidas.forEach(({ h, nombre }, k) => {
            const items = roscoDeHoja(h);
            if (!items.length) return;
            if (k > 0) { pdf.addPage(); D.y = MM.margen; }
            seccion(nombre);
            instruccion('Escribe la palabra que corresponde a cada definición. Empieza por la letra indicada (o la contiene).');
            sol.push({ titulo: nombre, lineas: bloqueRosco(D, items) });
        });
    } else if (formato === 'UNIR') {
        instruccion('Une con una flecha cada elemento de la izquierda con su pareja de la derecha y anota la letra abajo.');
        elegidas.forEach(({ h, nombre }) => {
            const pares = orden(paresDeHoja(h, t));
            if (!pares.length) return;
            seccion(nombre);
            sol.push({ titulo: nombre, lineas: bloqueUnir(D, pares) });
        });
    } else if (formato === 'SOPA' || formato === 'ANAGRAMA') {
        elegidas.forEach(({ h, nombre }, k) => {
            let items = palabrasDeHoja(h, t);
            const vistas = new Set();
            items = items.filter(x => !vistas.has(x.palabra) && vistas.add(x.palabra));
            if (!items.length) return;
            if (formato === 'SOPA') {
                items = items.slice(0, 20);
                const sopa = crearSopa(items.map(x => x.palabra), dificil);
                if (!sopa) return;
                const puestas = new Set(sopa.puestas.map(p => p.w));
                items = items.filter(x => puestas.has(x.palabra));
                if (k > 0) { pdf.addPage(); D.y = MM.margen; }
                seccion(nombre);
                const conPistas = items.some(x => x.pista);
                instruccion(conPistas
                    ? 'Resuelve cada pista y busca la palabra en la sopa de letras.'
                    : `Encuentra estas ${items.length} palabras en la sopa de letras${dificil ? ' (también hacia atrás)' : ''}.`);
                dibujarSopa(D, sopa, false);
                if (conPistas) {
                    items.forEach((x, i) => {
                        D.parrafo(`${i + 1}. ${x.pista} (${x.palabra.length} letras)`, { tam: 10, interlinea: 1.3 });
                        D.y += 1.2;
                    });
                } else columnas(D, items.map(x => x.palabra), 4);
                sol.push({ titulo: nombre, lineas: items.map((x, i) => (conPistas ? `${i + 1}. ${x.palabra}` : x.palabra)), sopa });
            } else {
                seccion(nombre);
                if (k === 0) instruccion('Ordena las letras para formar la palabra correcta.');
                const lista = orden(items).slice(0, 40);
                lista.forEach((x, i) => {
                    let rev = x.palabra;
                    for (let r = 0; r < 6 && rev === x.palabra; r++) rev = mezclar(x.palabra.split('')).join('');
                    const linea = x.pista ? `${i + 1}. ${x.pista}` : '';
                    if (linea) D.parrafo(linea, { tam: 10, interlinea: 1.3 });
                    D.salto(9);
                    D.fuente('bold', 12, MORADO);
                    pdf.text(`${x.pista ? '' : `${i + 1}.  `}${rev.split('').join(' ')}`, MM.margen + (x.pista ? 6 : 0), D.y + 4.5);
                    D.raya(MM.margen + 95, MM.margen + ANCHO_UTIL, D.y + 5);
                    D.y += 9;
                });
                sol.push({ titulo: nombre, lineas: lista.map((x, i) => `${i + 1}. ${x.palabra}`) });
            }
        });
    } else if (formato === 'RULETA') {
        let n = 0;
        elegidas.forEach(({ h, nombre }, k) => {
            const frases = frasesRuleta(h);
            if (!frases.length) return;
            if (k > 0) { pdf.addPage(); D.y = MM.margen; }
            seccion(nombre);
            const qs = orden(preguntasDeHoja(h));
            instruccion(qs.length
                ? 'Responde a las pistas: cada respuesta te ayuda a descubrir la frase oculta del panel. Escribe las letras en las casillas.'
                : 'Descubre la frase oculta y escribe sus letras en las casillas.');
            frases.forEach(f => panelRuleta(D, f, false));
            const lineas = [];
            if (qs.length) {
                D.titulo('Pistas', [30, 64, 175]);
                lineas.push(...bloquePreguntas(D, qs, false, n));
                n += qs.length;
            }
            sol.push({ titulo: nombre, lineas, paneles: frases });
        });
    } else if (formato === 'LINEA') {
        elegidas.forEach(({ h, nombre }) => {
            const evs = (h.eventos || []).filter(e => e.titulo);
            if (evs.length < 2) return;
            seccion(nombre);
            instruccion('Numera los acontecimientos del más antiguo (1) al más reciente y escribe su fecha.');
            const lista = mezclar(evs);
            lista.forEach(ev => {
                const ls = D.lineas(ev.titulo, ANCHO_UTIL - 60, 11, 'bold');
                const ld = ev.descripcion ? D.lineas(ev.descripcion, ANCHO_UTIL - 60, 9.5).slice(0, 3) : [];
                const alto = Math.max(12, ls.length * 5.2 + ld.length * 4.4 + 4);
                D.salto(alto + 2);
                pdf.setDrawColor(...MORADO); pdf.setLineWidth(0.4);
                pdf.roundedRect(MM.margen, D.y + 1, 10, 10, 1.5, 1.5, 'S');
                D.fuente('bold', 11, [30, 30, 30]);
                ls.forEach((l, k) => pdf.text(l, MM.margen + 15, D.y + 5 + k * 5.2));
                D.fuente('normal', 9.5, GRIS);
                ld.forEach((l, k) => pdf.text(l, MM.margen + 15, D.y + 5 + ls.length * 5.2 + k * 4.4));
                D.fuente('normal', 9, GRIS);
                pdf.text('Fecha:', MM.margen + ANCHO_UTIL - 40, D.y + 5);
                D.raya(MM.margen + ANCHO_UTIL - 29, MM.margen + ANCHO_UTIL, D.y + 5.5);
                D.y += alto + 2;
            });
            const ordenados = [...evs].sort((a, b) => valorFecha(a) - valorFecha(b));
            sol.push({ titulo: nombre, lineas: ordenados.map((e, i) => `${i + 1}. ${fechaTexto(e)} - ${e.titulo}`) });
        });
    } else if (formato === 'ETIQUETAS') {
        let primera = true;
        for (const { h, nombre } of elegidas) {
            const markers = (h.markers || []).filter(m => m.text);
            if (!h.imageUrl || !markers.length) continue;
            if (!primera) { pdf.addPage(); D.y = MM.margen; }
            primera = false;
            seccion(nombre);
            instruccion('Escribe el nombre de cada parte señalada con un número.');
            const img = await cargarImagen(h.imageUrl);
            if (img) {
                const maxH = Math.min(150, MM.alto - MM.margen - D.y - 60);
                const esc = Math.min(ANCHO_UTIL / img.w, Math.max(80, maxH) / img.h);
                const w = img.w * esc, alto = img.h * esc;
                D.salto(alto + 4);
                const x0 = (MM.ancho - w) / 2, y0 = D.y;
                pdf.addImage(img.data, 'JPEG', x0, y0, w, alto);
                markers.forEach((m, i) => {
                    const x = x0 + (m.anchorX / 100) * w, y = y0 + (m.anchorY / 100) * alto;
                    pdf.setFillColor(255, 255, 255); pdf.setDrawColor(220, 38, 38); pdf.setLineWidth(0.6);
                    pdf.circle(x, y, 3, 'FD');
                    D.fuente('bold', 8.5, [220, 38, 38]);
                    pdf.text(String(i + 1), x, y + 1.1, { align: 'center' });
                });
                D.y += alto + 6;
            } else {
                D.parrafo('(No se pudo descargar la imagen: el servidor donde está alojada no permite incluirla en el PDF.)', { tam: 9.5, color: [192, 57, 43] });
            }
            D.titulo('Banco de palabras', [30, 64, 175]);
            D.parrafo(mezclar(markers.map(m => m.text)).join('   ·   '), { tam: 10 });
            D.y += 3;
            columnas(D, markers.map((_, i) => `${i + 1}. ____________________`), 3, 10.5);
            sol.push({ titulo: nombre, lineas: markers.map((m, i) => `${i + 1}. ${m.text}`) });
        }
    }

    // ── Soluciones ──
    if (soluciones && sol.length) {
        pdf.addPage(); D.y = MM.margen;
        D.fuente('bold', 15, [44, 62, 80]);
        pdf.text(seguro(`Soluciones · ${recurso.titulo || ''}`), MM.margen, D.y + 5);
        D.y += 10;
        sol.forEach(s => {
            if (sol.length > 1 || varias) D.titulo(s.titulo);
            if (s.sopa) dibujarSopa(D, s.sopa, true);
            (s.paneles || []).forEach(f => panelRuleta(D, f, true));
            const largas = s.lineas.some(l => seguro(l).length > 34);
            if (largas) s.lineas.forEach(l => { D.parrafo(l, { tam: 10, interlinea: 1.3 }); D.y += 1; });
            else columnas(D, s.lineas, 3, 10);
        });
    }

    // ── Pie de página ──
    const total = pdf.getNumberOfPages();
    for (let i = 1; i <= total; i++) {
        pdf.setPage(i);
        D.fuente('normal', 8, [170, 170, 170]);
        pdf.text(seguro(`pikt.es · ${recurso.titulo || ''}`).slice(0, 90), MM.margen, MM.alto - 8);
        pdf.text(`${i} / ${total}`, MM.ancho - MM.margen, MM.alto - 8, { align: 'right' });
    }

    const nombre = (recurso.titulo || 'ficha').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase();
    if (descargar) pdf.save(`${nombre || 'ficha'}-${formato.toLowerCase()}.pdf`);
    return pdf;
}
