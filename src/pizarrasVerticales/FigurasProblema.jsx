// Figuras SVG sencillas que acompañan a algunos enunciados.
// Usan currentColor para verse bien en la vista normal (fondo claro) y en el proyector (fondo oscuro).
import React from 'react';

const Punto = ({ x, y }) => <circle cx={x} cy={y} r={7} fill="currentColor" />;

function Puntos9({ solucion }) {
    const p = [0, 1, 2];
    const c = v => 40 + v * 60; // coordenada de la cuadrícula 0..2 (3 = fuera)
    return (
        <svg viewBox="0 0 260 260" width="100%" style={{ maxWidth: 260 }}>
            {solucion && (
                <polyline
                    points={[[0, 0], [3, 0], [0, 3], [0, 0], [2, 2]].map(([x, y]) => `${c(x)},${c(y)}`).join(' ')}
                    fill="none" stroke="#ef4444" strokeWidth={5} strokeLinejoin="round" strokeLinecap="round"
                />
            )}
            {p.map(y => p.map(x => <Punto key={`${x}-${y}`} x={c(x)} y={c(y)} />))}
        </svg>
    );
}

function Cuadrado3() {
    return (
        <svg viewBox="0 0 186 186" width="100%" style={{ maxWidth: 200 }}>
            {[0, 1, 2].map(f => [0, 1, 2].map(k => (
                <rect key={`${f}-${k}`} x={3 + k * 60} y={3 + f * 60} width={60} height={60} fill="none" stroke="currentColor" strokeWidth={3} />
            )))}
        </svg>
    );
}

function Tablero() {
    return (
        <svg viewBox="0 0 166 166" width="100%" style={{ maxWidth: 220 }}>
            {Array.from({ length: 8 }).map((_, f) => Array.from({ length: 8 }).map((__, k) => (
                <rect key={`${f}-${k}`} x={3 + k * 20} y={3 + f * 20} width={20} height={20}
                    fill={(f + k) % 2 ? 'currentColor' : 'transparent'} fillOpacity={0.75} stroke="currentColor" strokeWidth={1} />
            )))}
        </svg>
    );
}

function Mesas() {
    const persona = (x, y, i) => <circle key={i} cx={x} cy={y} r={8} fill="#f59e0b" />;
    const fila = n => {
        const out = [];
        for (let i = 0; i < n; i++) {
            out.push(<rect key={`m${i}`} x={30 + i * 50} y={30} width={50} height={50} fill="none" stroke="currentColor" strokeWidth={3} />);
            out.push(persona(55 + i * 50, 16, `a${i}`));
            out.push(persona(55 + i * 50, 94, `b${i}`));
        }
        out.push(persona(16, 55, 'izq'));
        out.push(persona(44 + n * 50, 55, 'der'));
        return out;
    };
    return (
        <svg viewBox="0 0 220 110" width="100%" style={{ maxWidth: 320 }}>
            {fila(3)}
        </svg>
    );
}

function Cerillas() {
    const pal = (x1, y1, x2, y2, k) => <line key={k} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#d97706" strokeWidth={6} strokeLinecap="round" />;
    const n = 3, L = 60, x0 = 15, y0 = 15;
    const out = [];
    for (let i = 0; i < n; i++) {
        out.push(pal(x0 + i * L + 4, y0, x0 + (i + 1) * L - 4, y0, `t${i}`));
        out.push(pal(x0 + i * L + 4, y0 + L, x0 + (i + 1) * L - 4, y0 + L, `b${i}`));
    }
    for (let i = 0; i <= n; i++) out.push(pal(x0 + i * L, y0 + 4, x0 + i * L, y0 + L - 4, `v${i}`));
    return <svg viewBox="0 0 210 90" width="100%" style={{ maxWidth: 300 }}>{out}</svg>;
}

function Cuadricula() {
    const c = v => 20 + v * 50;
    return (
        <svg viewBox="0 0 210 210" width="100%" style={{ maxWidth: 230 }}>
            {[0, 1, 2, 3].map(i => (
                <g key={i}>
                    <line x1={c(0)} y1={c(i)} x2={c(3)} y2={c(i)} stroke="currentColor" strokeWidth={3} />
                    <line x1={c(i)} y1={c(0)} x2={c(i)} y2={c(3)} stroke="currentColor" strokeWidth={3} />
                </g>
            ))}
            <text x={c(0) - 4} y={c(3) + 4} fontSize={22} textAnchor="end" dominantBaseline="hanging">🏠</text>
            <text x={c(3) + 2} y={c(0) - 2} fontSize={22}>🏫</text>
            <polyline points={`${c(0)},${c(3)} ${c(1)},${c(3)} ${c(1)},${c(1)} ${c(3)},${c(1)} ${c(3)},${c(0)}`}
                fill="none" stroke="#10b981" strokeWidth={5} strokeLinejoin="round" opacity={0.85} />
        </svg>
    );
}

const FIGURAS = {
    puntos9: () => <Puntos9 />,
    puntos9sol: () => <Puntos9 solucion />,
    cuadrado3: () => <Cuadrado3 />,
    tablero: () => <Tablero />,
    mesas: () => <Mesas />,
    cerillas: () => <Cerillas />,
    cuadricula: () => <Cuadricula />,
};

export default function FiguraProblema({ id, color }) {
    const F = FIGURAS[id];
    if (!F) return null;
    return <div style={{ color: color || 'inherit', display: 'flex', justifyContent: 'center', margin: '10px 0' }}><F /></div>;
}
