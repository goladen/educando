// Geometría común de los retos Menseki (tablero SVG y ficha PDF).
// Todo en "unidades de viewBox": U por cada unidad de la cuadrícula del reto.

export const U = 90;          // px de viewBox por unidad de cuadrícula
export const MARGEN = 78;     // margen alrededor para que las cotas no se recorten
export const OFF = 34;        // separación de la línea de cota respecto al borde
export const PILL_H = 30;

const DIR = { top: [0, -1], bottom: [0, 1], left: [-1, 0], right: [1, 0] };

export const anchoPill = (txt) => Math.max(44, txt.length * 11.5 + 22);

// Líneas y pastilla de cada cota (en coordenadas del viewBox).
export function calcularCotas(cotas) {
    const res = [];
    for (const c of cotas || []) {
        const [dx, dy] = DIR[c.lado] || DIR.top;
        const x1 = c.desde[0] * U, y1 = c.desde[1] * U;
        const x2 = c.hasta[0] * U, y2 = c.hasta[1] * U;
        const horizontal = c.lado === 'top' || c.lado === 'bottom';
        const txt = c.valor === '?' ? '?' : `${c.valor} cm`;
        const w = anchoPill(txt);
        // En las verticales la pastilla es más ancha que alta: separar más la línea.
        const sep = horizontal ? OFF : Math.max(OFF, anchoPill('00 cm') / 2 + 10);
        const ox = dx * sep, oy = dy * sep;
        let px = (x1 + x2) / 2 + ox;
        let py = (y1 + y2) / 2 + oy;
        // Evitar que dos pastillas se pisen: deslizar a lo largo de su propia cota.
        const lim = horizontal
            ? [Math.min(x1, x2) + w / 2 + 4, Math.max(x1, x2) - w / 2 - 4]
            : [Math.min(y1, y2) + PILL_H / 2 + 4, Math.max(y1, y2) - PILL_H / 2 - 4];
        for (let intento = 0; intento < 12; intento++) {
            const choca = res.find(o => Math.abs(o.px - px) < (o.w + w) / 2 + 4 && Math.abs(o.py - py) < PILL_H + 4);
            if (!choca) break;
            if (horizontal) {
                const hacia = px >= choca.px ? 1 : -1;
                const nuevo = choca.px + hacia * ((choca.w + w) / 2 + 6);
                px = lim[0] <= lim[1] ? Math.min(lim[1], Math.max(lim[0], nuevo)) : px;
                if (Math.abs(nuevo - px) > 1) { py += dy * (PILL_H + 4); }
            } else {
                const hacia = py >= choca.py ? 1 : -1;
                const nuevo = choca.py + hacia * (PILL_H + 6);
                py = lim[0] <= lim[1] ? Math.min(lim[1], Math.max(lim[0], nuevo)) : py;
                if (Math.abs(nuevo - py) > 1) { px += dx * (w / 2 + 8); }
            }
        }
        res.push({ c, x1, y1, x2, y2, ox, oy, horizontal, txt, w, px, py });
    }
    return res;
}

// viewBox [x, y, ancho, alto] que abarca la figura, las cotas y sus pastillas.
export function geometriaReto(reto) {
    const rects = reto?.rects || [];
    const maxX = Math.max(1, ...rects.map(r => r.x + r.w));
    const maxY = Math.max(1, ...rects.map(r => r.y + r.h));
    const minX = Math.min(0, ...rects.map(r => r.x));
    const minY = Math.min(0, ...rects.map(r => r.y));
    const cotas = calcularCotas(reto?.cotas);
    let x0 = minX * U - MARGEN, y0 = minY * U - MARGEN, x1 = maxX * U + MARGEN, y1 = maxY * U + MARGEN;
    for (const d of cotas) {
        x0 = Math.min(x0, d.px - d.w / 2 - 12); x1 = Math.max(x1, d.px + d.w / 2 + 12);
        y0 = Math.min(y0, d.py - PILL_H / 2 - 12); y1 = Math.max(y1, d.py + PILL_H / 2 + 12);
    }
    return { vb: [x0, y0, x1 - x0, y1 - y0], cotas };
}
