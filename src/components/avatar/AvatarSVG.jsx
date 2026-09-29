import { useId } from 'react';
import { normalizarAvatar } from '../../utils/avatarLocal';

// Dibuja un avatar (configuración de utils/avatarLocal.js) como SVG por capas.
//   mood:    'neutral' | 'happy' | 'angry' — cambia ojos/boca/cejas para reaccionar en los juegos.
//   animado: parpadeo suave (vista previa del editor, salas de espera...).

const OSCURO = '#2d3436';
const ROSA = '#ff8fab';
const BOCA = '#6b1d1d';
const LUZ = '#6ff7ff';

// Aclara (+) u oscurece (−) un color hex.
function tono(hex, cant) {
    const n = parseInt(hex.slice(1), 16);
    const c = (v) => Math.max(0, Math.min(255, v + cant));
    return '#' + [c(n >> 16), c((n >> 8) & 255), c(n & 255)].map((v) => v.toString(16).padStart(2, '0')).join('');
}

// Estrella de n puntas centrada en (0,0).
function estrella(rExt, rInt, n = 5) {
    const pts = [];
    for (let i = 0; i < n * 2; i++) {
        const r = i % 2 ? rInt : rExt;
        const a = (Math.PI / n) * i - Math.PI / 2;
        pts.push(`${(r * Math.cos(a)).toFixed(2)},${(r * Math.sin(a)).toFixed(2)}`);
    }
    return pts.join(' ');
}

// Destello de 4 puntas centrado en (x,y).
const destello = (x, y, r) => `M${x} ${y - r} Q${x} ${y} ${x + r} ${y} Q${x} ${y} ${x} ${y + r} Q${x} ${y} ${x - r} ${y} Q${x} ${y} ${x} ${y - r} Z`;

const CORAZON = 'M0 4.8 C-6.5 0.5 -5.5 -5.8 -1.8 -4.4 Q-0.6 -4 0 -2.6 Q0.6 -4 1.8 -4.4 C5.5 -5.8 6.5 0.5 0 4.8 Z';

// Posición de ojos y boca según el personaje.
function geometria(base) {
    switch (base) {
        case 'persona':  return { ojos: [[40, 48], [60, 48]], boca: 62, cejas: true, escala: 1 };
        case 'rana':     return { ojos: [[37, 29], [63, 29]], boca: 60, cejas: false, escala: 1 };
        case 'robot':    return { ojos: [[40, 43], [60, 43]], boca: 54, cejas: false, escala: 1, pantalla: true };
        case 'alien':    return { ojos: [[38.5, 46], [61.5, 46]], boca: 64, cejas: false, escala: 1.25 };
        case 'pinguino': return { ojos: [[41, 46], [59, 46]], boca: 64, cejas: true, escala: 1 };
        default:         return { ojos: [[40, 46], [60, 46]], boca: 64.5, cejas: true, escala: 1 };
    }
}

// ─── Fondo ───────────────────────────────────────────────────────────────────
function Patron({ tipo }) {
    switch (tipo) {
        case 'rayos': {
            const cunas = [];
            for (let i = 0; i < 12; i++) {
                const a1 = (i * 30 * Math.PI) / 180, a2 = ((i * 30 + 15) * Math.PI) / 180;
                cunas.push(<path key={i} d={`M50 50 L${50 + 80 * Math.cos(a1)} ${50 + 80 * Math.sin(a1)} L${50 + 80 * Math.cos(a2)} ${50 + 80 * Math.sin(a2)} Z`} />);
            }
            return <g fill="white" opacity="0.09">{cunas}</g>;
        }
        case 'puntos': {
            const pts = [];
            for (let y = 5; y < 100; y += 10) for (let x = (y % 20 === 5 ? 5 : 10); x < 100; x += 10) pts.push(<circle key={`${x}-${y}`} cx={x} cy={y} r="1.4" />);
            return <g fill="white" opacity="0.2">{pts}</g>;
        }
        case 'estrellas':
            return <g fill="white">
                {[[15, 22, 4, 0.7], [85, 17, 3, 0.6], [83, 62, 2.4, 0.5], [12, 68, 2.8, 0.55], [30, 7, 2, 0.5], [91, 40, 2, 0.45], [8, 45, 1.6, 0.4]].map(([x, y, r, o]) =>
                    <path key={`${x}-${y}`} d={destello(x, y, r)} opacity={o} />)}
            </g>;
        case 'burbujas':
            return <g fill="white" fillOpacity="0.1" stroke="white" strokeOpacity="0.25" strokeWidth="0.8">
                {[[14, 20, 8], [86, 28, 6], [10, 64, 5], [89, 74, 9], [28, 90, 4], [72, 7, 4], [22, 40, 2.5]].map(([x, y, r]) =>
                    <circle key={`${x}-${y}`} cx={x} cy={y} r={r} />)}
            </g>;
        default:
            return null;
    }
}

// ─── Pelo (solo persona) ─────────────────────────────────────────────────────
const FLEQUILLO = 'M23.5 50 Q21 17 50 16.5 Q79 17 76.5 50 Q75 38 68 33 Q58 39 46 33 Q35 38 27 36 Q24.5 42 23.5 50 Z';

function PeloDetras({ pelo, g }) {
    const p = { fill: g.pelo, stroke: g.trazoPelo, strokeWidth: 1.3 };
    switch (pelo) {
        case 'largo':
            return <path d="M21 50 Q18 13 50 13 Q82 13 79 50 L81 88 Q70 93 63 84 L37 84 Q30 93 19 88 Z" {...p} />;
        case 'coletas':
            return <g>
                <ellipse cx="17" cy="54" rx="8" ry="14" transform="rotate(18 17 54)" {...p} />
                <ellipse cx="83" cy="54" rx="8" ry="14" transform="rotate(-18 83 54)" {...p} />
                <circle cx="23.5" cy="44" r="3" fill={g.ropaColor} stroke={g.trazoRopa} strokeWidth="0.8" />
                <circle cx="76.5" cy="44" r="3" fill={g.ropaColor} stroke={g.trazoRopa} strokeWidth="0.8" />
            </g>;
        case 'moño':
            return <circle cx="50" cy="14" r="10" {...p} />;
        case 'afro': {
            const bultos = [];
            for (let a = 140; a <= 400; a += 20) {
                const r = (a * Math.PI) / 180;
                bultos.push([50 + 29 * Math.cos(r), 42 + 27 * Math.sin(r)]);
            }
            return <g>
                {bultos.map(([x, y]) => <circle key={`s${x}`} cx={x} cy={y} r="9.5" fill={g.trazoPelo} stroke={g.trazoPelo} strokeWidth="2.6" />)}
                {bultos.map(([x, y]) => <circle key={`f${x}`} cx={x} cy={y} r="9.5" fill={g.pelo} />)}
                <circle cx="50" cy="42" r="27" fill={g.pelo} />
            </g>;
        }
        default:
            return null;
    }
}

function PeloDelante({ pelo, g }) {
    const p = { fill: g.pelo, stroke: g.trazoPelo, strokeWidth: 1.3, strokeLinejoin: 'round' };
    const brillo = <path d="M31 27 Q38 20.5 47 19.5" fill="none" stroke="white" strokeOpacity="0.35" strokeWidth="2.6" strokeLinecap="round" />;
    switch (pelo) {
        case 'corto':
        case 'coletas':
        case 'moño':
            return <g><path d={FLEQUILLO} {...p} />{brillo}</g>;
        case 'lateral':
            return <g><path d="M23 50 Q19 16 52 15.5 Q81 17 77 49 Q74 36 67 31 Q55 42 34 39 Q27 42 23 50 Z" {...p} />{brillo}</g>;
        case 'largo':
            return <g><path d="M23.5 54 Q20 17 50 16.5 Q80 17 76.5 54 Q73 33 55 28 L50 34 Q48 29 44 28 Q28 32 23.5 54 Z" {...p} />{brillo}</g>;
        case 'afro': {
            const rizos = [];
            for (let a = 195; a <= 345; a += 15) {
                const r = (a * Math.PI) / 180;
                rizos.push([50 + 21 * Math.cos(r), 45 + 21 * Math.sin(r)]);
            }
            return <g>
                {rizos.map(([x, y]) => <circle key={`s${x}`} cx={x} cy={y} r="7" fill={g.trazoPelo} stroke={g.trazoPelo} strokeWidth="2.4" />)}
                {rizos.map(([x, y]) => <circle key={`f${x}`} cx={x} cy={y} r="7" fill={g.pelo} />)}
                {brillo}
            </g>;
        }
        case 'pinchos':
            return <g><path d="M22 48 L19 26 L30 30 L27 11 L40 22 L46 5 L54 20 L64 7 L66 24 L79 15 L76 32 L82 37 L77 48 Q72 34 62 32 L56 40 L50 32 L42 40 L36 32 Q27 36 22 48 Z" {...p} />{brillo}</g>;
        case 'cresta':
            return <g>
                <path d={FLEQUILLO} fill={g.pelo} opacity="0.35" />
                <path d="M42 25 Q39 12 43 2 L47.5 10 L51 0 L54.5 10 L58.5 3 Q62 14 58 25 Q50 28 42 25 Z" {...p} />
            </g>;
        case 'rapado':
            return <path d={FLEQUILLO} fill={g.pelo} opacity="0.5" />;
        default:
            return null;
    }
}

// ─── Personajes ──────────────────────────────────────────────────────────────
// Lo que va detrás de la cabeza: orejas, cuernos, antenas, crin...
function DetrasCabeza({ a, g }) {
    const p = { fill: g.piel, stroke: g.trazo, strokeWidth: 1.3, strokeLinejoin: 'round' };
    switch (a.base) {
        case 'persona':
            return <g>
                <circle cx="24.5" cy="50" r="5.5" {...p} /><circle cx="75.5" cy="50" r="5.5" {...p} />
                <path d="M23 47.5 Q25.8 50 23.5 53" fill="none" stroke={g.trazo} strokeWidth="0.9" opacity="0.6" />
                <path d="M77 47.5 Q74.2 50 76.5 53" fill="none" stroke={g.trazo} strokeWidth="0.9" opacity="0.6" />
            </g>;
        case 'gato':
            return <g>
                <path d="M27 37 L25 9 Q36 12 47 23 Z" {...p} /><path d="M73 37 L75 9 Q64 12 53 23 Z" {...p} />
                <path d="M30 31 L29 15 Q35 18 40 24 Z" fill={ROSA} /><path d="M70 31 L71 15 Q65 18 60 24 Z" fill={ROSA} />
            </g>;
        case 'zorro':
            return <g>
                <path d="M26 38 L21 5 Q36 10 46 22 Z" {...p} /><path d="M74 38 L79 5 Q64 10 54 22 Z" {...p} />
                <path d="M29 31 L25.5 13 Q34 16 40 23 Z" fill="#fff4e6" /><path d="M71 31 L74.5 13 Q66 16 60 23 Z" fill="#fff4e6" />
                <path d="M21 5 L23 15 Q27 10 31 8.2 Z" fill="#3b2a20" /><path d="M79 5 L77 15 Q73 10 69 8.2 Z" fill="#3b2a20" />
            </g>;
        case 'oso':
            return <g>
                <circle cx="29" cy="25" r="9.5" {...p} /><circle cx="71" cy="25" r="9.5" {...p} />
                <circle cx="29" cy="25" r="5.5" fill={tono(a.piel, -28)} /><circle cx="71" cy="25" r="5.5" fill={tono(a.piel, -28)} />
            </g>;
        case 'panda':
            return <g stroke="#111" strokeWidth="1.3">
                <circle cx="29" cy="25" r="9.5" fill="#2b2b2b" /><circle cx="71" cy="25" r="9.5" fill="#2b2b2b" />
            </g>;
        case 'conejo':
            return <g>
                <ellipse cx="39" cy="14" rx="7" ry="18" transform="rotate(-10 39 14)" {...p} />
                <ellipse cx="61" cy="14" rx="7" ry="18" transform="rotate(10 61 14)" {...p} />
                <ellipse cx="39" cy="15" rx="3.5" ry="13" transform="rotate(-10 39 15)" fill={ROSA} />
                <ellipse cx="61" cy="15" rx="3.5" ry="13" transform="rotate(10 61 15)" fill={ROSA} />
            </g>;
        case 'dragon':
            return <g>
                <path d="M25 42 L9 33 L14 42 L7 48 L24 55 Z" fill={tono(a.piel, -28)} stroke={g.trazo} strokeWidth="1.3" strokeLinejoin="round" />
                <path d="M75 42 L91 33 L86 42 L93 48 L76 55 Z" fill={tono(a.piel, -28)} stroke={g.trazo} strokeWidth="1.3" strokeLinejoin="round" />
                <path d="M36 25 Q30 12 21 5 Q31 7 43 21 Z" fill="#fff1d0" stroke="#c9a66b" strokeWidth="1.2" />
                <path d="M64 25 Q70 12 79 5 Q69 7 57 21 Z" fill="#fff1d0" stroke="#c9a66b" strokeWidth="1.2" />
            </g>;
        case 'unicornio':
            return <g>
                <path d="M68 22 Q89 34 85 68 Q78 57 72 51 Z" fill={g.pelo} stroke={g.trazoPelo} strokeWidth="1.2" />
                <path d="M30 33 L28 14 Q37 18 41 25 Z" {...p} /><path d="M70 33 L72 14 Q63 18 59 25 Z" {...p} />
                <path d="M31.5 29 L30.5 18.5 Q35 21 37.5 25 Z" fill={ROSA} /><path d="M68.5 29 L69.5 18.5 Q65 21 62.5 25 Z" fill={ROSA} />
            </g>;
        case 'robot':
            return <g>
                <line x1="50" y1="21" x2="50" y2="9" stroke="#7f8c8d" strokeWidth="2.5" />
                <circle cx="50" cy="7.5" r="4" fill="#ff4757" stroke="#c0392b" strokeWidth="0.8" />
                <circle cx="48.8" cy="6.3" r="1.2" fill="white" opacity="0.8" />
                <rect x="16" y="37" width="8" height="18" rx="3" fill={tono(a.piel, -30)} stroke={g.trazo} strokeWidth="1.2" />
                <rect x="76" y="37" width="8" height="18" rx="3" fill={tono(a.piel, -30)} stroke={g.trazo} strokeWidth="1.2" />
            </g>;
        case 'alien':
            return <g fill="none" stroke={tono(a.piel, -45)} strokeWidth="2.4" strokeLinecap="round">
                <path d="M40 22 Q36 12 30 8" /><path d="M60 22 Q64 12 70 8" />
                <circle cx="30" cy="8" r="4" fill="#fdff8a" stroke={tono(a.piel, -45)} strokeWidth="1" />
                <circle cx="70" cy="8" r="4" fill="#fdff8a" stroke={tono(a.piel, -45)} strokeWidth="1" />
            </g>;
        default:
            return null;
    }
}

function Cabeza({ a, g }) {
    const p = { fill: g.piel, stroke: g.trazo, strokeWidth: 1.3 };
    switch (a.base) {
        case 'robot':
            return <g>
                <rect x="23" y="20" width="54" height="50" rx="13" fill={g.metal} stroke={g.trazo} strokeWidth="1.5" />
                <rect x="28.5" y="28.5" width="43" height="33" rx="9" fill="#14202b" stroke={tono(a.piel, -70)} strokeWidth="1.5" />
                <path d="M32 32.5 Q40 30 48 30.8" fill="none" stroke="white" strokeOpacity="0.18" strokeWidth="2" strokeLinecap="round" />
                {[[27, 24], [73, 24], [27, 66], [73, 66]].map(([x, y]) => <circle key={`${x}-${y}`} cx={x} cy={y} r="1.2" fill={g.trazo} />)}
            </g>;
        case 'rana': {
            // Se dibuja dos veces (contorno grueso debajo) para que la silueta quede unida.
            const formas = (extra) => <>
                <ellipse cx="50" cy="50" rx="30" ry="22" {...extra} />
                <circle cx="37" cy="29" r="11" {...extra} /><circle cx="63" cy="29" r="11" {...extra} />
            </>;
            return <g>{formas({ fill: g.trazo, stroke: g.trazo, strokeWidth: 2.6 })}{formas({ fill: g.piel })}</g>;
        }
        case 'alien':
            return <path d="M50 17 Q81 17 78 48 Q76 73 50 74 Q24 73 22 48 Q19 17 50 17 Z" {...p} />;
        default:
            return <circle cx="50" cy="46" r="26" {...p} />;
    }
}

// Detalles de la cara que van antes de los ojos (manchas, hocicos, máscaras).
function Cara({ a, g }) {
    const claro = tono(a.piel, 45);
    const bigotes = (op) => <g stroke={tono(a.piel, -70)} strokeWidth="0.9" strokeLinecap="round" opacity={op}>
        <line x1="21" y1="55" x2="34" y2="57" /><line x1="21" y1="60.5" x2="34" y2="59.5" />
        <line x1="79" y1="55" x2="66" y2="57" /><line x1="79" y1="60.5" x2="66" y2="59.5" />
    </g>;
    const naricita = <path d="M47.6 54.5 Q50 53.5 52.4 54.5 Q51 57.2 50 57.4 Q49 57.2 47.6 54.5 Z" fill={ROSA} stroke={tono(ROSA, -60)} strokeWidth="0.5" />;
    switch (a.base) {
        case 'persona':
            return <path d="M49.5 52.5 Q52.4 55.6 49 56.6" fill="none" stroke={g.trazo} strokeWidth="1.4" strokeLinecap="round" opacity="0.8" />;
        case 'gato':
            return <g>
                <ellipse cx="46" cy="58.5" rx="5" ry="4" fill={claro} /><ellipse cx="54" cy="58.5" rx="5" ry="4" fill={claro} />
                {naricita}{bigotes(0.6)}
            </g>;
        case 'zorro':
            return <g>
                <path d="M24.5 49 Q27 66 50 71.5 Q73 66 75.5 49 Q68 57 58.5 55 Q54 60 50 60 Q46 60 41.5 55 Q32 57 24.5 49 Z" fill="#fff4e6" />
                <ellipse cx="50" cy="57.5" rx="3.3" ry="2.3" fill="#2b2b2b" /><ellipse cx="49" cy="56.8" rx="1" ry="0.6" fill="white" opacity="0.7" />
            </g>;
        case 'oso':
            return <g>
                <ellipse cx="50" cy="59" rx="11" ry="8.5" fill={claro} stroke={tono(a.piel, -25)} strokeWidth="0.8" />
                <ellipse cx="50" cy="55" rx="4" ry="2.8" fill="#3b2a20" /><ellipse cx="48.8" cy="54.2" rx="1.2" ry="0.7" fill="white" opacity="0.7" />
            </g>;
        case 'panda':
            return <g fill="#2b2b2b">
                <ellipse cx="40" cy="47" rx="7.5" ry="9.5" transform="rotate(30 40 47)" />
                <ellipse cx="60" cy="47" rx="7.5" ry="9.5" transform="rotate(-30 60 47)" />
                <ellipse cx="50" cy="57" rx="3.5" ry="2.4" /><ellipse cx="49" cy="56.3" rx="1" ry="0.6" fill="white" opacity="0.7" />
            </g>;
        case 'conejo':
            return <g>
                <ellipse cx="46.5" cy="58.5" rx="4.5" ry="3.8" fill={claro} /><ellipse cx="53.5" cy="58.5" rx="4.5" ry="3.8" fill={claro} />
                {naricita}{bigotes(0.35)}
            </g>;
        case 'rana':
            return <g fill={tono(a.piel, -70)}><circle cx="46" cy="50" r="1" /><circle cx="54" cy="50" r="1" /></g>;
        case 'pinguino':
            return <g>
                <path d="M50 39 Q43 29 35.5 35 Q28 43 32 58 Q38 68.5 50 69.5 Q62 68.5 68 58 Q72 43 64.5 35 Q57 29 50 39 Z" fill="#fafafa" />
                <path d="M44.5 55 Q50 51.5 55.5 55 Q50 60.5 44.5 55 Z" fill="#ffa726" stroke="#e67e22" strokeWidth="0.8" />
            </g>;
        case 'dragon':
            return <g>
                {[[44, 25.5], [50, 23.5], [56, 25.5]].map(([x, y]) => <circle key={x} cx={x} cy={y} r="2.2" fill={tono(a.piel, -18)} />)}
                <ellipse cx="50" cy="60" rx="12" ry="8.5" fill={claro} stroke={tono(a.piel, -25)} strokeWidth="0.8" />
                <ellipse cx="46" cy="57" rx="1.3" ry="0.9" fill={tono(a.piel, -70)} /><ellipse cx="54" cy="57" rx="1.3" ry="0.9" fill={tono(a.piel, -70)} />
            </g>;
        case 'unicornio':
            return <g>
                <ellipse cx="50" cy="60" rx="11" ry="8" fill="#ffd6e7" opacity="0.85" />
                <ellipse cx="46.5" cy="58" rx="1.2" ry="0.8" fill="#c2185b" opacity="0.6" /><ellipse cx="53.5" cy="58" rx="1.2" ry="0.8" fill="#c2185b" opacity="0.6" />
            </g>;
        case 'alien':
            return <g fill={tono(a.piel, -20)} opacity="0.55"><circle cx="38" cy="28" r="2.5" /><circle cx="46" cy="24" r="1.6" /><circle cx="63" cy="27" r="1.9" /></g>;
        default:
            return null;
    }
}

// Lo que va por encima del pelo según el personaje (cuerno, crin delantera).
function EncimaPelo({ a, g }) {
    if (a.base !== 'unicornio') return null;
    return <g>
        <path d="M28 34 Q34 14 56 16 Q66 17 72 26 Q60 20 52 27 Q46 20 40 31 Q34 26 28 34 Z" fill={g.pelo} stroke={g.trazoPelo} strokeWidth="1.2" strokeLinejoin="round" />
        <path d="M46 23 L50 1.5 L54 23 Q50 25 46 23 Z" fill={g.oro} stroke="#c99a06" strokeWidth="0.9" strokeLinejoin="round" />
        <g stroke="#c99a06" strokeWidth="0.8"><line x1="46.8" y1="18" x2="53.2" y2="15.5" /><line x1="47.6" y1="12" x2="52.4" y2="10" /><line x1="48.4" y1="6.5" x2="51.6" y2="5" /></g>
    </g>;
}

// ─── Ojos, cejas y boca ──────────────────────────────────────────────────────
function Ojo({ cx, cy, s, tipo, iris, lado, pantalla, g }) {
    const t = `translate(${cx} ${cy}) scale(${s})`;
    const tipoReal = tipo === 'guiño' ? (lado === 'd' ? 'felices' : 'normales') : tipo;
    const arco = (color, ancho) => <path d="M-5 1.5 Q0 -5 5 1.5" fill="none" stroke={color} strokeWidth={ancho} strokeLinecap="round" />;

    if (pantalla) {
        let forma;
        switch (tipoReal) {
            case 'felices':   forma = arco(LUZ, 2.6); break;
            case 'dormidos':  forma = <line x1="-4" y1="0" x2="4" y2="0" stroke={LUZ} strokeWidth="2.4" strokeLinecap="round" />; break;
            case 'estrellas': forma = <polygon points={estrella(5.5, 2.4)} fill={LUZ} />; break;
            case 'corazon':   forma = <path d={CORAZON} fill="#ff6b9d" />; break;
            case 'brillantes': forma = <circle r="5" fill={LUZ} />; break;
            default:          forma = <rect x="-3.2" y="-4.8" width="6.4" height="9.6" rx="3.2" fill={LUZ} />;
        }
        return <g transform={t}><g filter={`url(#${g.id}brillo)`} opacity="0.8">{forma}</g>{forma}</g>;
    }

    const esclera = (rx, ry) => <ellipse rx={rx} ry={ry} fill="white" stroke="rgba(0,0,0,0.28)" strokeWidth="0.8" />;
    switch (tipoReal) {
        case 'felices':
            return <g transform={t}>{arco('#222', 2.6)}</g>;
        case 'dormidos':
            return <g transform={t}>
                <path d="M-5 -0.5 Q0 3.8 5 -0.5" fill="none" stroke="#222" strokeWidth="2.4" strokeLinecap="round" />
                <g stroke="#222" strokeWidth="1" strokeLinecap="round"><line x1="-2.5" y1="2.2" x2="-3.2" y2="4" /><line x1="0" y1="2.8" x2="0" y2="4.6" /><line x1="2.5" y1="2.2" x2="3.2" y2="4" /></g>
            </g>;
        case 'estrellas':
            return <g transform={t}>
                {esclera(5.8, 6.6)}
                <polygon points={estrella(5.4, 2.3)} fill="#ffd32a" stroke="#e1a500" strokeWidth="0.6" strokeLinejoin="round" />
                <circle cx="1.4" cy="-1.6" r="1" fill="white" />
            </g>;
        case 'corazon':
            return <g transform={t}>
                <path d={CORAZON} transform="scale(1.15)" fill="#ff3b6b" stroke="#c2185b" strokeWidth="0.6" />
                <ellipse cx="-2.2" cy="-2.4" rx="1.3" ry="0.9" fill="white" opacity="0.85" />
            </g>;
        case 'brillantes':
            return <g transform={t}>
                {esclera(6, 7.4)}
                <ellipse cy="0.9" rx="4.6" ry="5.8" fill={iris} stroke={tono(iris, -55)} strokeWidth="0.7" />
                <ellipse cy="3.2" rx="3.3" ry="2.5" fill={tono(iris, 45)} opacity="0.65" />
                <ellipse cy="0.6" rx="2.1" ry="3" fill="#111" />
                <circle cx="1.8" cy="-2.2" r="2" fill="white" /><circle cx="-1.8" cy="3" r="1" fill="white" />
                <path d="M-6.4 -3 Q0 -9.4 6.4 -3" fill="none" stroke="#222" strokeWidth="1.7" strokeLinecap="round" />
                <path d={lado === 'i' ? 'M-5.8 -4 L-8.8 -6.2' : 'M5.8 -4 L8.8 -6.2'} stroke="#222" strokeWidth="1.4" strokeLinecap="round" />
            </g>;
        default:
            return <g transform={t}>
                {esclera(5.6, 6.4)}
                <circle cy="0.6" r="4.2" fill={iris} stroke={tono(iris, -55)} strokeWidth="0.7" />
                <circle cy="0.8" r="2.1" fill="#111" />
                <circle cx="1.6" cy="-1.4" r="1.5" fill="white" /><circle cx="-1.4" cy="2.2" r="0.7" fill="white" />
            </g>;
    }
}

function Cejas({ geo, mood, color }) {
    const [[x1, y1], [x2, y2]] = geo.ojos;
    const s = geo.escala;
    let izq = 'M-5.5 -8.8 Q0 -12.3 5.5 -9.3', der = 'M-5.5 -9.3 Q0 -12.3 5.5 -8.8';
    if (mood === 'angry') { izq = 'M-5.5 -12 L5 -7.6'; der = 'M-5 -7.6 L5.5 -12'; }
    if (mood === 'happy') { izq = 'M-5.5 -10.3 Q0 -14 5.5 -10.8'; der = 'M-5.5 -10.8 Q0 -14 5.5 -10.3'; }
    const p = { fill: 'none', stroke: color, strokeWidth: 2.4, strokeLinecap: 'round' };
    return <g>
        <path d={izq} transform={`translate(${x1} ${y1}) scale(${s})`} {...p} />
        <path d={der} transform={`translate(${x2} ${y2}) scale(${s})`} {...p} />
    </g>;
}

function Boca({ tipo, y, pantalla, g }) {
    const t = `translate(50 ${y})`;
    if (pantalla) {
        let forma;
        switch (tipo) {
            case 'risa':
            case 'dientes':  forma = <path d="M-8 -2 Q0 -1 8 -2 Q7 8 0 8 Q-7 8 -8 -2 Z" fill={LUZ} />; break;
            case 'seria':    forma = <line x1="-6" y1="1" x2="6" y2="1" stroke={LUZ} strokeWidth="2.4" strokeLinecap="round" />; break;
            case 'sorpresa': forma = <ellipse rx="3.6" ry="4.2" fill="none" stroke={LUZ} strokeWidth="2.2" />; break;
            case 'enfado':   forma = <path d="M-6 3 Q0 -2.5 6 3" fill="none" stroke={LUZ} strokeWidth="2.4" strokeLinecap="round" />; break;
            default:         forma = <path d="M-7 -1 Q0 5 7 -1" fill="none" stroke={LUZ} strokeWidth="2.4" strokeLinecap="round" />;
        }
        return <g transform={t}><g filter={`url(#${g.id}brillo)`} opacity="0.8">{forma}</g>{forma}</g>;
    }
    const linea = { fill: 'none', stroke: BOCA, strokeWidth: 2.3, strokeLinecap: 'round' };
    const sonrisa = <path d="M-7 -1 Q0 5.5 7 -1" {...linea} />;
    switch (tipo) {
        case 'dientes':
            return <g transform={t}>
                <path d="M-8 -2 Q0 -1.2 8 -2 Q7 8 0 8 Q-7 8 -8 -2 Z" fill={BOCA} />
                <path d="M-4 6.2 Q0 3 4 6.2 Q0 8.2 -4 6.2 Z" fill={ROSA} />
                <path d="M-7.2 -1.6 Q0 -0.9 7.2 -1.6 Q6.8 1.6 0 1.8 Q-6.8 1.6 -7.2 -1.6 Z" fill="white" />
            </g>;
        case 'risa':
            return <g transform={t}>
                <path d="M-8.5 -2 Q0 -1 8.5 -2 Q7.5 9.5 0 9.5 Q-7.5 9.5 -8.5 -2 Z" fill={BOCA} />
                <path d="M-5 7 Q0 2.5 5 7 Q0 9.8 -5 7 Z" fill={ROSA} />
            </g>;
        case 'lengua':
            return <g transform={t}>
                <path d="M1.5 1.8 Q2 8.5 5.5 8 Q8.2 7 7 1 Z" fill={ROSA} stroke={tono(ROSA, -50)} strokeWidth="0.6" />
                <path d="M4.3 2.5 L4.6 6" stroke={tono(ROSA, -60)} strokeWidth="0.6" />
                {sonrisa}
            </g>;
        case 'gatuna':
            return <g transform={t}><path d="M-6.5 -1 Q-3.2 3.6 0 0 Q3.2 3.6 6.5 -1" {...linea} /></g>;
        case 'colmillo':
            return <g transform={t}>{sonrisa}<path d="M2.6 1.9 L5.2 1.2 L4.2 4.8 Z" fill="white" stroke="#999" strokeWidth="0.4" /></g>;
        case 'sorpresa':
            return <g transform={t}><ellipse rx="3.6" ry="4.4" fill={BOCA} /><ellipse cy="2.4" rx="2.2" ry="1.4" fill={ROSA} /></g>;
        case 'seria':
            return <g transform={t}><path d="M-5 0.5 Q0 -0.5 5 0.5" {...linea} /></g>;
        case 'enfado':
            return <g transform={t}><path d="M-6 3 Q0 -2.5 6 3" {...linea} /></g>;
        default:
            return <g transform={t}>{sonrisa}</g>;
    }
}

// ─── Ropa ────────────────────────────────────────────────────────────────────
const CUERPO = 'M11 104 Q12 81 50 77.5 Q89 81 89 104 Z';

function Ropa({ a, g }) {
    const oscuro = tono(a.ropa, -40);
    const cuello = <>
        <path d="M42 78 Q50 86 58 78 Z" fill={g.cuello} />
        <path d="M41 78.5 Q50 86.5 59 78.5" fill="none" stroke={oscuro} strokeWidth="2.2" strokeLinecap="round" />
    </>;
    let detalle = null;
    switch (a.ropaTipo) {
        case 'sudadera':
            detalle = <>
                <path d="M30 83 Q31 72 50 72.5 Q69 72 70 83 Q60 78.5 50 87 Q40 78.5 30 83 Z" fill={tono(a.ropa, -18)} stroke={g.trazoRopa} strokeWidth="1.2" />
                <g stroke="white" strokeWidth="1.4" strokeLinecap="round"><line x1="45.5" y1="85" x2="44.5" y2="96" /><line x1="54.5" y1="85" x2="55.5" y2="96" /></g>
                <circle cx="44.4" cy="97" r="1.3" fill="#dfe6e9" /><circle cx="55.6" cy="97" r="1.3" fill="#dfe6e9" />
                <path d="M34 104 Q36 98 50 98 Q64 98 66 104" fill={tono(a.ropa, -10)} stroke={oscuro} strokeWidth="1" />
            </>;
            break;
        case 'camisa':
            detalle = <>
                <path d="M43 78 L50 88 L57 78 Z" fill={g.cuello} />
                <path d="M42 77.5 L50 88 L43.5 90.5 L37.5 80.5 Z" fill="white" stroke="#b2bec3" strokeWidth="0.8" strokeLinejoin="round" />
                <path d="M58 77.5 L50 88 L56.5 90.5 L62.5 80.5 Z" fill="white" stroke="#b2bec3" strokeWidth="0.8" strokeLinejoin="round" />
                <circle cx="50" cy="93" r="1.1" fill={oscuro} /><circle cx="50" cy="99" r="1.1" fill={oscuro} />
            </>;
            break;
        case 'rayas':
            detalle = <>
                <g clipPath={`url(#${g.id}cuerpo)`} fill="white" opacity="0.55">
                    <rect x="0" y="84" width="100" height="4" /><rect x="0" y="92" width="100" height="4" /><rect x="0" y="100" width="100" height="4" />
                </g>
                {cuello}
            </>;
            break;
        case 'heroe':
            detalle = <>
                <path d="M15 93 Q19 80 38 78 L34 86 Q24 88 15 93 Z" fill="#e74c3c" stroke="#a93226" strokeWidth="1" />
                <path d="M85 93 Q81 80 62 78 L66 86 Q76 88 85 93 Z" fill="#e74c3c" stroke="#a93226" strokeWidth="1" />
                {cuello}
                <path d="M40 85 L60 85 L64 90 L50 102 L36 90 Z" fill={g.oro} stroke="#b7950b" strokeWidth="1" strokeLinejoin="round" />
                <text x="50" y="95.5" textAnchor="middle" fontSize="11" fontWeight="900" fill="#e74c3c" fontFamily="Georgia, serif">π</text>
            </>;
            break;
        case 'traje':
            detalle = <>
                <path d="M42 78 L50 97 L58 78 Z" fill="white" />
                <path d="M42 78 L50 97 L40 88 L44 84 Z" fill={tono(a.ropa, -18)} stroke={g.trazoRopa} strokeWidth="0.8" strokeLinejoin="round" />
                <path d="M58 78 L50 97 L60 88 L56 84 Z" fill={tono(a.ropa, -18)} stroke={g.trazoRopa} strokeWidth="0.8" strokeLinejoin="round" />
                <path d="M48.4 80.5 L51.6 80.5 L52.8 83 L51.5 95 L50 97.5 L48.5 95 L47.2 83 Z" fill="#e74c3c" stroke="#a93226" strokeWidth="0.6" />
            </>;
            break;
        default:
            detalle = cuello;
    }
    return <g>
        <path d={CUERPO} fill={g.ropa} stroke={g.trazoRopa} strokeWidth="1.3" />
        {detalle}
    </g>;
}

// ─── Complementos ────────────────────────────────────────────────────────────
function Accesorio({ a, g, geo }) {
    const [[x1, y1], [x2, y2]] = geo.ojos;
    const s = geo.escala;
    switch (a.accesorio) {
        case 'gafas': {
            const r = 7.5 * s;
            return <g stroke={OSCURO} strokeWidth="2" fill="rgba(255,255,255,0.18)">
                <circle cx={x1} cy={y1} r={r} /><circle cx={x2} cy={y2} r={r} />
                <path d={`M${x1 + r} ${y1} Q50 ${y1 - 3} ${x2 - r} ${y2}`} fill="none" />
                <line x1={x1 - r} y1={y1 - 1} x2="23" y2={y1 - 3} /><line x1={x2 + r} y1={y2 - 1} x2="77" y2={y2 - 3} />
            </g>;
        }
        case 'gafasSol': {
            const lente = (cx, cy) => `M${cx - 8.5} ${cy - 5} Q${cx} ${cy - 6.5} ${cx + 8.5} ${cy - 5} Q${cx + 8.5} ${cy + 6.5} ${cx} ${cy + 6.5} Q${cx - 8.5} ${cy + 6.5} ${cx - 8.5} ${cy - 5} Z`;
            return <g>
                <line x1="23" y1={y1 - 4} x2="77" y2={y2 - 4} stroke="#111" strokeWidth="1.6" />
                <path d={lente(x1, y1)} fill={g.sol} stroke="#111" strokeWidth="1.2" />
                <path d={lente(x2, y2)} fill={g.sol} stroke="#111" strokeWidth="1.2" />
                <g stroke="white" strokeOpacity="0.55" strokeWidth="1.4" strokeLinecap="round">
                    <line x1={x1 - 4.5} y1={y1 - 1.5} x2={x1 - 1.5} y2={y1 - 3.5} /><line x1={x2 - 4.5} y1={y2 - 1.5} x2={x2 - 1.5} y2={y2 - 3.5} />
                </g>
            </g>;
        }
        case 'gorra':
            return <g>
                <path d="M23 38 Q22 12 50 12 Q78 12 77 38 Q50 32 23 38 Z" fill={g.ropa} stroke={g.trazoRopa} strokeWidth="1.3" />
                <path d="M50 12.5 L50 33.5" stroke={tono(a.ropa, -35)} strokeWidth="0.8" />
                <path d="M44 35.5 Q66 31 86 37 Q88 42 80 42.5 Q62 39 44 40 Z" fill={tono(a.ropa, -35)} stroke={g.trazoRopa} strokeWidth="1.1" strokeLinejoin="round" />
                <circle cx="50" cy="12.5" r="2.2" fill={tono(a.ropa, -35)} />
                <circle cx="39" cy="25" r="5" fill="white" stroke={g.trazoRopa} strokeWidth="0.6" />
                <text x="39" y="27.6" textAnchor="middle" fontSize="7.5" fontWeight="900" fill={a.ropa === '#ecf0f1' ? OSCURO : a.ropa} fontFamily="Georgia, serif">π</text>
            </g>;
        case 'gorroLana':
            return <g>
                <path d="M22.5 40 Q21 11 50 10.5 Q79 11 77.5 40 Z" fill={g.ropa} stroke={g.trazoRopa} strokeWidth="1.3" />
                <g stroke={tono(a.ropa, -25)} strokeWidth="0.8" opacity="0.7">
                    {[34, 42, 50, 58, 66].map((x) => <line key={x} x1={x} y1={x === 50 ? 12 : 15} x2={x} y2="33" />)}
                </g>
                <rect x="20" y="32" width="60" height="10" rx="5" fill={tono(a.ropa, -22)} stroke={g.trazoRopa} strokeWidth="1.2" />
                <circle cx="50" cy="9" r="6.5" fill="#fafafa" stroke="#b2bec3" strokeWidth="1" />
                <circle cx="48" cy="7" r="2" fill="white" />
            </g>;
        case 'corona':
            return <g>
                <path d="M30 30 L31 10 L41 19 L50 5 L59 19 L69 10 L70 30 Q50 34 30 30 Z" fill={g.oro} stroke="#b7950b" strokeWidth="1" strokeLinejoin="round" />
                <circle cx="31" cy="9.5" r="2" fill={g.oro} stroke="#b7950b" strokeWidth="0.7" />
                <circle cx="50" cy="4.5" r="2.4" fill={g.oro} stroke="#b7950b" strokeWidth="0.7" />
                <circle cx="69" cy="9.5" r="2" fill={g.oro} stroke="#b7950b" strokeWidth="0.7" />
                <circle cx="50" cy="24.5" r="2.8" fill="#e74c3c" stroke="#922b21" strokeWidth="0.6" />
                <circle cx="39" cy="26" r="2" fill="#3498db" stroke="#1f618d" strokeWidth="0.6" />
                <circle cx="61" cy="26" r="2" fill="#2ecc71" stroke="#1e8449" strokeWidth="0.6" />
            </g>;
        case 'mago':
            return <g>
                <path d="M24 32 Q40 22 58 -4 Q64 16 76 32 Z" fill="#5f27cd" stroke="#341f97" strokeWidth="1.2" strokeLinejoin="round" />
                <path d="M27 29 Q50 23.5 73 29 L74 32.5 Q50 27 26 32.5 Z" fill="#feca57" />
                <ellipse cx="50" cy="32.5" rx="30" ry="5.5" fill="#341f97" />
                <polygon points={estrella(3.2, 1.3)} transform="translate(47 16)" fill="#feca57" />
                <polygon points={estrella(2.2, 0.9)} transform="translate(58 7)" fill="#feca57" />
                <path d="M62 19 A4 4 0 1 0 66 24 A3 3 0 1 1 62 19 Z" fill="#feca57" />
            </g>;
        case 'auriculares':
            return <g>
                <path d="M22 50 Q20 14 50 14 Q80 14 78 50" fill="none" stroke={OSCURO} strokeWidth="5" strokeLinecap="round" />
                <path d="M24 44 Q23 18 50 17" fill="none" stroke="#636e72" strokeWidth="1.5" strokeLinecap="round" />
                <path d="M21 56 Q23 70 40 66" fill="none" stroke={OSCURO} strokeWidth="2.2" strokeLinecap="round" />
                <circle cx="41" cy="65.6" r="2.3" fill="#636e72" stroke={OSCURO} strokeWidth="0.8" />
                {[14, 74].map((x) => <g key={x}>
                    <rect x={x} y="40" width="12" height="20" rx="5" fill={OSCURO} />
                    <rect x={x + 2.5} y="43" width="7" height="14" rx="3.5" fill="none" stroke="#00e5ff" strokeWidth="1.5" filter={`url(#${g.id}brillo)`} />
                    <rect x={x + 2.5} y="43" width="7" height="14" rx="3.5" fill="none" stroke="#7ff6ff" strokeWidth="1.2" />
                </g>)}
            </g>;
        case 'pirata':
            return <g>
                <line x1="25" y1="36" x2="77" y2={y2 + 5} stroke="#111" strokeWidth="1.6" />
                <ellipse cx={x2} cy={y2} rx={6.8 * s} ry={6.3 * s} fill="#111" />
                <path d="M15 34 Q20 17 34 20 Q42 7 50 7 Q58 7 66 20 Q80 17 85 34 Q50 25 15 34 Z" fill="#222" stroke="#000" strokeWidth="1" strokeLinejoin="round" />
                <path d="M15 34 Q50 25 85 34" fill="none" stroke="#f1c40f" strokeWidth="1.8" />
                <circle cx="50" cy="18" r="4" fill="white" />
                <circle cx="48.6" cy="17.6" r="0.9" fill="#222" /><circle cx="51.4" cy="17.6" r="0.9" fill="#222" />
                <g stroke="white" strokeWidth="1.3" strokeLinecap="round"><line x1="44.5" y1="21" x2="55.5" y2="26" /><line x1="55.5" y1="21" x2="44.5" y2="26" /></g>
            </g>;
        case 'vikingo':
            return <g>
                <path d="M25 32 Q9 27 11 7 Q17 22 31 26 Z" fill="#fdf6e3" stroke="#c8b48a" strokeWidth="1.1" strokeLinejoin="round" />
                <path d="M75 32 Q91 27 89 7 Q83 22 69 26 Z" fill="#fdf6e3" stroke="#c8b48a" strokeWidth="1.1" strokeLinejoin="round" />
                <path d="M23 38 Q22 11 50 11 Q78 11 77 38 Z" fill={g.plata} stroke="#636e72" strokeWidth="1.2" />
                <path d="M50 11.5 L50 33" stroke="#8d6e63" strokeWidth="3" />
                <rect x="21" y="32" width="58" height="7" rx="3" fill="#8d6e63" stroke="#5d4037" strokeWidth="1" />
                {[28, 39, 61, 72].map((x) => <circle key={x} cx={x} cy="35.5" r="1.1" fill="#d7ccc8" />)}
            </g>;
        case 'astronauta':
            return <g>
                <rect x="25" y="74" width="50" height="9" rx="4.5" fill="#dfe6e9" stroke="#95a5a6" strokeWidth="1.2" />
                <circle cx="50" cy="46" r="33" fill={g.cristal} stroke="#ecf0f1" strokeWidth="3.5" />
                <circle cx="50" cy="46" r="34.8" fill="none" stroke="#95a5a6" strokeWidth="0.8" />
                <path d="M26 36 Q30 21 45 15.5" fill="none" stroke="white" strokeOpacity="0.75" strokeWidth="3" strokeLinecap="round" />
                <circle cx="24.5" cy="44" r="1.6" fill="white" opacity="0.7" />
            </g>;
        case 'lazo':
            return <g>
                <path d="M70 24 L66 34 L69 33 L70 36 Z" fill="#e84393" /><path d="M70 24 L75 34 L72 33.5 L71.5 36 Z" fill="#e84393" />
                <path d="M70 24 Q57 12 57.5 22 Q58 32 70 24 Z" fill="#ff6b9d" stroke="#c2185b" strokeWidth="1" />
                <path d="M70 24 Q83 12 82.5 22 Q82 32 70 24 Z" fill="#ff6b9d" stroke="#c2185b" strokeWidth="1" />
                <circle cx="70" cy="24" r="3.3" fill="#e84393" stroke="#c2185b" strokeWidth="0.8" />
            </g>;
        case 'flor':
            return <g transform="translate(71 25)">
                <path d="M-3 4 Q-8 9 -12 7 Q-9 3 -3 4 Z" fill="#2ecc71" stroke="#1e8449" strokeWidth="0.6" />
                {[0, 72, 144, 216, 288].map((ang) => <circle key={ang} cx={4.6 * Math.cos((ang * Math.PI) / 180)} cy={4.6 * Math.sin((ang * Math.PI) / 180)} r="4.2" fill="#ff9ff3" stroke="#f368e0" strokeWidth="0.7" />)}
                <circle r="3" fill="#feca57" stroke="#e1a500" strokeWidth="0.6" />
            </g>;
        case 'pajarita':
            return <g>
                <path d="M50 80 L39.5 74 L39.5 86 Z" fill="#e74c3c" stroke="#a93226" strokeWidth="0.9" strokeLinejoin="round" />
                <path d="M50 80 L60.5 74 L60.5 86 Z" fill="#e74c3c" stroke="#a93226" strokeWidth="0.9" strokeLinejoin="round" />
                <circle cx="50" cy="80" r="2.7" fill="#c0392b" stroke="#a93226" strokeWidth="0.7" />
            </g>;
        default:
            return null;
    }
}

// ─── Reacciones ──────────────────────────────────────────────────────────────
function ExtrasMood({ mood }) {
    if (mood === 'happy') return <g fill="#ffe066" stroke="#f4b400" strokeWidth="0.6">
        <path d={destello(15, 27, 5)} /><path d={destello(86, 33, 4)} /><path d={destello(80, 12, 2.8)} />
    </g>;
    if (mood === 'angry') return <path d="M73 17 Q76.5 20.5 73 24 M83 17 Q79.5 20.5 83 24 M74.5 15.5 Q78 19 81.5 15.5 M74.5 25.5 Q78 22 81.5 25.5"
        fill="none" stroke="#ff3b3b" strokeWidth="2.1" strokeLinecap="round" />;
    return null;
}

const CSS_ANIM = '@keyframes piktAvParpadeo{0%,93%,100%{transform:scaleY(1)}96%{transform:scaleY(0.1)}}';

// Hash corto de la configuración: si dos SVG llegaran a compartir id (p. ej. en
// raíces React distintas), al menos sus degradados serían idénticos.
function hashCfg(obj) {
    const s = JSON.stringify(obj);
    let h = 0;
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
    return (h >>> 0).toString(36);
}

export default function AvatarSVG({ config, size = 64, mood = 'neutral', animado = false, style, title }) {
    const a = normalizarAvatar(config);
    const id = 'av' + useId().replace(/[^a-zA-Z0-9]/g, '') + hashCfg(a);
    const geo = geometria(a.base);
    const ojos = mood === 'happy' ? 'felices' : a.ojos;
    const boca = mood === 'happy' ? 'risa' : mood === 'angry' ? 'enfado' : a.boca;
    const esPersona = a.base === 'persona';
    const colorCejas = esPersona ? tono(a.colorPelo, -20) : tono(a.piel, -80);
    const parpadea = animado && !['felices', 'dormidos'].includes(ojos);

    // Referencias a degradados y colores derivados que usan las capas.
    const g = {
        id,
        piel: `url(#${id}piel)`, metal: `url(#${id}metal)`, ropa: `url(#${id}ropa)`, pelo: `url(#${id}pelo)`,
        oro: `url(#${id}oro)`, plata: `url(#${id}plata)`, cristal: `url(#${id}cristal)`, sol: `url(#${id}sol)`,
        trazo: tono(a.piel, -55), trazoPelo: tono(a.colorPelo, -45), trazoRopa: tono(a.ropa, -55),
        ropaColor: a.ropa, cuello: a.base === 'robot' ? '#95a5a6' : tono(a.piel, -25),
    };

    return (
        <svg viewBox="0 0 100 100" width={size} height={size} style={{ display: 'block', flexShrink: 0, ...style }} role="img" aria-label={title || 'Avatar'}>
            {title && <title>{title}</title>}
            <defs>
                <clipPath id={`${id}clip`}><circle cx="50" cy="50" r="50" /></clipPath>
                <clipPath id={`${id}cuerpo`}><path d={CUERPO} /></clipPath>
                <radialGradient id={`${id}fondo`} cx="50%" cy="40%" r="75%">
                    <stop offset="0" stopColor={tono(a.fondo, 50)} /><stop offset="0.55" stopColor={a.fondo} /><stop offset="1" stopColor={tono(a.fondo, -40)} />
                </radialGradient>
                <radialGradient id={`${id}piel`} cx="38%" cy="30%" r="80%">
                    <stop offset="0" stopColor={tono(a.piel, 16)} /><stop offset="0.5" stopColor={a.piel} /><stop offset="1" stopColor={tono(a.piel, -30)} />
                </radialGradient>
                <linearGradient id={`${id}metal`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor={tono(a.piel, 55)} /><stop offset="0.5" stopColor={a.piel} /><stop offset="1" stopColor={tono(a.piel, -35)} />
                </linearGradient>
                <linearGradient id={`${id}ropa`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor={tono(a.ropa, 30)} /><stop offset="1" stopColor={tono(a.ropa, -30)} />
                </linearGradient>
                <linearGradient id={`${id}pelo`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor={tono(a.colorPelo, 40)} /><stop offset="0.5" stopColor={a.colorPelo} /><stop offset="1" stopColor={tono(a.colorPelo, -30)} />
                </linearGradient>
                <linearGradient id={`${id}oro`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor="#fff3a0" /><stop offset="0.5" stopColor="#f1c40f" /><stop offset="1" stopColor="#d4a017" />
                </linearGradient>
                <linearGradient id={`${id}plata`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor="#f5f6fa" /><stop offset="0.5" stopColor="#b2bec3" /><stop offset="1" stopColor="#7f8c8d" />
                </linearGradient>
                <linearGradient id={`${id}sol`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor="#636e72" /><stop offset="1" stopColor="#111" />
                </linearGradient>
                <radialGradient id={`${id}cristal`} cx="35%" cy="28%" r="80%">
                    <stop offset="0" stopColor="white" stopOpacity="0.3" /><stop offset="1" stopColor="#c8e6ff" stopOpacity="0.08" />
                </radialGradient>
                <filter id={`${id}brillo`} x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="1.3" /></filter>
                {parpadea && <style>{CSS_ANIM}</style>}
            </defs>
            <g clipPath={`url(#${id}clip)`}>
                <rect width="100" height="100" fill={`url(#${id}fondo)`} />
                <Patron tipo={a.patron} />
                {esPersona && <PeloDetras pelo={a.pelo} g={g} />}
                <rect x="43.5" y="62" width="13" height="18" fill={g.cuello} />
                <Ropa a={a} g={g} />
                <DetrasCabeza a={a} g={g} />
                <Cabeza a={a} g={g} />
                <Cara a={a} g={g} />
                {esPersona && <PeloDelante pelo={a.pelo} g={g} />}
                <EncimaPelo a={a} g={g} />
                {!geo.pantalla && <g fill="#ff6f91" opacity={mood === 'happy' ? 0.55 : 0.33}>
                    <ellipse cx="35" cy={geo.boca - 4.5} rx="4.6" ry="2.9" /><ellipse cx="65" cy={geo.boca - 4.5} rx="4.6" ry="2.9" />
                </g>}
                <g style={parpadea ? { animation: 'piktAvParpadeo 4.5s infinite', transformBox: 'view-box', transformOrigin: `50px ${geo.ojos[0][1]}px` } : undefined}>
                    <Ojo cx={geo.ojos[0][0]} cy={geo.ojos[0][1]} s={geo.escala} tipo={ojos} iris={a.colorOjos} lado="i" pantalla={geo.pantalla} g={g} />
                    <Ojo cx={geo.ojos[1][0]} cy={geo.ojos[1][1]} s={geo.escala} tipo={ojos} iris={a.colorOjos} lado="d" pantalla={geo.pantalla} g={g} />
                </g>
                {geo.cejas && <Cejas geo={geo} mood={mood} color={colorCejas} />}
                <Boca tipo={boca} y={geo.boca} pantalla={geo.pantalla} g={g} />
                <Accesorio a={a} g={g} geo={geo} />
                <ExtrasMood mood={mood} />
            </g>
        </svg>
    );
}
