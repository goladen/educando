import { memo, useCallback, useRef } from 'react';
import AvatarSVG from '../components/avatar/AvatarSVG';
import { fondoPorId, objetoPorId } from './recursosComic';
import PersonajeCuerpo from './PersonajeCuerpo';

// Página de cómic en un único <svg>: así se edita, se ve en los informes y se
// exporta a PNG con el mismo dibujo. Coordenadas de página: ancho 1000.
//
// Modelo de un cómic:
//   { titulo, autor, mostrarTitulo, disposicion, vinetas: [{ fondo, color, els: [] }] }
// Elementos (posición fx/fy relativa a su viñeta, 0..1):
//   personaje   { cfg, mood, s, rot, flip, cuerpo, pose }   (cuerpo: entero, viewBox 100x210)
//   objeto      { obj, s, rot, flip }
//   bocadillo   { estilo, texto, w, fs, cola: {dx,dy} | null, completar, pista }
// Cualquier elemento puede llevar `fijo` (viene de una plantilla bloqueada: no se mueve).
//   texto       { texto, fs, color, rot, estallido }

export const FUENTE_BOCADILLO = "'Comic Sans MS', 'Comic Neue', 'Chalkboard SE', 'Comic Relief', 'Trebuchet MS', cursive";
export const FUENTE_ONOMATOPEYA = "Impact, 'Arial Black', Haettenschweiler, 'Franklin Gothic Heavy', sans-serif";
const TRAZO = '#1a1a1a';
const W = 1000, MARGEN = 28, HUECO = 18, ALTO_TITULO = 92;

export const DISPOSICIONES = [
    { id: 'p1', label: '1 viñeta', alto: 720, filas: [[1]] },
    { id: 'p2h', label: '2 lado a lado', alto: 560, filas: [[1, 1]] },
    { id: 'p2', label: '2 en columna', alto: 1100, filas: [[1], [1]] },
    { id: 'p3', label: '3 viñetas', alto: 1050, filas: [[1], [1, 1]] },
    { id: 'p4', label: '4 viñetas', alto: 1000, filas: [[1, 1], [1, 1]] },
    { id: 'p4z', label: '4 en zigzag', alto: 1000, filas: [[2, 1], [1, 2]] },
    { id: 'p5', label: '5 viñetas', alto: 1250, filas: [[1, 1], [1], [1, 1]] },
    { id: 'p6', label: '6 viñetas', alto: 1414, filas: [[1, 1], [1, 1], [1, 1]] },
    { id: 't3', label: 'Tira de 3', alto: 380, filas: [[1, 1, 1]] },
    { id: 't4', label: 'Tira de 4', alto: 330, filas: [[1, 1, 1, 1]] },
];
export const disposicionPorId = (id) => DISPOSICIONES.find((d) => d.id === id) || DISPOSICIONES[4];
export const numVinetas = (id) => disposicionPorId(id).filas.reduce((n, f) => n + f.length, 0);

export function calcularPagina(comic) {
    const d = disposicionPorId(comic.disposicion);
    const cab = comic.mostrarTitulo ? ALTO_TITULO : 0;
    const H = d.alto + cab;
    const nf = d.filas.length;
    const altoFila = (d.alto - 2 * MARGEN - HUECO * (nf - 1)) / nf;
    const paneles = [];
    d.filas.forEach((fila, i) => {
        const total = fila.reduce((a, b) => a + b, 0);
        const util = W - 2 * MARGEN - HUECO * (fila.length - 1);
        let x = MARGEN;
        const y = cab + MARGEN + i * (altoFila + HUECO);
        fila.forEach((peso) => {
            const w = (util * peso) / total;
            paneles.push({ x, y, w, h: altoFila });
            x += w + HUECO;
        });
    });
    return { W, H, cab, paneles };
}

// ─── Texto ───────────────────────────────────────────────────────────────────
let ctxMedir = null;
const cacheMedidas = new Map();
function medir(texto, fs, fuente) {
    const k = `${fs}|${fuente}|${texto}`;
    if (cacheMedidas.has(k)) return cacheMedidas.get(k);
    if (!ctxMedir && typeof document !== 'undefined') ctxMedir = document.createElement('canvas').getContext('2d');
    let w = texto.length * fs * 0.55;
    if (ctxMedir) { ctxMedir.font = `bold ${fs}px ${fuente}`; w = ctxMedir.measureText(texto).width; }
    if (cacheMedidas.size > 3000) cacheMedidas.clear();
    cacheMedidas.set(k, w);
    return w;
}

export function partirTexto(texto, maxW, fs, fuente = FUENTE_BOCADILLO) {
    const lineas = [];
    for (const parrafo of String(texto || '').split('\n')) {
        const palabras = parrafo.split(/\s+/).filter(Boolean);
        if (!palabras.length) { lineas.push(''); continue; }
        let actual = palabras[0];
        for (let i = 1; i < palabras.length; i++) {
            const prueba = `${actual} ${palabras[i]}`;
            if (medir(prueba, fs, fuente) <= maxW) actual = prueba;
            else { lineas.push(actual); actual = palabras[i]; }
        }
        lineas.push(actual);
    }
    return lineas.length ? lineas : [''];
}

// Medidas del bocadillo: líneas de texto y semiejes del cuerpo.
export function medidasBocadillo(el) {
    const fs = el.fs || 30;
    const lineas = partirTexto(el.texto || el.pista || (el.completar ? '…' : ''), el.w || 260, fs);
    const tw = Math.max(fs * 2, ...lineas.map((l) => medir(l, fs, FUENTE_BOCADILLO)));
    const lh = fs * 1.18;
    const th = lineas.length * lh;
    let rx, ry;
    switch (el.estilo) {
        case 'cartela': rx = tw / 2 + 18; ry = th / 2 + 14; break;
        case 'pensamiento': rx = tw / 2 * 1.2 + 30; ry = th / 2 * 1.25 + 28; break;
        case 'grito': rx = tw / 2 * 1.25 + 34; ry = th / 2 * 1.3 + 32; break;
        default: rx = tw / 2 * 1.16 + 20; ry = th / 2 * 1.2 + 18;
    }
    return { lineas, fs, lh, th, rx, ry };
}

// ─── Formas del bocadillo ────────────────────────────────────────────────────
const f1 = (n) => Math.round(n * 10) / 10;

function nubePath(rx, ry) {
    const n = Math.max(8, Math.round((rx + ry) / 22));
    const pts = Array.from({ length: n }, (_, i) => {
        const a = (i / n) * Math.PI * 2;
        return [rx * Math.cos(a), ry * Math.sin(a)];
    });
    let d = `M${f1(pts[0][0])} ${f1(pts[0][1])}`;
    for (let i = 0; i < n; i++) {
        const [x2, y2] = pts[(i + 1) % n];
        const [x1, y1] = pts[i];
        const r = Math.hypot(x2 - x1, y2 - y1) * 0.62;
        d += ` A${f1(r)} ${f1(r)} 0 0 1 ${f1(x2)} ${f1(y2)}`;
    }
    return d + ' Z';
}

function gritoPath(rx, ry) {
    const n = 22;
    let d = '';
    for (let i = 0; i < n * 2; i++) {
        const a = (i / (n * 2)) * Math.PI * 2;
        const k = i % 2 === 0 ? 1.16 + ((i * 37) % 7) * 0.025 : 0.9;
        d += `${i ? 'L' : 'M'}${f1(rx * k * Math.cos(a))} ${f1(ry * k * Math.sin(a))} `;
    }
    return d + 'Z';
}

function colaPath(rx, ry, dx, dy, estilo) {
    const th = Math.atan2(dy / ry, dx / rx);
    const ab = estilo === 'grito' ? 0.2 : 0.26;
    const b1 = [rx * 0.75 * Math.cos(th - ab), ry * 0.75 * Math.sin(th - ab)];
    const b2 = [rx * 0.75 * Math.cos(th + ab), ry * 0.75 * Math.sin(th + ab)];
    if (estilo === 'grito') {
        const m1 = [b1[0] + (dx - b1[0]) * 0.45 + 10, b1[1] + (dy - b1[1]) * 0.45];
        return `M${f1(b1[0])} ${f1(b1[1])} L${f1(m1[0])} ${f1(m1[1])} L${f1(dx)} ${f1(dy)} L${f1(b2[0])} ${f1(b2[1])} Z`;
    }
    // Cola un poco curvada: punto de control desplazado en perpendicular.
    const lx = dx - (b1[0] + b2[0]) / 2, ly = dy - (b1[1] + b2[1]) / 2;
    const len = Math.hypot(lx, ly) || 1;
    const nx = -ly / len, ny = lx / len, curva = len * 0.12;
    const c1 = [(b1[0] + dx) / 2 + nx * curva, (b1[1] + dy) / 2 + ny * curva];
    const c2 = [(b2[0] + dx) / 2 + nx * curva * 0.6, (b2[1] + dy) / 2 + ny * curva * 0.6];
    return `M${f1(b1[0])} ${f1(b1[1])} Q${f1(c1[0])} ${f1(c1[1])} ${f1(dx)} ${f1(dy)} Q${f1(c2[0])} ${f1(c2[1])} ${f1(b2[0])} ${f1(b2[1])} Z`;
}

function Bocadillo({ el }) {
    const m = medidasBocadillo(el);
    const { rx, ry } = m;
    const estilo = el.estilo || 'dialogo';
    const fondo = estilo === 'cartela' ? '#fff3b0' : 'white';
    const sw = estilo === 'grito' ? 5 : 4;
    const dash = estilo === 'susurro' ? '14 10' : undefined;
    const cola = el.cola && estilo !== 'cartela' && ((el.cola.dx / rx) ** 2 + (el.cola.dy / ry) ** 2 > 1.15) ? el.cola : null;

    let cuerpo;
    if (estilo === 'cartela') cuerpo = { tag: 'rect', props: { x: -rx, y: -ry, width: rx * 2, height: ry * 2, rx: 4 } };
    else if (estilo === 'pensamiento') cuerpo = { tag: 'path', props: { d: nubePath(rx, ry) } };
    else if (estilo === 'grito') cuerpo = { tag: 'path', props: { d: gritoPath(rx, ry) } };
    else cuerpo = { tag: 'ellipse', props: { rx, ry } };
    const Cuerpo = cuerpo.tag;

    // Burbujitas de pensamiento hacia el personaje.
    let burbujas = null;
    if (cola && estilo === 'pensamiento') {
        const th = Math.atan2(cola.dy / ry, cola.dx / rx);
        const sx = rx * Math.cos(th), sy = ry * Math.sin(th);
        burbujas = [0.25, 0.55, 0.85].map((t, i) => {
            const r = [16, 11, 7][i];
            return <ellipse key={i} cx={sx + (cola.dx - sx) * t} cy={sy + (cola.dy - sy) * t} rx={r * 1.25} ry={r} fill="white" stroke={TRAZO} strokeWidth="3.5" />;
        });
    }
    const conCola = cola && estilo !== 'pensamiento';
    const dCola = conCola ? colaPath(rx, ry, cola.dx, cola.dy, estilo) : null;
    const y0 = -m.th / 2 + m.fs * 0.9;

    return (
        <g>
            {burbujas}
            {/* Trazo doble debajo y relleno encima: el contorno de cuerpo + cola queda unido. */}
            <g stroke={TRAZO} strokeWidth={sw * 2} strokeLinejoin="round" strokeDasharray={dash} fill={fondo}>
                <Cuerpo {...cuerpo.props} />
                {dCola && <path d={dCola} />}
            </g>
            <g fill={fondo}>
                <Cuerpo {...cuerpo.props} />
                {dCola && <path d={dCola} />}
            </g>
            <text textAnchor="middle" fontFamily={FUENTE_BOCADILLO} fontWeight="bold" fontSize={m.fs} fill={el.texto ? TRAZO : '#b2bec3'} fontStyle={el.texto ? undefined : 'italic'}>
                {m.lineas.map((l, i) => <tspan key={i} x="0" y={f1(y0 + i * m.lh)}>{l || ' '}</tspan>)}
            </text>
        </g>
    );
}

function estrellaEstallido(rx, ry) {
    const n = 14;
    let d = '';
    for (let i = 0; i < n * 2; i++) {
        const a = (i / (n * 2)) * Math.PI * 2 - Math.PI / 2;
        const k = i % 2 === 0 ? 1 : 0.68 + ((i * 13) % 5) * 0.03;
        d += `${i ? 'L' : 'M'}${f1(rx * k * Math.cos(a))} ${f1(ry * k * Math.sin(a))} `;
    }
    return d + 'Z';
}

function medidasTexto(el) {
    const fs = el.fs || 80;
    const w = medir(el.texto || ' ', fs, FUENTE_ONOMATOPEYA);
    return { fs, w, rx: w / 2 + fs * 0.25, ry: fs * 0.62 };
}

function Onomatopeya({ el }) {
    const m = medidasTexto(el);
    const color = el.color || '#ffd32a';
    return (
        <g>
            {el.estallido && <path d={estrellaEstallido(m.rx * 1.45, m.ry * 2.1)} fill={el.colorEstallido || '#ff5e57'} stroke={TRAZO} strokeWidth="5" strokeLinejoin="round" />}
            <text textAnchor="middle" y={m.fs * 0.36} fontFamily={FUENTE_ONOMATOPEYA} fontSize={m.fs} x={m.fs * 0.06} dy={m.fs * 0.06} fill={TRAZO}>{el.texto}</text>
            <text textAnchor="middle" y={m.fs * 0.36} fontFamily={FUENTE_ONOMATOPEYA} fontSize={m.fs} fill={color}
                stroke={TRAZO} strokeWidth={Math.max(3, m.fs * 0.08)} strokeLinejoin="round" paintOrder="stroke">{el.texto}</text>
        </g>
    );
}

// Semiancho/semialto del elemento sin rotar (para el recuadro de selección).
export function cajaElemento(el) {
    if (el.tipo === 'bocadillo') { const m = medidasBocadillo(el); return { hx: m.rx, hy: m.ry }; }
    if (el.tipo === 'personaje' && el.cuerpo) { const s = el.s || 300; return { hx: s * 0.26, hy: s / 2 }; }
    if (el.tipo === 'texto') { const m = medidasTexto(el); return { hx: m.rx * (el.estallido ? 1.45 : 1), hy: m.ry * (el.estallido ? 2.1 : 1) }; }
    return { hx: (el.s || 200) / 2, hy: (el.s || 200) / 2 };
}

const ElementoComic = memo(function ElementoComic({ el, px, py, pw, ph, pi, onDown, onDoble }) {
    const cx = px + el.fx * pw, cy = py + el.fy * ph;
    const rot = el.tipo === 'bocadillo' ? 0 : el.rot || 0;
    const flip = el.flip && (el.tipo === 'personaje' || el.tipo === 'objeto') ? -1 : 1;
    let contenido;
    if (el.tipo === 'personaje' && el.cuerpo) {
        const s = el.s || 300, w = (s * 100) / 210;
        contenido = <svg x={-w / 2} y={-s / 2} width={w} height={s} viewBox="0 0 100 210" overflow="visible"><PersonajeCuerpo cfg={el.cfg} mood={el.mood || 'neutral'} pose={el.pose} /></svg>;
    } else if (el.tipo === 'personaje') {
        const s = el.s || 260;
        contenido = <g transform={`translate(${-s / 2} ${-s / 2})`}><AvatarSVG config={el.cfg} size={s} mood={el.mood || 'neutral'} sinFondo /></g>;
    } else if (el.tipo === 'objeto') {
        const s = el.s || 140;
        const O = objetoPorId(el.obj).dibujo;
        contenido = <svg x={-s / 2} y={-s / 2} width={s} height={s} viewBox="0 0 100 100" overflow="visible"><O /></svg>;
    } else if (el.tipo === 'bocadillo') contenido = <Bocadillo el={el} />;
    else contenido = <Onomatopeya el={el} />;

    return (
        <g transform={`translate(${f1(cx)} ${f1(cy)}) rotate(${rot}) scale(${flip} 1)`}
            onPointerDown={onDown ? (e) => onDown(e, 'mover', pi, el) : undefined}
            onDoubleClick={onDoble ? () => onDoble(pi, el) : undefined}
            style={onDown ? { cursor: el.fijo ? 'pointer' : 'move' } : undefined}>
            {contenido}
        </g>
    );
});

// Fondo de una viñeta (memo: no se redibuja al arrastrar elementos).
const FondoVineta = memo(function FondoVineta({ fondo, color, x, y, w, h, u }) {
    const F = fondoPorId(fondo).dibujo;
    return <>
        <rect x={x} y={y} width={w} height={h} fill={color || '#ffffff'} />
        {fondo && fondo !== 'liso' && <svg x={x} y={y} width={w} height={h} viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice"><F u={u} /></svg>}
    </>;
});

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// vinetaEditable(i): en el cómic colaborativo solo se tocan las viñetas propias.
// etiquetas: { i: 'texto' } rótulo sobre cada viñeta (no se exporta). marcas: señala los bocadillos para completar.
export default function ComicPagina({ comic, seleccion, onSeleccionar, onCambiarEl, onInicioCambio, onDoble, editable = false, svgRef: refExterno, style, idPrefijo = 'c', vinetaEditable, etiquetas, marcas = false }) {
    const refInterno = useRef(null);
    const svgRef = refExterno || refInterno;
    const pag = calcularPagina(comic);
    const n = pag.paneles.length;

    // Callbacks más recientes en una ref: los elementos memorizados no se re-renderizan.
    const cb = useRef({});
    cb.current = { onSeleccionar, onCambiarEl, onInicioCambio, paneles: pag.paneles };

    const aSvg = (e) => {
        const svg = svgRef.current;
        const pt = svg.createSVGPoint();
        pt.x = e.clientX; pt.y = e.clientY;
        return pt.matrixTransform(svg.getScreenCTM().inverse());
    };

    const onDown = useCallback((e, modo, pi, el) => {
        if (e.button && e.button !== 0) return;
        e.stopPropagation();
        e.preventDefault();
        const { onSeleccionar: sel, onInicioCambio: ini, paneles } = cb.current;
        sel?.(pi, el.id);
        if (el.fijo) return;
        const panel = paneles[pi];
        const p0 = aSvg(e);
        const orig = el;
        const cx = panel.x + orig.fx * panel.w, cy = panel.y + orig.fy * panel.h;
        const d0 = Math.max(12, Math.hypot(p0.x - cx, p0.y - cy));
        let empezado = false;
        const mover = (ev) => {
            const p = aSvg(ev);
            const dx = p.x - p0.x, dy = p.y - p0.y;
            if (!empezado) {
                if (Math.hypot(dx, dy) < 3) return;
                empezado = true;
                ini?.();
            }
            const cambiar = cb.current.onCambiarEl;
            if (modo === 'mover') {
                cambiar?.(pi, orig.id, { fx: clamp(orig.fx + dx / panel.w, -0.3, 1.3), fy: clamp(orig.fy + dy / panel.h, -0.3, 1.3) });
            } else if (modo === 'cola') {
                cambiar?.(pi, orig.id, { cola: { dx: f1(orig.cola.dx + dx), dy: f1(orig.cola.dy + dy) } });
            } else if (modo === 'tam') {
                const k = Math.hypot(p.x - cx, p.y - cy) / d0;
                if (orig.tipo === 'bocadillo') cambiar?.(pi, orig.id, { w: Math.round(clamp(orig.w * k, 60, 900)) });
                else if (orig.tipo === 'texto') cambiar?.(pi, orig.id, { fs: Math.round(clamp(orig.fs * k, 16, 320)) });
                else cambiar?.(pi, orig.id, { s: Math.round(clamp(orig.s * k, 30, 1200)) });
            }
        };
        const fin = () => {
            window.removeEventListener('pointermove', mover);
            window.removeEventListener('pointerup', fin);
            window.removeEventListener('pointercancel', fin);
        };
        window.addEventListener('pointermove', mover);
        window.addEventListener('pointerup', fin);
        window.addEventListener('pointercancel', fin);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Recuadro de selección y asas (capa de interfaz, fuera de la exportación).
    let ui = null;
    if (editable && seleccion) {
        const panel = pag.paneles[seleccion.panel];
        const v = comic.vinetas[seleccion.panel];
        if (panel && v) {
            const el = seleccion.el ? v.els.find((x) => x.id === seleccion.el) : null;
            if (!el) {
                ui = <rect x={panel.x - 5} y={panel.y - 5} width={panel.w + 10} height={panel.h + 10} fill="none" stroke="#0984e3" strokeWidth="6" strokeDasharray="18 10" pointerEvents="none" />;
            } else if (el.fijo) {
                const { hx, hy } = cajaElemento(el);
                const cx = panel.x + el.fx * panel.w, cy = panel.y + el.fy * panel.h;
                ui = <rect x={cx - hx - 8} y={cy - hy - 8} width={hx * 2 + 16} height={hy * 2 + 16} fill="none" stroke="#e17055" strokeWidth="3" strokeDasharray="6 6" pointerEvents="none" />;
            } else {
                const { hx, hy } = cajaElemento(el);
                const cx = panel.x + el.fx * panel.w, cy = panel.y + el.fy * panel.h;
                const rot = el.tipo === 'bocadillo' ? 0 : el.rot || 0;
                ui = <g>
                    <g transform={`translate(${f1(cx)} ${f1(cy)}) rotate(${rot})`}>
                        <rect x={-hx - 8} y={-hy - 8} width={hx * 2 + 16} height={hy * 2 + 16} fill="none" stroke="#0984e3" strokeWidth="3" strokeDasharray="10 7" pointerEvents="none" />
                        <circle cx={hx + 8} cy={hy + 8} r="16" fill="#0984e3" stroke="white" strokeWidth="4" style={{ cursor: 'nwse-resize' }}
                            onPointerDown={(e) => onDown(e, 'tam', seleccion.panel, el)} />
                        <path d="M-6 -6 L6 6 M-6 -6 h5 M-6 -6 v5 M6 6 h-5 M6 6 v-5" transform={`translate(${hx + 8} ${hy + 8})`} fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" pointerEvents="none" />
                    </g>
                    {el.tipo === 'bocadillo' && el.cola && el.estilo !== 'cartela' && (
                        <circle cx={cx + el.cola.dx} cy={cy + el.cola.dy} r="15" fill="#e17055" stroke="white" strokeWidth="4" style={{ cursor: 'crosshair' }}
                            onPointerDown={(e) => onDown(e, 'cola', seleccion.panel, el)} />
                    )}
                </g>;
            }
        }
    }

    return (
        <svg ref={svgRef} xmlns="http://www.w3.org/2000/svg" viewBox={`0 0 ${pag.W} ${pag.H}`} width="100%" height="100%"
            preserveAspectRatio="xMidYMid meet" style={{ display: 'block', touchAction: editable ? 'none' : undefined, userSelect: 'none', ...style }}
            onPointerDown={editable ? () => onSeleccionar?.(null, null) : undefined}>
            <defs>
                {pag.paneles.map((p, i) => <clipPath key={i} id={`${idPrefijo}clip${i}`}><rect x={p.x} y={p.y} width={p.w} height={p.h} /></clipPath>)}
            </defs>
            <rect width={pag.W} height={pag.H} fill="white" />
            {comic.mostrarTitulo && <g>
                <text x={pag.W / 2} y="66" textAnchor="middle" fontFamily={FUENTE_ONOMATOPEYA} fontSize="54" fill="#ffd32a" stroke={TRAZO} strokeWidth="6" paintOrder="stroke" strokeLinejoin="round">
                    {comic.titulo || 'Mi cómic'}
                </text>
                {comic.autor && <text x={pag.W - MARGEN} y={ALTO_TITULO - 4} textAnchor="end" fontFamily={FUENTE_BOCADILLO} fontSize="20" fill="#555">por {comic.autor}</text>}
            </g>}
            {pag.paneles.map((p, i) => {
                const v = comic.vinetas[i] || { fondo: 'liso', color: '#ffffff', els: [] };
                const puede = editable && (!vinetaEditable || vinetaEditable(i));
                return (
                    <g key={i}>
                        <g clipPath={`url(#${idPrefijo}clip${i})`}>
                            <g onPointerDown={editable ? (e) => { e.stopPropagation(); if (puede) onSeleccionar?.(i, null); } : undefined}>
                                <FondoVineta fondo={v.fondo} color={v.color} x={p.x} y={p.y} w={p.w} h={p.h} u={`${idPrefijo}f${i}`} />
                            </g>
                            {v.els.map((el) => (
                                <ElementoComic key={el.id} el={el} px={p.x} py={p.y} pw={p.w} ph={p.h} pi={i}
                                    onDown={puede ? onDown : undefined} onDoble={puede ? onDoble : undefined} />
                            ))}
                            {editable && !puede && <rect x={p.x} y={p.y} width={p.w} height={p.h} fill="white" opacity="0.35" pointerEvents="none" data-ui="1" />}
                        </g>
                        <rect x={p.x} y={p.y} width={p.w} height={p.h} fill="none" stroke={TRAZO} strokeWidth="5" pointerEvents="none" />
                        {marcas && v.els.filter((e) => e.tipo === 'bocadillo' && e.completar).map((e) => {
                            const m = medidasBocadillo(e);
                            return <g key={'m' + e.id} data-ui="1" pointerEvents="none" transform={`translate(${p.x + e.fx * p.w + m.rx * 0.8} ${p.y + e.fy * p.h - m.ry * 0.9})`}>
                                <circle r="17" fill="#e17055" stroke="white" strokeWidth="3" /><text y="7" textAnchor="middle" fontSize="19" fill="white">✏</text>
                            </g>;
                        })}
                        {etiquetas?.[i] && <g data-ui="1" pointerEvents="none">
                            <rect x={p.x + 8} y={p.y + 8} width={Math.min(p.w - 16, 22 + etiquetas[i].length * 13)} height="34" rx="9" fill="#2d3436" opacity="0.85" />
                            <text x={p.x + 19} y={p.y + 32} fontSize="21" fontWeight="bold" fill="white" fontFamily="Arial, sans-serif">{etiquetas[i]}</text>
                        </g>}
                        {editable && !v.els.length && (!v.fondo || v.fondo === 'liso') && (
                            <text x={p.x + p.w / 2} y={p.y + p.h / 2} textAnchor="middle" fontSize="26" fill="#b2bec3" fontFamily="Arial" pointerEvents="none">Viñeta {i + 1}</text>
                        )}
                    </g>
                );
            })}
            {n > 0 && <g data-ui="1">{ui}</g>}
        </svg>
    );
}

// ─── Exportar ────────────────────────────────────────────────────────────────
// Convierte el <svg> de la página en PNG (sin la capa de selección).
export function svgAPng(svgEl, escala = 2) {
    return new Promise((resolve, reject) => {
        const copia = svgEl.cloneNode(true);
        copia.querySelectorAll('[data-ui]').forEach((n) => n.remove());
        const [, , vw, vh] = (copia.getAttribute('viewBox') || '0 0 1000 1000').split(/\s+/).map(Number);
        copia.setAttribute('width', vw);
        copia.setAttribute('height', vh);
        copia.removeAttribute('style');
        const xml = new XMLSerializer().serializeToString(copia);
        const img = new Image();
        img.onload = () => {
            const c = document.createElement('canvas');
            c.width = Math.round(vw * escala);
            c.height = Math.round(vh * escala);
            const ctx = c.getContext('2d');
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, c.width, c.height);
            ctx.drawImage(img, 0, 0, c.width, c.height);
            c.toBlob((b) => (b ? resolve(b) : reject(new Error('No se pudo crear la imagen'))), 'image/png');
        };
        img.onerror = () => reject(new Error('No se pudo dibujar el cómic'));
        img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(xml);
    });
}
