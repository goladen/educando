// ─────────────────────────────────────────────────────────────────────────────
//  Juegos de mesa en papel (jsPDF con texto real, se carga bajo demanda):
//    · generarPdfOca({ modo })      → tablero de la Oca Matemática (espiral 8×8 con la
//      operación de cada casilla) + reglas, hojas de cálculo de 4 jugadores y recortables
//      (dado, fichas y tarjetas con el número inicial de cada jugador).
//    · generarPdfDomino({ modo, grupos, soluciones }) → las 28 fichas recortables por
//      grupo (cada grupo con operaciones distintas) + reglas + hoja de soluciones.
//  Las operaciones salen de los mismos motores que los juegos (OcaMatematica.jsx y
//  fichasdomino.js): lo del papel es lo mismo que en pantalla.
// ─────────────────────────────────────────────────────────────────────────────

const A4 = { w: 210, h: 297, m: 12 };
const TINTA = [30, 30, 46];
const SUAVE = [100, 116, 139];

// Helvetica de jsPDF solo trae Latin-1
const seguro = (s) => String(s ?? '')
    .replace(/[−–—]/g, '-').replace(/÷/g, ':').replace(/…/g, '...')
    .replace(/[^\x09\x0A\x0D\x20-\x7E\xA0-\xFF]/g, '');

async function nuevoPdf() {
    const { jsPDF } = await import('jspdf');
    const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
    const txt = (s, x, y, { tam = 10, estilo = 'normal', color = TINTA, align = 'left', base = 'alphabetic', max } = {}) => {
        pdf.setFont('helvetica', estilo); pdf.setFontSize(tam); pdf.setTextColor(...color);
        const t = max ? pdf.splitTextToSize(seguro(s), max) : seguro(s);
        pdf.text(t, x, y, { align, baseline: base });
        return Array.isArray(t) ? t.length : 1;
    };
    // Tamaño de letra que hace caber el texto en un ancho
    const ajustar = (s, ancho, tam, min = 6, estilo = 'bold') => {
        pdf.setFont('helvetica', estilo);
        let t = tam;
        while (t > min) { pdf.setFontSize(t); if (pdf.getTextWidth(seguro(s)) <= ancho) break; t -= 0.5; }
        return t;
    };
    const pie = (texto) => {
        const n = pdf.getNumberOfPages();
        txt(texto, A4.m, A4.h - 6, { tam: 7, color: SUAVE });
        txt(`${n}`, A4.w - A4.m, A4.h - 6, { tam: 7, color: SUAVE, align: 'right' });
    };
    return { pdf, txt, ajustar, pie };
}

const fecha = () => new Date().toISOString().slice(0, 10);

// ═════════════════════════════════════════════════════════════════════════════
//  🦆 OCA MATEMÁTICA
// ═════════════════════════════════════════════════════════════════════════════
const NOMBRE_MODO_OCA = { NATURALES: 'Naturales', ENTEROS: 'Enteros', DECIMALES: 'Decimales', FRACCIONES: 'Fracciones' };
const COLORES_FICHA = [[231, 76, 60], [52, 152, 219], [46, 204, 113], [243, 156, 18]];
const PUNTOS_DADO = { 1: [[.5, .5]], 2: [[.27, .27], [.73, .73]], 3: [[.27, .27], [.5, .5], [.73, .73]], 4: [[.27, .27], [.73, .27], [.27, .73], [.73, .73]], 5: [[.27, .27], [.73, .27], [.5, .5], [.27, .73], [.73, .73]], 6: [[.27, .22], [.73, .22], [.27, .5], [.73, .5], [.27, .78], [.73, .78]] };

export async function generarPdfOca({ modo = 'NATURALES', descargar = true } = {}) {
    const oca = await import('../OcaMatematica');
    const { SQUARE_POS, OCAS, PUENTE_A, PUENTE_B, CARCEL, CAVERNA, MUERTE, META, getOp, opLabel, genBase, baseStr } = oca.OCA_PAPEL;
    const { pdf, txt, ajustar, pie } = await nuevoPdf();
    const nombreModo = NOMBRE_MODO_OCA[modo] || modo;
    const PIE = `La Oca Matemática · ${nombreModo} · pikt.es/oca`;

    const especial = (i) => {
        if (i === 0) return { t: 'SALIDA', s: '', fondo: [44, 62, 80], claro: true };
        if (i === META) return { t: 'META', s: 'exacta', fondo: [241, 196, 15] };
        if (OCAS.has(i)) return { t: 'OCA', s: 'a la siguiente', fondo: [255, 236, 130] };
        if (i === PUENTE_A || i === PUENTE_B) return { t: 'PUENTE', s: `a la ${i === PUENTE_A ? PUENTE_B : PUENTE_A}`, fondo: [129, 212, 250] };
        if (i === CARCEL) return { t: 'CÁRCEL', s: 'pierdes 2', fondo: [55, 71, 79], claro: true };
        if (i === CAVERNA) return { t: 'CAVERNA', s: 'pierdes 1', fondo: [106, 27, 154], claro: true };
        if (i === MUERTE) return { t: 'MUERTE', s: 'a la 1', fondo: [183, 28, 28], claro: true };
        return null;
    };
    const PASTEL = [[255, 240, 243], [240, 255, 244], [240, 244, 255], [255, 251, 240], [245, 240, 255], [240, 255, 254]];

    // ── Página 1: tablero + reglas ──
    txt('LA OCA MATEMÁTICA', A4.w / 2, A4.m + 6, { tam: 20, estilo: 'bold', align: 'center' });
    const conQue = { NATURALES: 'Números naturales', ENTEROS: 'Números enteros', DECIMALES: 'Números decimales', FRACCIONES: 'Fracciones' }[modo] || nombreModo;
    txt(`${conQue} · Tira el dado, avanza y aplica la operación de la casilla a TU número`, A4.w / 2, A4.m + 12.5, { tam: 9, color: SUAVE, align: 'center' });

    const lado = A4.w - 2 * A4.m;
    const c = lado / 8;
    const x0 = A4.m, y0 = A4.m + 17;
    const pos = new Map(SQUARE_POS.map((p, i) => [`${p.col},${p.row}`, i]));
    SQUARE_POS.forEach((p, i) => {
        const x = x0 + p.col * c, y = y0 + p.row * c;
        const e = especial(i);
        pdf.setFillColor(...(e ? e.fondo : PASTEL[i % PASTEL.length]));
        pdf.setDrawColor(200, 200, 210); pdf.setLineWidth(0.2);
        pdf.rect(x, y, c, c, 'FD');
        const colTxt = e?.claro ? [255, 255, 255] : TINTA;
        txt(`${i}`, x + 1.3, y + 3.4, { tam: 7, estilo: 'bold', color: e?.claro ? [230, 230, 240] : SUAVE });
        if (e) {
            txt(e.t, x + c / 2, y + c / 2 + (e.s ? -0.5 : 1.5), { tam: ajustar(e.t, c - 3, 11, 6), estilo: 'bold', color: colTxt, align: 'center' });
            if (e.s) txt(e.s, x + c / 2, y + c / 2 + 4.5, { tam: 6.5, color: colTxt, align: 'center' });
        } else {
            const lbl = opLabel(getOp(i, modo), modo);
            txt(lbl, x + c / 2, y + c / 2 + 2, { tam: ajustar(lbl, c - 3, 15, 8), estilo: 'bold', color: [139, 0, 0], align: 'center' });
        }
    });
    // Muros del camino: entre casillas vecinas que no son consecutivas
    pdf.setDrawColor(0, 0, 0); pdf.setLineWidth(1.1);
    SQUARE_POS.forEach((p, i) => {
        const x = x0 + p.col * c, y = y0 + p.row * c;
        const der = pos.get(`${p.col + 1},${p.row}`), abajo = pos.get(`${p.col},${p.row + 1}`);
        if (der !== undefined && Math.abs(der - i) !== 1) pdf.line(x + c, y, x + c, y + c);
        if (abajo !== undefined && Math.abs(abajo - i) !== 1) pdf.line(x, y + c, x + c, y + c);
    });
    pdf.setLineWidth(1.4); pdf.rect(x0, y0, lado, lado, 'S');

    // Reglas
    let y = y0 + lado + 6;
    txt('CÓMO SE JUEGA', A4.m, y, { tam: 11, estilo: 'bold' }); y += 5;
    const ejemplo = { NATURALES: 'tu número es 5 y caes en «× 2» -> 5 × 2 = 10', ENTEROS: 'tu número es -4 y caes en «- (-3)» -> -4 - (-3) = -1', DECIMALES: 'tu número es 2.5 y caes en «+ 1.5» -> 2.5 + 1.5 = 4', FRACCIONES: 'tu número es 1/2 y caes en «+ 1/3» -> 1/2 + 1/3 = 5/6' }[modo];
    const reglas = [
        'Cada jugador recibe una tarjeta con su NÚMERO INICIAL (página de recortables) y lo apunta en su hoja.',
        `Tira el dado y avanza. Aplica la operación de la casilla a tu número: ${ejemplo}. El resultado es tu nuevo número.`,
        'Otro jugador comprueba la cuenta. Si fallas, vuelves a la casilla de antes y repites esa operación en tu próximo turno.',
        'OCA: saltas a la siguiente oca y vuelves a tirar · PUENTE: de 6 a 12 (o de 12 a 6) y tiras · CÁRCEL: pierdes 2 turnos · CAVERNA: pierdes 1 · MUERTE: vuelves a la 1.',
        `Gana quien llega antes a la META (63) con la tirada exacta; si te pasas, rebotas hacia atrás.${modo === 'FRACCIONES' ? ' Las fracciones se dan simplificadas.' : ''}`,
    ];
    reglas.forEach((r, k) => {
        txt(`${k + 1}.`, A4.m, y, { tam: 8.5, estilo: 'bold' });
        y += txt(r, A4.m + 5, y, { tam: 8.5, max: lado - 5 }) * 3.7 + 0.8;
    });
    pie(PIE);

    // ── Página 2: hojas de cálculo de los jugadores (4 por folio) ──
    pdf.addPage();
    txt('HOJAS DE LOS JUGADORES', A4.w / 2, A4.m + 5, { tam: 14, estilo: 'bold', align: 'center' });
    txt('Recorta por la línea de puntos: una hoja para cada jugador.', A4.w / 2, A4.m + 10, { tam: 8.5, color: SUAVE, align: 'center' });
    const qW = lado / 2, qH = (A4.h - A4.m - 26 - 10) / 2;
    for (let k = 0; k < 4; k++) {
        const qx = A4.m + (k % 2) * qW, qy = A4.m + 15 + Math.floor(k / 2) * qH;
        const col = COLORES_FICHA[k];
        pdf.setFillColor(...col); pdf.roundedRect(qx + 2, qy + 2, qW - 4, 9, 1.5, 1.5, 'F');
        txt(`JUGADOR ${k + 1}:`, qx + 5, qy + 8, { tam: 9.5, estilo: 'bold', color: [255, 255, 255] });
        pdf.setDrawColor(255, 255, 255); pdf.setLineWidth(0.3); pdf.line(qx + 30, qy + 8.6, qx + qW - 6, qy + 8.6);
        txt('Número inicial:', qx + 4, qy + 18, { tam: 9, estilo: 'bold' });
        pdf.setDrawColor(...col); pdf.setLineWidth(0.6); pdf.roundedRect(qx + 31, qy + 13, 22, 7.5, 1.5, 1.5, 'S');
        // Tabla
        const ty = qy + 24, filas = 13, fh = (qH - 30) / (filas + 1);
        const cols = [[qx + 3, 14, 'Casilla'], [qx + 17, 42, 'Cuenta'], [qx + 59, qW - 62, 'Nuevo nº']];
        pdf.setFillColor(241, 245, 249); pdf.rect(qx + 3, ty, qW - 6, fh, 'F');
        cols.forEach(([cx, cw, t]) => txt(t, cx + cw / 2, ty + fh / 2 + 1.2, { tam: 7.5, estilo: 'bold', color: SUAVE, align: 'center' }));
        pdf.setDrawColor(203, 213, 225); pdf.setLineWidth(0.2);
        for (let f = 0; f <= filas + 1; f++) pdf.line(qx + 3, ty + f * fh, qx + qW - 3, ty + f * fh);
        [qx + 3, qx + 17, qx + 59, qx + qW - 3].forEach((lx) => pdf.line(lx, ty, lx, ty + (filas + 1) * fh));
    }
    // Líneas de corte
    pdf.setDrawColor(150, 150, 160); pdf.setLineWidth(0.3); pdf.setLineDashPattern([2, 1.5], 0);
    pdf.line(A4.m + qW, A4.m + 15, A4.m + qW, A4.m + 15 + 2 * qH);
    pdf.line(A4.m, A4.m + 15 + qH, A4.m + lado, A4.m + 15 + qH);
    pdf.setLineDashPattern([], 0);
    pie(PIE);

    // ── Página 3: recortables ──
    pdf.addPage();
    txt('RECORTABLES', A4.w / 2, A4.m + 5, { tam: 14, estilo: 'bold', align: 'center' });
    txt('Recorta, dobla por las líneas y pega las pestañas. Si tenéis dado y fichas de verdad, solo hacen falta las tarjetas.', A4.w / 2, A4.m + 10, { tam: 8.5, color: SUAVE, align: 'center' });

    // Tarjetas de número inicial (una por jugador, números distintos cada vez)
    let ry = A4.m + 17;
    txt('Tarjetas del número inicial', A4.m, ry + 3, { tam: 10, estilo: 'bold' });
    ry += 6;
    const tw = (lado - 9) / 4;
    for (let k = 0; k < 4; k++) {
        const tx = A4.m + k * (tw + 3);
        const col = COLORES_FICHA[k];
        pdf.setDrawColor(...col); pdf.setLineWidth(0.8); pdf.setLineDashPattern([2, 1.2], 0);
        pdf.roundedRect(tx, ry, tw, 30, 2, 2, 'S'); pdf.setLineDashPattern([], 0);
        txt(`JUGADOR ${k + 1}`, tx + tw / 2, ry + 7, { tam: 8.5, estilo: 'bold', color: col, align: 'center' });
        txt('Tu número inicial', tx + tw / 2, ry + 12, { tam: 7, color: SUAVE, align: 'center' });
        txt(baseStr(genBase(modo), modo), tx + tw / 2, ry + 24, { tam: 20, estilo: 'bold', align: 'center' });
    }
    ry += 38;

    // Dado (desarrollo del cubo)
    txt('Dado', A4.m, ry + 3, { tam: 10, estilo: 'bold' });
    const d = 24, dx = A4.m + 4, dy = ry + 7;
    const caras = [[1, 0, 1], [0, 1, 2], [1, 1, 3], [2, 1, 4], [3, 1, 5], [1, 2, 6]];
    // Pestañas
    pdf.setFillColor(236, 240, 245); pdf.setDrawColor(150, 150, 160); pdf.setLineWidth(0.2);
    [[1, 0, 'izq'], [1, 0, 'der'], [1, 2, 'izq'], [1, 2, 'der'], [3, 1, 'arr'], [3, 1, 'aba'], [0, 1, 'arr']].forEach(([cx, cy, l]) => {
        const x = dx + cx * d, y2 = dy + cy * d, p = 5;
        if (l === 'izq') pdf.triangle(x, y2, x, y2 + d, x - p, y2 + d / 2, 'FD');
        if (l === 'der') pdf.triangle(x + d, y2, x + d, y2 + d, x + d + p, y2 + d / 2, 'FD');
        if (l === 'arr') pdf.triangle(x, y2, x + d, y2, x + d / 2, y2 - p, 'FD');
        if (l === 'aba') pdf.triangle(x, y2 + d, x + d, y2 + d, x + d / 2, y2 + d + p, 'FD');
    });
    caras.forEach(([cx, cy, v]) => {
        const x = dx + cx * d, y2 = dy + cy * d;
        pdf.setFillColor(255, 255, 255); pdf.setDrawColor(40, 40, 50); pdf.setLineWidth(0.4);
        pdf.rect(x, y2, d, d, 'FD');
        pdf.setFillColor(40, 40, 50);
        PUNTOS_DADO[v].forEach(([px, py]) => pdf.circle(x + px * d, y2 + py * d, 2, 'F'));
    });

    // Fichas de los jugadores (conos para doblar)
    const fx0 = dx + 4 * d + 14;
    txt('Fichas', fx0, ry + 3, { tam: 10, estilo: 'bold' });
    for (let k = 0; k < 4; k++) {
        const fx = fx0 + (k % 2) * 30, fy = ry + 10 + Math.floor(k / 2) * 36;
        const col = COLORES_FICHA[k];
        pdf.setFillColor(...col); pdf.setDrawColor(40, 40, 50); pdf.setLineWidth(0.3);
        pdf.rect(fx, fy, 22, 26, 'FD');
        pdf.setLineDashPattern([1.5, 1], 0); pdf.line(fx, fy + 13, fx + 22, fy + 13); pdf.setLineDashPattern([], 0);
        pdf.setFillColor(220, 220, 228); pdf.rect(fx, fy + 26, 22, 5, 'FD');
        txt(`${k + 1}`, fx + 11, fy + 9.5, { tam: 13, estilo: 'bold', color: [255, 255, 255], align: 'center' });
        txt(`${k + 1}`, fx + 11, fy + 22, { tam: 13, estilo: 'bold', color: [255, 255, 255], align: 'center' });
    }
    txt('Dobla cada ficha por la línea de puntos y pega la tira gris para que se quede de pie.', fx0, ry + 88, { tam: 7.5, color: SUAVE, max: A4.w - A4.m - fx0 });
    pie(PIE);

    const archivo = `oca_matematica_${modo.toLowerCase()}_${fecha()}.pdf`;
    if (descargar) pdf.save(archivo);
    return { pdf, archivo };
}

// ═════════════════════════════════════════════════════════════════════════════
//  🁣 DOMINÓ MATEMÁTICO
// ═════════════════════════════════════════════════════════════════════════════
export async function generarPdfDomino({ modo = 'NATURALES', grupos = 1, soluciones = true, descargar = true } = {}) {
    const { generarFichas, MODOS_DOMINO } = await import('../fichasdomino');
    const { pdf, txt, ajustar, pie } = await nuevoPdf();
    const info = MODOS_DOMINO.find((m) => m.id === modo) || { label: modo, desc: '' };
    const PIE = `Dominó Matemático · ${info.label} · pikt.es/domino`;
    const juegos = Array.from({ length: Math.max(1, Math.min(12, grupos)) }, () => generarFichas(modo));

    // 28 fichas = 10 filas de 3: caben en un folio con las reglas debajo
    const cols = 3, gapX = 3, gapY = 2.4;
    const tw = (A4.w - 2 * A4.m - (cols - 1) * gapX) / cols, th = 22;

    juegos.forEach((fichas, g) => {
        if (g > 0) pdf.addPage();
        txt('DOMINÓ MATEMÁTICO', A4.m, A4.m + 5, { tam: 15, estilo: 'bold' });
        txt(`${info.label}${juegos.length > 1 ? ` · Grupo ${g + 1}` : ''}`, A4.w - A4.m, A4.m + 5, { tam: 11, estilo: 'bold', color: SUAVE, align: 'right' });
        txt('Recorta las 28 fichas. Cada mitad vale un número: une mitades que valgan lo mismo (una operación con su resultado, o dos que den igual).', A4.m, A4.m + 10.5, { tam: 8.2, color: SUAVE, max: A4.w - 2 * A4.m });
        const yIni = A4.m + 17;
        fichas.forEach((f, k) => {
            const x = A4.m + (k % cols) * (tw + gapX), y = yIni + Math.floor(k / cols) * (th + gapY);
            pdf.setFillColor(...(f.isDouble ? [255, 249, 219] : [255, 255, 255]));
            pdf.setDrawColor(40, 40, 50); pdf.setLineWidth(0.5);
            pdf.roundedRect(x, y, tw, th, 2.2, 2.2, 'FD');
            pdf.setLineWidth(0.4); pdf.line(x + tw / 2, y + 3, x + tw / 2, y + th - 3);
            pdf.setFillColor(40, 40, 50); pdf.circle(x + tw / 2, y + th / 2, 0.8, 'F');
            [[f.textA, x + tw / 4], [f.textB, x + (3 * tw) / 4]].forEach(([t, cx]) => {
                txt(t, cx, y + th / 2 + 1.6, { tam: ajustar(t, tw / 2 - 4, 15, 7), estilo: 'bold', align: 'center' });
            });
        });
        txt('Reglas: 7 fichas por jugador, el resto es el pozo. Por turnos, coloca una ficha que encaje en un extremo; si no puedes, roba del pozo. Gana quien se queda sin fichas. Las fichas amarillas son dobles.',
            A4.m, yIni + 10 * (th + gapY) + 2, { tam: 7.8, color: SUAVE, max: A4.w - 2 * A4.m });
        pie(PIE);
    });

    // ── Soluciones: el valor de cada mitad ──
    if (soluciones) {
        pdf.addPage();
        txt('SOLUCIONES · valor de cada mitad', A4.m, A4.m + 5, { tam: 13, estilo: 'bold' });
        txt('Dos mitades se pueden unir cuando tienen el mismo valor.', A4.m, A4.m + 10.5, { tam: 8.5, color: SUAVE });
        let y = A4.m + 17;
        const fmt = (v) => (modo === 'ECUACIONES' ? `x = ${v}` : `${v}`);
        juegos.forEach((fichas, g) => {
            const filas = Math.ceil(fichas.length / 4), alto = 6 + filas * 4.6 + 4;
            if (y + alto > A4.h - 14) { pie(PIE); pdf.addPage(); y = A4.m + 5; }
            if (juegos.length > 1) { txt(`Grupo ${g + 1}`, A4.m, y + 3, { tam: 10, estilo: 'bold' }); y += 6; }
            fichas.forEach((f, k) => {
                const x = A4.m + (k % 4) * ((A4.w - 2 * A4.m) / 4), yy = y + Math.floor(k / 4) * 4.6;
                const t = `${f.textA} [${fmt(f.valA)}]  |  ${f.textB} [${fmt(f.valB)}]`;
                txt(t, x, yy + 3, { tam: ajustar(t, (A4.w - 2 * A4.m) / 4 - 2, 7.5, 5, 'normal'), color: TINTA });
            });
            y += filas * 4.6 + 6;
        });
        pie(PIE);
    }

    const archivo = `domino_matematico_${modo.toLowerCase()}_${fecha()}.pdf`;
    if (descargar) pdf.save(archivo);
    return { pdf, archivo };
}
