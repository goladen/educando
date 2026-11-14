// Garabatos: mascotas del Patio de Juegos (SVG propio, sin imágenes externas)
// tipo 0-5 cambia cuernos/antenas/orejas · animo: 'normal' | 'feliz' | 'triste' | 'golpe'
import React from 'react';

export const MONSTRUOS = [
    { nombre: 'Blop', color: '#ff5d73' },
    { nombre: 'Zuri', color: '#3a86ff' },
    { nombre: 'Tako', color: '#2ec4b6' },
    { nombre: 'Mimo', color: '#ff9f1c' },
    { nombre: 'Grum', color: '#8e5cff' },
    { nombre: 'Pipa', color: '#16a34a' },
];
// Jefe final (más grande y con corona)
export const JEFE = { nombre: 'Rey Garabato', color: '#6d28d9' };

const oscurecer = (hex, f = 0.72) => {
    const n = parseInt(hex.slice(1), 16);
    const c = (s) => Math.round(((n >> s) & 255) * f);
    return `rgb(${c(16)},${c(8)},${c(0)})`;
};

export default function Monstruo({ tipo = 0, color, size = 120, animo = 'normal', corona = false, style }) {
    const base = color || MONSTRUOS[tipo % MONSTRUOS.length].color;
    const borde = oscurecer(base);
    const t = tipo % 6;
    // 'golpe' = el garabato se está borrando (acierto del alumno): mareado, no enfadado
    const mareado = animo === 'golpe';
    const feliz = animo === 'feliz';
    const anim = feliz ? 'patioSalto .5s ease' : mareado ? 'patioBorra .9s ease' : animo === 'triste' ? 'patioTiembla .4s ease' : 'patioFlota 3s ease-in-out infinite';
    const espiral = (cx, cy) => <path d={`M${cx} ${cy} m-1 0 a1.5 1.5 0 1 1 3 0 a3.5 3.5 0 1 1 -7 0 a5.5 5.5 0 1 1 11 0 a7.5 7.5 0 1 1 -15 0`} stroke="#1f1235" strokeWidth="2.5" fill="white" strokeLinecap="round" />;
    return (
        <svg viewBox="0 0 120 120" width={size} height={size} style={{ overflow: 'visible', animation: anim, ...style }} aria-hidden="true">
            {/* Adornos superiores */}
            {t === 0 && <><path d="M38 30 L30 6 L50 24 Z" fill="#fff3c4" stroke={borde} strokeWidth="3" strokeLinejoin="round" /><path d="M82 30 L90 6 L70 24 Z" fill="#fff3c4" stroke={borde} strokeWidth="3" strokeLinejoin="round" /></>}
            {t === 1 && <><line x1="48" y1="26" x2="40" y2="6" stroke={borde} strokeWidth="4" strokeLinecap="round" /><circle cx="40" cy="6" r="6" fill="#ffd60a" stroke={borde} strokeWidth="3" /><line x1="72" y1="26" x2="80" y2="6" stroke={borde} strokeWidth="4" strokeLinecap="round" /><circle cx="80" cy="6" r="6" fill="#ffd60a" stroke={borde} strokeWidth="3" /></>}
            {t === 2 && <><ellipse cx="22" cy="40" rx="12" ry="18" fill={base} stroke={borde} strokeWidth="3" transform="rotate(-25 22 40)" /><ellipse cx="98" cy="40" rx="12" ry="18" fill={base} stroke={borde} strokeWidth="3" transform="rotate(25 98 40)" /></>}
            {t === 3 && <path d="M40 24 Q60 -4 80 24 Q70 14 60 18 Q50 14 40 24 Z" fill={borde} />}
            {t === 4 && <><path d="M30 34 Q14 20 22 6 Q30 22 42 26 Z" fill="#fff3c4" stroke={borde} strokeWidth="3" /><path d="M90 34 Q106 20 98 6 Q90 22 78 26 Z" fill="#fff3c4" stroke={borde} strokeWidth="3" /></>}
            {t === 5 && <><circle cx="44" cy="20" r="9" fill={base} stroke={borde} strokeWidth="3" /><circle cx="60" cy="14" r="10" fill={base} stroke={borde} strokeWidth="3" /><circle cx="76" cy="20" r="9" fill={base} stroke={borde} strokeWidth="3" /></>}
            {corona && <path d="M38 22 L42 0 L52 14 L60 -4 L68 14 L78 0 L82 22 Z" fill="#ffd60a" stroke="#b45309" strokeWidth="3" strokeLinejoin="round" />}
            {/* Brazos */}
            <path d={animo === 'feliz' ? 'M18 70 Q4 50 10 38' : 'M18 70 Q4 80 8 94'} stroke={borde} strokeWidth="9" strokeLinecap="round" fill="none" />
            <path d={animo === 'feliz' ? 'M102 70 Q116 50 110 38' : 'M102 70 Q116 80 112 94'} stroke={borde} strokeWidth="9" strokeLinecap="round" fill="none" />
            {/* Pies */}
            <ellipse cx="44" cy="112" rx="12" ry="7" fill={borde} />
            <ellipse cx="76" cy="112" rx="12" ry="7" fill={borde} />
            {/* Cuerpo */}
            <path d="M60 22 C92 22 106 46 104 74 C102 100 84 110 60 110 C36 110 18 100 16 74 C14 46 28 22 60 22 Z" fill={base} stroke={borde} strokeWidth="4" />
            <ellipse cx="60" cy="86" rx="26" ry="18" fill="#ffffff" opacity="0.28" />
            <ellipse cx="42" cy="36" rx="10" ry="5" fill="#ffffff" opacity="0.35" transform="rotate(-20 42 36)" />
            {/* Ojos */}
            {mareado ? (
                t === 3 ? <><circle cx="60" cy="54" r="16" fill="white" stroke={borde} strokeWidth="3" />{espiral(60, 54)}</>
                    : <>{espiral(44, 54)}{espiral(76, 54)}</>
            ) : feliz ? (
                // ojos sonrientes ^ ^
                t === 3 ? <path d="M46 58 Q60 40 74 58" stroke="#1f1235" strokeWidth="5" fill="none" strokeLinecap="round" />
                    : <><path d="M35 58 Q44 44 53 58" stroke="#1f1235" strokeWidth="5" fill="none" strokeLinecap="round" /><path d="M67 58 Q76 44 85 58" stroke="#1f1235" strokeWidth="5" fill="none" strokeLinecap="round" /></>
            ) : t === 3 ? (
                <><circle cx="60" cy="54" r="16" fill="white" stroke={borde} strokeWidth="3" /><circle cx="62" cy="56" r="7" fill="#1f1235" /><circle cx="64" cy="53" r="2.5" fill="white" /></>
            ) : (
                <>
                    <ellipse cx="44" cy="54" rx="11" ry="12" fill="white" stroke={borde} strokeWidth="3" />
                    <ellipse cx="76" cy="54" rx="11" ry="12" fill="white" stroke={borde} strokeWidth="3" />
                    <circle cx={animo === 'triste' ? 44 : 46} cy={animo === 'triste' ? 58 : 56} r="5.5" fill="#1f1235" />
                    <circle cx={animo === 'triste' ? 76 : 78} cy={animo === 'triste' ? 58 : 56} r="5.5" fill="#1f1235" />
                    <circle cx="48" cy="53" r="2" fill="white" /><circle cx="80" cy="53" r="2" fill="white" />
                </>
            )}
            {/* Mofletes */}
            <ellipse cx="32" cy="72" rx="7" ry="4" fill="#ff8fab" opacity={feliz ? 1 : 0.7} />
            <ellipse cx="88" cy="72" rx="7" ry="4" fill="#ff8fab" opacity={feliz ? 1 : 0.7} />
            {/* Boca */}
            {mareado
                ? <path d="M48 82 Q54 76 60 82 T72 82" stroke="#1f1235" strokeWidth="4" fill="none" strokeLinecap="round" />
                : animo === 'triste'
                    ? <path d="M46 84 Q60 72 74 84" stroke="#1f1235" strokeWidth="4" fill="none" strokeLinecap="round" />
                    : feliz
                        ? <><path d="M40 72 Q60 100 80 72 Q60 78 40 72 Z" fill="#7a1f3d" stroke="#1f1235" strokeWidth="3" strokeLinejoin="round" /><path d="M50 86 Q60 80 70 86 Q60 96 50 86 Z" fill="#ff6b8b" /></>
                        : <><path d="M44 74 Q60 90 76 74" stroke="#1f1235" strokeWidth="4" fill="none" strokeLinecap="round" /><path d="M52 78 L55 84 L58 79 Z" fill="white" /><path d="M62 79 L65 84 L68 78 Z" fill="white" /></>}
            {/* Estrellitas de mareo al borrarse · brillos de alegría */}
            {mareado && <g fill="#ffd60a" stroke="#b45309" strokeWidth="1.5">
                {[[30, 20], [60, 8], [90, 20]].map(([x, y], i) => <path key={i} d={`M${x} ${y - 7} L${x + 2} ${y - 2} L${x + 7} ${y} L${x + 2} ${y + 2} L${x} ${y + 7} L${x - 2} ${y + 2} L${x - 7} ${y} L${x - 2} ${y - 2} Z`} />)}
            </g>}
            {feliz && <g fill="#ffd60a">
                <path d="M8 20 l3 7 7 3 -7 3 -3 7 -3 -7 -7 -3 7 -3 Z" /><path d="M112 24 l2.5 6 6 2.5 -6 2.5 -2.5 6 -2.5 -6 -6 -2.5 6 -2.5 Z" />
            </g>}
        </svg>
    );
}
