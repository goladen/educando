import AvatarSVG from '../components/avatar/AvatarSVG';
import { normalizarAvatar } from '../utils/avatarLocal';

// Personaje de cuerpo entero para el cómic: la cabeza es el avatar (AvatarSVG
// soloCabeza) y el cuerpo se dibuja aquí con la ropa y los colores del avatar.
// viewBox 0 0 100 210. Las extremidades son trazos con articulaciones, así que
// cada pose es solo una lista de puntos.

export const POSES = [
    { id: 'pie', label: 'De pie', emoji: '🧍' },
    { id: 'saluda', label: 'Saluda', emoji: '👋' },
    { id: 'senala', label: 'Señala', emoji: '👉' },
    { id: 'celebra', label: 'Celebra', emoji: '🙌' },
    { id: 'corre', label: 'Corre', emoji: '🏃' },
    { id: 'piensa', label: 'Piensa', emoji: '🤔' },
    { id: 'jarras', label: 'En jarras', emoji: '😤' },
    { id: 'encoge', label: '¿Yo qué sé?', emoji: '🤷' },
];

// Hombros (33,86)/(67,86), caderas (43,136)/(57,136). [codo, mano] y [rodilla, pie].
const PIE_L = [[41, 166], [40, 195]], PIE_R = [[59, 166], [60, 195]];
const ABIERTAS_L = [[38, 166], [34, 195]], ABIERTAS_R = [[62, 166], [66, 195]];
const BRAZO_L = [[28, 110], [27, 133]], BRAZO_R = [[72, 110], [73, 133]];
const DEF_POSES = {
    pie:     { bl: BRAZO_L, br: BRAZO_R, pl: PIE_L, pr: PIE_R },
    saluda:  { bl: BRAZO_L, br: [[84, 74], [92, 54]], pl: PIE_L, pr: PIE_R, manoAbiertaR: true },
    senala:  { bl: BRAZO_L, br: [[85, 88], [99, 84]], pl: PIE_L, pr: PIE_R, dedoR: true },
    celebra: { bl: [[19, 68], [9, 48]], br: [[81, 68], [91, 48]], pl: ABIERTAS_L, pr: ABIERTAS_R },
    corre:   { bl: [[24, 108], [17, 126]], br: [[77, 104], [71, 88]], pl: [[34, 158], [28, 184]], pr: [[61, 166], [64, 195]] },
    piensa:  { bl: [[30, 112], [59, 113]], br: [[74, 112], [57, 76]], pl: PIE_L, pr: PIE_R },
    jarras:  { bl: [[19, 106], [35, 128]], br: [[81, 106], [65, 128]], pl: ABIERTAS_L, pr: ABIERTAS_R },
    encoge:  { bl: [[21, 100], [14, 82]], br: [[79, 100], [86, 82]], pl: PIE_L, pr: PIE_R, manoAbiertaL: true, manoAbiertaR: true },
};
export const poseValida = (p) => (DEF_POSES[p] ? p : 'pie');

function tono(hex, cant) {
    const n = parseInt((hex || '#888888').slice(1), 16);
    const c = (v) => Math.max(0, Math.min(255, v + cant));
    return '#' + [c(n >> 16), c((n >> 8) & 255), c(n & 255)].map((v) => v.toString(16).padStart(2, '0')).join('');
}

const ANIMALES_SIN_ZAPATOS = new Set(['gato', 'zorro', 'oso', 'panda', 'conejo', 'rana', 'pinguino', 'dragon', 'unicornio']);

function Extremidad({ desde, puntos, color, contorno, ancho, colorFinal, anchoFinal }) {
    const [m, f] = puntos;
    const d1 = `M${desde[0]} ${desde[1]} L${m[0]} ${m[1]}`;
    const d2 = `M${m[0]} ${m[1]} L${f[0]} ${f[1]}`;
    const af = anchoFinal ?? ancho;
    return <g strokeLinecap="round" strokeLinejoin="round" fill="none">
        <path d={d1} stroke={contorno} strokeWidth={ancho + 2.6} />
        <path d={d2} stroke={contorno} strokeWidth={af + 2.6} />
        <path d={d2} stroke={colorFinal || color} strokeWidth={af} />
        <path d={d1} stroke={color} strokeWidth={ancho} />
    </g>;
}

function Mano({ p, codo, color, contorno, abierta, dedo }) {
    const ang = Math.atan2(p[1] - codo[1], p[0] - codo[0]) * 180 / Math.PI;
    return <g transform={`translate(${p[0]} ${p[1]}) rotate(${ang})`} stroke={contorno} strokeWidth="1.3" fill={color}>
        {dedo && <rect x="2" y="-1.8" width="8" height="3.6" rx="1.8" />}
        {abierta && <g><rect x="2" y="-5" width="6.5" height="2.6" rx="1.3" /><rect x="3" y="-1.4" width="7" height="2.6" rx="1.3" /><rect x="2" y="2.2" width="6" height="2.6" rx="1.3" /></g>}
        <circle r="5.4" />
    </g>;
}

function Pie({ p, rodilla, color, contorno, zapato }) {
    const haciaFuera = p[0] < 50 ? -1 : 1;
    const desp = (p[0] - rodilla[0]) * 0.3 + haciaFuera * 2;
    return <ellipse cx={p[0] + desp} cy={p[1] + 2.5} rx={zapato ? 8.5 : 7} ry={zapato ? 4.8 : 4.2} fill={color} stroke={contorno} strokeWidth="1.4" />;
}

export default function PersonajeCuerpo({ cfg, mood = 'neutral', pose = 'pie' }) {
    const a = normalizarAvatar(cfg);
    const P = DEF_POSES[poseValida(pose)];
    const ropa = a.ropa;
    const trazoRopa = tono(ropa, -60);
    const esRobot = a.base === 'robot';
    const piel = a.piel;
    const trazoPiel = tono(piel, -60);
    const mangaCorta = a.ropaTipo === 'camiseta' || a.ropaTipo === 'rayas';
    const pantalon = a.ropaTipo === 'traje' ? tono(ropa, -25) : a.ropaTipo === 'heroe' ? tono(ropa, -45) : esRobot ? '#95a5a6' : '#3b5b8c';
    const trazoPant = tono(pantalon, -55);
    const zapato = !ANIMALES_SIN_ZAPATOS.has(a.base);
    const colorPie = zapato ? (a.ropaTipo === 'heroe' ? '#e74c3c' : '#2d3436') : piel;
    const colorMano = a.ropaTipo === 'heroe' ? tono(ropa, 30) : piel;
    const hombroL = [33, 86], hombroR = [67, 86], caderaL = [43, 134], caderaR = [57, 134];
    const torso = 'M33 80 Q50 75 67 80 L71 92 L66 140 L34 140 L29 92 Z';
    const idc = 'pc' + (a.ropaTipo || '') + ropa.slice(1);

    const brazo = (lado) => {
        const h = lado === 'l' ? hombroL : hombroR;
        const pts = lado === 'l' ? P.bl : P.br;
        return <Extremidad desde={h} puntos={pts} color={ropa} contorno={trazoRopa} ancho={11}
            colorFinal={mangaCorta ? piel : ropa} anchoFinal={mangaCorta ? 8.5 : 10} />;
    };
    const mano = (lado) => {
        const pts = lado === 'l' ? P.bl : P.br;
        return <Mano p={pts[1]} codo={pts[0]} color={colorMano} contorno={tono(colorMano, -60)}
            abierta={lado === 'l' ? P.manoAbiertaL : P.manoAbiertaR} dedo={lado === 'r' && P.dedoR} />;
    };

    return (
        <g>
            {a.ropaTipo === 'heroe' && <path d={`M36 82 Q${50 + (pose === 'corre' ? -18 : 0)} 150 ${pose === 'corre' ? 10 : 24} 168 L${pose === 'corre' ? 46 : 76} 168 Q50 150 64 82 Z`} fill="#e74c3c" stroke="#a93226" strokeWidth="1.4" strokeLinejoin="round" />}
            {/* Piernas */}
            <Extremidad desde={caderaL} puntos={P.pl} color={pantalon} contorno={trazoPant} ancho={12.5} />
            <Extremidad desde={caderaR} puntos={P.pr} color={pantalon} contorno={trazoPant} ancho={12.5} />
            <Pie p={P.pl[1]} rodilla={P.pl[0]} color={colorPie} contorno={tono(colorPie, -50)} zapato={zapato} />
            <Pie p={P.pr[1]} rodilla={P.pr[0]} color={colorPie} contorno={tono(colorPie, -50)} zapato={zapato} />
            {/* Cuello y torso */}
            <rect x="44" y="64" width="12" height="18" fill={esRobot ? '#95a5a6' : tono(piel, -25)} />
            <defs><clipPath id={idc}><path d={torso} /></clipPath></defs>
            <path d={torso} fill={ropa} stroke={trazoRopa} strokeWidth="1.5" strokeLinejoin="round" />
            <g clipPath={`url(#${idc})`}>
                {a.ropaTipo === 'rayas' && [88, 98, 108, 118, 128].map((y) => <rect key={y} x="20" y={y} width="60" height="4.5" fill="white" opacity="0.55" />)}
                {a.ropaTipo === 'sudadera' && <path d="M38 116 Q38 112 42 112 H58 Q62 112 62 116 V126 H38 Z" fill={tono(ropa, -14)} stroke={trazoRopa} strokeWidth="1" />}
                {(a.ropaTipo === 'traje' || a.ropaTipo === 'heroe') && <rect x="28" y="128" width="44" height="7" fill={a.ropaTipo === 'heroe' ? '#f1c40f' : tono(ropa, -30)} stroke={trazoRopa} strokeWidth="0.8" />}
                <rect x="28" y="136" width="44" height="6" fill={tono(pantalon, 0)} />
            </g>
            {a.ropaTipo === 'sudadera' && <>
                <path d="M36 82 Q38 74 50 74 Q62 74 64 82 Q57 79 50 87 Q43 79 36 82 Z" fill={tono(ropa, -18)} stroke={trazoRopa} strokeWidth="1.2" />
                <g stroke="white" strokeWidth="1.4" strokeLinecap="round"><line x1="46.5" y1="86" x2="46" y2="96" /><line x1="53.5" y1="86" x2="54" y2="96" /></g>
            </>}
            {a.ropaTipo === 'camisa' && <>
                <path d="M43 78 L50 89 L57 78 Z" fill={tono(piel, -25)} />
                <path d="M42 77.5 L50 89 L44 91.5 L39 81 Z M58 77.5 L50 89 L56 91.5 L61 81 Z" fill="white" stroke="#b2bec3" strokeWidth="0.8" strokeLinejoin="round" />
                {[96, 106, 116, 126].map((y) => <circle key={y} cx="50" cy={y} r="1.2" fill={trazoRopa} />)}
            </>}
            {a.ropaTipo === 'traje' && <>
                <path d="M43 78 L50 100 L57 78 Z" fill="white" />
                <path d="M43 78 L50 100 L41 90 L44 84 Z M57 78 L50 100 L59 90 L56 84 Z" fill={tono(ropa, -18)} stroke={trazoRopa} strokeWidth="0.8" strokeLinejoin="round" />
                <path d="M48.4 81 L51.6 81 L52.8 84 L51.5 97 L50 99.5 L48.5 97 L47.2 84 Z" fill="#e74c3c" stroke="#a93226" strokeWidth="0.6" />
            </>}
            {a.ropaTipo === 'heroe' && <>
                <path d="M41 90 L59 90 L63 95 L50 107 L37 95 Z" fill="#f1c40f" stroke="#b7950b" strokeWidth="1" strokeLinejoin="round" />
                <text x="50" y="100.5" textAnchor="middle" fontSize="11" fontWeight="900" fill="#e74c3c" fontFamily="Georgia, serif">π</text>
            </>}
            {(a.ropaTipo === 'camiseta' || a.ropaTipo === 'rayas') && <path d="M43 78 Q50 86 57 78" fill={tono(piel, -25)} stroke={trazoRopa} strokeWidth="2" strokeLinecap="round" />}
            {/* Cabeza (antes que los brazos: así una mano en la barbilla o en alto queda delante) */}
            <g transform="translate(4 0) scale(0.92)">
                <AvatarSVG config={a} size={100} mood={mood} sinFondo soloCabeza />
            </g>
            {brazo('l')}{brazo('r')}
            {mano('l')}{mano('r')}
        </g>
    );
}
