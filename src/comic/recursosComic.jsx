// Recursos gráficos del Creador de cómics, todos en SVG dibujado por código
// (nada que descargar: el catálogo entero pesa unos pocos KB).
//   FONDOS:  escenas para viewBox 0 0 400 300 (se recortan con «slice» a cada viñeta).
//   OBJETOS: dibujos para viewBox 0 0 100 100.
//   PERSONAJES_PRESET: configuraciones de AvatarSVG listas para usar.

const T = '#222'; // trazo de cómic

// Pseudoaleatorio determinista (mismas estrellas/ventanas en cada render y en la exportación).
function rng(seed) {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

const Cielo = ({ u, de = '#6ec3f4', a = '#d9f1ff' }) => <>
    <defs><linearGradient id={`${u}cielo`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={de} /><stop offset="1" stopColor={a} /></linearGradient></defs>
    <rect width="400" height="300" fill={`url(#${u}cielo)`} />
</>;

const Nube = ({ x, y, s = 1, o = 1 }) => (
    <g transform={`translate(${x} ${y}) scale(${s})`} fill="white" opacity={o}>
        <ellipse cx="0" cy="0" rx="26" ry="13" /><ellipse cx="-16" cy="4" rx="16" ry="10" /><ellipse cx="17" cy="4" rx="17" ry="10" /><ellipse cx="2" cy="-8" rx="14" ry="11" />
    </g>
);

const Arbolito = ({ x, y, s = 1, copa = '#3f9b3f' }) => (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
        <rect x="-5" y="-30" width="10" height="32" fill="#8b5a2b" stroke={T} strokeWidth="1.5" />
        <circle cx="0" cy="-45" r="24" fill={copa} stroke={T} strokeWidth="1.5" />
        <circle cx="-14" cy="-34" r="14" fill={copa} stroke={T} strokeWidth="1.5" />
        <circle cx="14" cy="-34" r="14" fill={copa} stroke={T} strokeWidth="1.5" />
        <circle cx="-7" cy="-52" r="6" fill="white" opacity="0.18" />
    </g>
);

const Pino = ({ x, y, s = 1, c = '#2e7d4f', nieve = false }) => (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
        <rect x="-4" y="-12" width="8" height="14" fill="#7a4a24" />
        <path d="M0 -80 L22 -40 L12 -40 L28 -12 L-28 -12 L-12 -40 L-22 -40 Z" fill={c} stroke={T} strokeWidth="1.5" strokeLinejoin="round" />
        {nieve && <path d="M0 -80 L9 -64 Q4 -60 0 -64 Q-4 -60 -9 -64 Z M-17 -40 L-12 -40 L0 -48 L12 -40 L17 -40 Q8 -36 0 -42 Q-8 -36 -17 -40 Z" fill="white" />}
    </g>
);

const Suelo = ({ y = 230, c = '#c8925a', tablas = true }) => <>
    <rect y={y} width="400" height={300 - y} fill={c} />
    {tablas && [0, 1, 2, 3].map((i) => <line key={i} x1="0" y1={y + 12 + i * 18} x2="400" y2={y + 12 + i * 18} stroke="rgba(0,0,0,0.12)" strokeWidth="1.5" />)}
    <line x1="0" y1={y} x2="400" y2={y} stroke="rgba(0,0,0,0.25)" strokeWidth="2" />
</>;

const Ventana = ({ x, y, w, h, noche = false }) => <g>
    <rect x={x} y={y} width={w} height={h} fill={noche ? '#1e2a5a' : '#9fd8ff'} stroke="#7a4a24" strokeWidth="5" />
    {!noche && <Nube x={x + w * 0.45} y={y + h * 0.35} s={0.45} />}
    <line x1={x + w / 2} y1={y} x2={x + w / 2} y2={y + h} stroke="#7a4a24" strokeWidth="4" />
    <line x1={x} y1={y + h / 2} x2={x + w} y2={y + h / 2} stroke="#7a4a24" strokeWidth="4" />
</g>;

function Edificios({ semilla, base, colores, noche }) {
    const r = rng(semilla);
    const out = [];
    let x = -10;
    let i = 0;
    while (x < 410) {
        const w = 40 + Math.floor(r() * 35);
        const h = 70 + Math.floor(r() * 120);
        const c = colores[i % colores.length];
        out.push(<rect key={`e${i}`} x={x} y={base - h} width={w} height={h} fill={c} stroke={noche ? 'none' : T} strokeWidth="1.5" />);
        for (let wy = base - h + 10; wy < base - 14; wy += 18) {
            for (let wx = x + 7; wx < x + w - 10; wx += 13) {
                const luz = noche ? r() < 0.55 : true;
                if (luz) out.push(<rect key={`v${i}-${wx}-${wy}`} x={wx} y={wy} width="7" height="10" fill={noche ? '#ffd86b' : '#cfefff'} opacity={noche ? 0.9 : 0.85} />);
            }
        }
        x += w + 4;
        i++;
    }
    return <g>{out}</g>;
}

function Estrellas({ semilla, n = 60, alto = 300 }) {
    const r = rng(semilla);
    return <g fill="white">{Array.from({ length: n }, (_, i) => <circle key={i} cx={r() * 400} cy={r() * alto} r={0.6 + r() * 1.6} opacity={0.4 + r() * 0.6} />)}</g>;
}

function Libros({ x, y, w, semilla }) {
    const r = rng(semilla);
    const cs = ['#c0392b', '#2980b9', '#27ae60', '#f39c12', '#8e44ad', '#16a085', '#d35400', '#2c3e50'];
    const out = [];
    let bx = x;
    let i = 0;
    while (bx < x + w - 6) {
        const bw = 6 + Math.floor(r() * 7);
        const bh = 26 + Math.floor(r() * 12);
        if (bx + bw > x + w) break;
        out.push(<rect key={i} x={bx} y={y - bh} width={bw} height={bh} fill={cs[Math.floor(r() * cs.length)]} stroke={T} strokeWidth="0.8" />);
        bx += bw + 1;
        i++;
    }
    return <g>{out}</g>;
}

function Rayos({ n = 24, c1 = '#ffd32a', c2 = '#ff9f1a', cx = 200, cy = 150 }) {
    const out = [];
    for (let i = 0; i < n; i++) {
        const a1 = (i / n) * Math.PI * 2, a2 = ((i + 0.5) / n) * Math.PI * 2;
        out.push(<path key={i} d={`M${cx} ${cy} L${cx + 500 * Math.cos(a1)} ${cy + 500 * Math.sin(a1)} L${cx + 500 * Math.cos(a2)} ${cy + 500 * Math.sin(a2)} Z`} fill={c2} />);
    }
    return <><rect width="400" height="300" fill={c1} />{out}</>;
}

// ─── Fondos ──────────────────────────────────────────────────────────────────
export const FONDOS = [
    { id: 'liso', label: 'Color liso', emoji: '⬜', dibujo: () => null },
    {
        id: 'cielo', label: 'Campo', emoji: '🌤️', dibujo: ({ u }) => <>
            <Cielo u={u} />
            <circle cx="340" cy="55" r="26" fill="#ffd93b" stroke="#f4b400" strokeWidth="3" />
            <Nube x={80} y={60} /><Nube x={230} y={40} s={0.8} />
            <path d="M0 225 Q90 185 200 220 T400 210 V300 H0 Z" fill="#8fd16f" stroke={T} strokeWidth="1.5" />
            <path d="M0 250 Q120 225 260 248 T400 240 V300 H0 Z" fill="#6cbf4f" />
            {[[40, 270], [120, 285], [300, 268], [360, 290], [210, 278]].map(([x, y]) => <g key={x} transform={`translate(${x} ${y})`}><circle r="3" fill="#ff7eb6" /><circle r="1.2" fill="#ffe066" /></g>)}
        </>,
    },
    {
        id: 'aula', label: 'Aula', emoji: '🏫', dibujo: () => <>
            <rect width="400" height="300" fill="#f6e7c8" />
            <rect y="190" width="400" height="40" fill="#e9d3a8" />
            <Suelo y={230} />
            <Ventana x={18} y={45} w={72} h={95} />
            <rect x="115" y="40" width="180" height="110" fill="#2f5d50" stroke="#8b5a2b" strokeWidth="7" />
            <text x="135" y="85" fill="white" fontSize="22" fontFamily="'Comic Sans MS', cursive" opacity="0.9">2 + 3 = 5</text>
            <path d="M140 115 Q170 100 200 118 T260 112" fill="none" stroke="white" strokeWidth="2" opacity="0.6" />
            <rect x="140" y="150" width="130" height="6" fill="#8b5a2b" />
            <rect x="160" y="146" width="14" height="4" fill="white" />
            <circle cx="345" cy="70" r="24" fill="white" stroke={T} strokeWidth="3" />
            <path d="M345 70 L345 54 M345 70 L356 76" stroke={T} strokeWidth="3" strokeLinecap="round" />
            <rect x="318" y="120" width="56" height="70" fill="#5dade2" stroke={T} strokeWidth="2" />
            <path d="M325 130 h40 M325 142 h30 M325 154 h36" stroke="white" strokeWidth="3" />
        </>,
    },
    {
        id: 'patio', label: 'Colegio', emoji: '🎒', dibujo: ({ u }) => <>
            <Cielo u={u} />
            <Nube x={70} y={50} s={0.8} />
            <rect x="200" y="95" width="190" height="135" fill="#e8b07a" stroke={T} strokeWidth="2" />
            <path d="M190 98 L295 55 L400 98 Z" fill="#c0392b" stroke={T} strokeWidth="2" strokeLinejoin="round" />
            {[0, 1, 2, 3].map((c) => [0, 1].map((f) => <rect key={`${c}${f}`} x={215 + c * 44} y={112 + f * 42} width="26" height="26" fill="#cfefff" stroke={T} strokeWidth="1.5" />))}
            <rect x="277" y="190" width="36" height="40" fill="#7a4a24" stroke={T} strokeWidth="2" />
            <line x1="295" y1="55" x2="295" y2="20" stroke={T} strokeWidth="2" />
            <path d="M295 20 L322 27 L295 34 Z" fill="#f1c40f" stroke={T} strokeWidth="1" />
            <rect y="228" width="400" height="72" fill="#d9c29a" />
            <line x1="0" y1="228" x2="400" y2="228" stroke="rgba(0,0,0,0.25)" strokeWidth="2" />
            <Arbolito x={70} y={230} s={1.3} />
            {Array.from({ length: 9 }, (_, i) => <line key={i} x1={8 + i * 20} y1="200" x2={8 + i * 20} y2="230" stroke="#95a5a6" strokeWidth="3" />)}
            <line x1="0" y1="206" x2="180" y2="206" stroke="#95a5a6" strokeWidth="3" />
            <circle cx="150" cy="275" r="10" fill="white" stroke={T} strokeWidth="2" />
        </>,
    },
    {
        id: 'ciudad', label: 'Ciudad', emoji: '🏙️', dibujo: ({ u }) => <>
            <Cielo u={u} de="#86c5f0" a="#f2f9ff" />
            <Edificios semilla={7} base={232} colores={['#e17055', '#74b9ff', '#fdcb6e', '#a29bfe', '#55efc4', '#fab1a0']} />
            <rect y="230" width="400" height="20" fill="#bdc3c7" />
            <rect y="250" width="400" height="50" fill="#555" />
            {Array.from({ length: 8 }, (_, i) => <rect key={i} x={10 + i * 52} y="273" width="30" height="5" fill="white" />)}
        </>,
    },
    {
        id: 'salon', label: 'Casa', emoji: '🛋️', dibujo: () => <>
            <rect width="400" height="300" fill="#fbe3d1" />
            {Array.from({ length: 20 }, (_, i) => <rect key={i} x={i * 20} y="0" width="10" height="230" fill="#f8d5bd" />)}
            <Suelo y={230} c="#b07d4f" />
            <Ventana x={30} y={50} w={90} h={100} />
            <rect x="160" y="55" width="70" height="52" fill="#ffeaa7" stroke="#7a4a24" strokeWidth="5" />
            <path d="M170 98 L190 75 L203 88 L212 80 L222 98 Z" fill="#55a630" />
            <circle cx="210" cy="70" r="5" fill="#f39c12" />
            <path d="M250 175 Q250 150 280 150 H370 Q395 150 395 175 V215 H250 Z" fill="#6c5ce7" stroke={T} strokeWidth="2" />
            <rect x="240" y="190" width="160" height="35" rx="8" fill="#7f72ef" stroke={T} strokeWidth="2" />
            <line x1="320" y1="190" x2="320" y2="225" stroke={T} strokeWidth="1.5" />
            <line x1="150" y1="230" x2="150" y2="130" stroke={T} strokeWidth="3" />
            <path d="M132 130 L168 130 L160 108 L140 108 Z" fill="#ffd93b" stroke={T} strokeWidth="2" />
        </>,
    },
    {
        id: 'bosque', label: 'Bosque', emoji: '🌲', dibujo: ({ u }) => <>
            <Cielo u={u} de="#9ad8c9" a="#e8f8f0" />
            {[20, 70, 125, 180, 235, 290, 345, 395].map((x, i) => <Pino key={x} x={x} y={215} s={0.9 + (i % 3) * 0.15} c="#3c8d5a" />)}
            <rect y="210" width="400" height="90" fill="#6ab04c" />
            <path d="M0 210 Q100 200 200 212 T400 206" fill="none" stroke="rgba(0,0,0,0.2)" strokeWidth="2" />
            <Arbolito x={40} y={265} s={1.5} copa="#2e8b3a" />
            <Arbolito x={365} y={270} s={1.6} copa="#2e8b3a" />
            <g transform="translate(300 262)"><rect x="-3" y="-8" width="6" height="9" fill="#f5f5f5" /><path d="M-11 -7 Q0 -20 11 -7 Z" fill="#e74c3c" stroke={T} strokeWidth="1" /></g>
        </>,
    },
    {
        id: 'playa', label: 'Playa', emoji: '🏖️', dibujo: ({ u }) => <>
            <Cielo u={u} de="#5ec4f4" a="#d4f3ff" />
            <circle cx="320" cy="60" r="30" fill="#ffd93b" stroke="#f4b400" strokeWidth="3" />
            <Nube x={110} y={55} s={0.7} />
            <rect y="150" width="400" height="70" fill="#2e9ad0" />
            {[0, 1, 2].map((f) => <path key={f} d={`M0 ${165 + f * 18} q25 -8 50 0 t50 0 t50 0 t50 0 t50 0 t50 0 t50 0 t50 0`} fill="none" stroke="white" strokeWidth="2" opacity="0.5" />)}
            <path d="M0 210 Q200 195 400 212 V300 H0 Z" fill="#f4d58d" />
            <line x1="90" y1="205" x2="70" y2="290" stroke={T} strokeWidth="3" />
            <path d="M30 210 Q90 150 150 205 Q130 195 120 202 Q105 190 90 203 Q75 190 60 203 Q45 195 30 210 Z" fill="#e84393" stroke={T} strokeWidth="2" />
            <g transform="translate(330 270)"><path d="M-14 0 L14 0 L10 -14 L-10 -14 Z" fill="#e74c3c" stroke={T} strokeWidth="1.5" /><path d="M-10 -14 Q0 -24 10 -14" fill="none" stroke={T} strokeWidth="1.5" /></g>
        </>,
    },
    {
        id: 'espacio', label: 'Espacio', emoji: '🪐', dibujo: ({ u }) => <>
            <defs><radialGradient id={`${u}esp`} cx="30%" cy="30%" r="90%"><stop offset="0" stopColor="#3b2a7a" /><stop offset="1" stopColor="#0b0b2b" /></radialGradient></defs>
            <rect width="400" height="300" fill={`url(#${u}esp)`} />
            <Estrellas semilla={3} n={90} />
            <g transform="translate(300 80)">
                <circle r="34" fill="#f39c12" stroke={T} strokeWidth="2" />
                <path d="M-30 -8 Q0 -14 30 -4 M-32 8 Q0 2 32 12" stroke="#d35400" strokeWidth="5" fill="none" opacity="0.6" />
                <ellipse rx="58" ry="12" fill="none" stroke="#ffe0a3" strokeWidth="5" transform="rotate(-15)" />
            </g>
            <circle cx="70" cy="60" r="12" fill="#74b9ff" stroke={T} strokeWidth="1.5" />
            <path d="M0 240 Q100 222 200 238 T400 232 V300 H0 Z" fill="#9aa5b1" stroke={T} strokeWidth="2" />
            {[[60, 262, 14], [190, 276, 9], [300, 258, 18], [370, 285, 8]].map(([x, y, r]) => <ellipse key={x} cx={x} cy={y} rx={r} ry={r * 0.4} fill="#7f8c99" />)}
        </>,
    },
    {
        id: 'montana', label: 'Montaña', emoji: '🏔️', dibujo: ({ u }) => <>
            <Cielo u={u} de="#7ec8f5" a="#eef8ff" />
            <Nube x={70} y={45} s={0.7} />
            <path d="M-20 230 L90 70 L170 175 L240 95 L330 200 L380 140 L430 230 Z" fill="#7f8fa6" stroke={T} strokeWidth="2" strokeLinejoin="round" />
            <path d="M90 70 L112 102 L100 98 L90 110 L80 96 L68 102 Z M240 95 L262 126 L250 121 L240 132 L228 120 L218 124 Z M380 140 L396 160 L380 156 L366 162 Z" fill="white" />
            <path d="M0 225 Q120 205 220 228 T400 220 V300 H0 Z" fill="#78c35a" />
            <Pino x={40} y={262} s={0.8} /><Pino x={360} y={268} s={0.9} /><Pino x={320} y={258} s={0.65} />
        </>,
    },
    {
        id: 'laboratorio', label: 'Laboratorio', emoji: '🧪', dibujo: () => <>
            <rect width="400" height="300" fill="#e8f4f8" />
            {Array.from({ length: 11 }, (_, i) => <line key={`a${i}`} x1={i * 40} y1="0" x2={i * 40} y2="195" stroke="#c9e3ec" strokeWidth="2" />)}
            {Array.from({ length: 6 }, (_, i) => <line key={`b${i}`} x1="0" y1={i * 40} x2="400" y2={i * 40} stroke="#c9e3ec" strokeWidth="2" />)}
            <rect x="20" y="70" width="150" height="8" fill="#7f8c8d" />
            {[[35, '#e74c3c'], [65, '#2ecc71'], [95, '#3498db'], [125, '#f1c40f'], [150, '#9b59b6']].map(([x, c]) => <g key={x}><rect x={x} y="44" width="14" height="26" rx="3" fill={c} opacity="0.75" stroke={T} strokeWidth="1.2" /><rect x={x + 3} y="38" width="8" height="7" fill="#bdc3c7" stroke={T} strokeWidth="1" /></g>)}
            <rect x="0" y="195" width="400" height="40" fill="#95a5a6" stroke={T} strokeWidth="2" />
            <path d="M250 195 L250 160 L240 160 L240 150 L270 150 L270 160 L260 160 L260 170 L285 195 Z" fill="#a8e6cf" stroke={T} strokeWidth="1.5" opacity="0.9" />
            <circle cx="262" cy="182" r="3" fill="white" /><circle cx="270" cy="176" r="2" fill="white" />
            <path d="M320 195 L320 140 M312 140 h16" stroke={T} strokeWidth="2" />
            <rect x="314" y="150" width="12" height="45" rx="5" fill="#fd79a8" opacity="0.8" stroke={T} strokeWidth="1.2" />
            <circle cx="345" cy="55" r="22" fill="white" stroke={T} strokeWidth="2" />
            <text x="345" y="62" textAnchor="middle" fontSize="20" fontFamily="Arial" fontWeight="bold" fill="#e74c3c">⚛</text>
            <Suelo y={235} c="#bdc3c7" tablas={false} />
        </>,
    },
    {
        id: 'noche', label: 'Noche', emoji: '🌙', dibujo: ({ u }) => <>
            <Cielo u={u} de="#0c1445" a="#3a3f8f" />
            <Estrellas semilla={11} n={50} alto={160} />
            <circle cx="320" cy="60" r="28" fill="#fdf6c4" />
            <circle cx="333" cy="52" r="24" fill="#1a2260" />
            <Edificios semilla={21} base={250} colores={['#1c1f4a', '#262a5e', '#202452']} noche />
            <rect y="248" width="400" height="52" fill="#11132e" />
        </>,
    },
    {
        id: 'biblioteca', label: 'Biblioteca', emoji: '📚', dibujo: () => <>
            <rect width="400" height="300" fill="#a0522d" />
            {[50, 100, 150, 200].map((y) => <g key={y}><Libros x={10} y={y} w={380} semilla={y} /><rect x="0" y={y} width="400" height="7" fill="#6e3b1d" /></g>)}
            {[0, 130, 265, 395].map((x) => <rect key={x} x={x - 5} y="0" width="10" height="230" fill="#6e3b1d" />)}
            <Suelo y={230} c="#7b4a2a" />
        </>,
    },
    {
        id: 'castillo', label: 'Castillo', emoji: '🏰', dibujo: ({ u }) => <>
            <Cielo u={u} de="#8ccdf5" a="#fff3e0" />
            <Nube x={60} y={40} s={0.7} />
            <path d="M0 230 Q200 150 400 230 V300 H0 Z" fill="#7cb85a" />
            <g stroke={T} strokeWidth="2" strokeLinejoin="round">
                <rect x="150" y="105" width="100" height="85" fill="#bdc3c7" />
                <path d="M150 105 v-10 h12 v10 h14 v-10 h12 v10 h14 v-10 h12 v10 h14 v-10 h12 v10" fill="#bdc3c7" />
                <rect x="125" y="75" width="35" height="115" fill="#a4aeb5" />
                <rect x="240" y="75" width="35" height="115" fill="#a4aeb5" />
                <path d="M120 78 L142 40 L165 78 Z M235 78 L257 40 L280 78 Z" fill="#c0392b" />
                <path d="M185 190 V160 Q200 140 215 160 V190 Z" fill="#6e3b1d" />
                <rect x="137" y="105" width="10" height="16" fill="#2c3e50" /><rect x="253" y="105" width="10" height="16" fill="#2c3e50" />
            </g>
            <line x1="142" y1="40" x2="142" y2="22" stroke={T} strokeWidth="2" /><path d="M142 22 l14 5 l-14 5 Z" fill="#f1c40f" />
            <line x1="257" y1="40" x2="257" y2="22" stroke={T} strokeWidth="2" /><path d="M257 22 l14 5 l-14 5 Z" fill="#f1c40f" />
        </>,
    },
    {
        id: 'cocina', label: 'Cocina', emoji: '🍳', dibujo: () => <>
            <rect width="400" height="300" fill="#fffaf0" />
            {Array.from({ length: 10 }, (_, i) => Array.from({ length: 4 }, (_, j) => <rect key={`${i}${j}`} x={i * 40 + (j % 2 ? 20 : 0) - 20} y={110 + j * 22} width="38" height="20" fill="#d6f0ef" stroke="#b6dcda" />))}
            <Ventana x={130} y={20} w={90} h={70} />
            <rect x="0" y="190" width="300" height="45" fill="#e17055" stroke={T} strokeWidth="2" />
            <rect x="0" y="185" width="300" height="8" fill="#dfe6e9" stroke={T} strokeWidth="1.5" />
            {[40, 120, 200].map((x) => <rect key={x} x={x} y="200" width="60" height="28" fill="none" stroke="rgba(0,0,0,0.25)" strokeWidth="2" />)}
            <rect x="310" y="60" width="80" height="175" rx="6" fill="#f5f6fa" stroke={T} strokeWidth="2" />
            <line x1="310" y1="120" x2="390" y2="120" stroke={T} strokeWidth="2" /><rect x="318" y="80" width="5" height="25" fill="#95a5a6" /><rect x="318" y="135" width="5" height="30" fill="#95a5a6" />
            <path d="M60 185 v-20 h45 v20 M55 165 h55" fill="#636e72" stroke={T} strokeWidth="2" />
            <Suelo y={235} c="#dcdde1" tablas={false} />
        </>,
    },
    {
        id: 'mar', label: 'Bajo el mar', emoji: '🐠', dibujo: ({ u }) => <>
            <Cielo u={u} de="#1e90c8" a="#0b3d6b" />
            {[60, 160, 270].map((x) => <path key={x} d={`M${x} 0 L${x + 40} 0 L${x + 90} 300 L${x + 30} 300 Z`} fill="white" opacity="0.06" />)}
            <path d="M0 250 Q100 235 200 252 T400 245 V300 H0 Z" fill="#e9c98e" />
            {[[30, 1], [90, 0.8], [330, 1.2], [370, 0.9]].map(([x, k]) => <path key={x} d={`M${x} 255 q-12 ${-25 * k} 0 ${-50 * k} q12 ${-25 * k} 0 ${-55 * k}`} fill="none" stroke="#27ae60" strokeWidth="6" strokeLinecap="round" />)}
            {[[200, 90, 6], [212, 70, 4], [205, 52, 3], [120, 140, 5], [300, 120, 4]].map(([x, y, r]) => <circle key={`${x}${y}`} cx={x} cy={y} r={r} fill="none" stroke="white" strokeWidth="1.5" opacity="0.7" />)}
            <g transform="translate(270 200)"><ellipse rx="16" ry="10" fill="#ff9f43" stroke={T} strokeWidth="1.5" /><path d="M14 0 L26 -9 L26 9 Z" fill="#ff9f43" stroke={T} strokeWidth="1.5" /><circle cx="-8" cy="-2" r="2" fill={T} /></g>
            <path d="M150 262 l6 -14 l6 14 l14 -3 l-10 10 l8 12 l-14 -5 l-8 12 l-2 -14 l-14 -4 Z" fill="#ff7675" stroke={T} strokeWidth="1" />
        </>,
    },
    {
        id: 'desierto', label: 'Desierto', emoji: '🌵', dibujo: ({ u }) => <>
            <Cielo u={u} de="#ffb347" a="#ffe8b0" />
            <circle cx="300" cy="80" r="34" fill="#fff3a0" opacity="0.9" />
            <path d="M0 200 Q120 170 230 205 T400 195 V300 H0 Z" fill="#e8b96a" />
            <path d="M0 240 Q150 215 280 242 T400 235 V300 H0 Z" fill="#dda15e" />
            <g transform="translate(90 235)" fill="#4caf50" stroke={T} strokeWidth="2" strokeLinejoin="round">
                <rect x="-9" y="-70" width="18" height="72" rx="9" />
                <path d="M-9 -30 h-14 a6 6 0 0 1 -6 -6 v-18 a6 6 0 0 1 12 0 v12 h8 Z" />
                <path d="M9 -40 h12 a6 6 0 0 0 6 -6 v-14 a6 6 0 0 0 -12 0 v8 h-6 Z" />
            </g>
        </>,
    },
    {
        id: 'nieve', label: 'Nieve', emoji: '⛄', dibujo: ({ u }) => <>
            <Cielo u={u} de="#a5c9e8" a="#eef5fb" />
            <Estrellas semilla={5} n={40} />
            <path d="M0 215 Q120 195 220 218 T400 210 V300 H0 Z" fill="white" stroke="#cfdbe6" strokeWidth="2" />
            <Pino x={50} y={232} s={1.1} c="#2e7d4f" nieve /><Pino x={350} y={240} s={1.2} c="#2e7d4f" nieve /><Pino x={300} y={222} s={0.8} c="#2e7d4f" nieve />
            <g transform="translate(170 250)" stroke="#9fb3c8" strokeWidth="1.5">
                <circle r="22" fill="white" /><circle cy="-32" r="15" fill="white" />
                <circle cx="-5" cy="-35" r="2" fill={T} stroke="none" /><circle cx="5" cy="-35" r="2" fill={T} stroke="none" />
                <path d="M0 -31 L12 -29 L0 -27 Z" fill="#e67e22" stroke="none" />
            </g>
        </>,
    },
    { id: 'accion', label: 'Acción', emoji: '💥', dibujo: () => <Rayos /> },
    { id: 'accion2', label: 'Sorpresa', emoji: '🌀', dibujo: () => <Rayos n={30} c1="#74b9ff" c2="#a29bfe" /> },
];

// ─── Objetos ─────────────────────────────────────────────────────────────────
const p = { stroke: T, strokeWidth: 3, strokeLinejoin: 'round', strokeLinecap: 'round' };

export const OBJETOS = [
    { id: 'libro', label: 'Libro', dibujo: () => <g {...p}>
        <path d="M10 25 Q30 18 50 28 Q70 18 90 25 V80 Q70 73 50 83 Q30 73 10 80 Z" fill="#3498db" />
        <path d="M15 27 Q32 22 48 30 V77 Q32 70 15 75 Z M85 27 Q68 22 52 30 V77 Q68 70 85 75 Z" fill="white" strokeWidth="2" />
        <path d="M22 38 h18 M22 48 h20 M22 58 h16 M60 38 h18 M58 48 h20 M60 58 h14" strokeWidth="2" stroke="#aaa" />
    </g> },
    { id: 'balon', label: 'Balón', dibujo: () => <g {...p}>
        <circle cx="50" cy="50" r="38" fill="white" />
        <path d="M50 34 L63 43 L58 58 L42 58 L37 43 Z" fill={T} />
        <path d="M50 34 V14 M63 43 L82 37 M58 58 L70 76 M42 58 L30 76 M37 43 L18 37" fill="none" strokeWidth="2.5" />
    </g> },
    { id: 'arbol', label: 'Árbol', dibujo: () => <g {...p}>
        <rect x="43" y="55" width="14" height="38" fill="#8b5a2b" />
        <circle cx="50" cy="35" r="26" fill="#4caf50" /><circle cx="30" cy="52" r="16" fill="#4caf50" /><circle cx="70" cy="52" r="16" fill="#4caf50" />
        <circle cx="40" cy="30" r="5" fill="#e74c3c" strokeWidth="1.5" /><circle cx="62" cy="40" r="5" fill="#e74c3c" strokeWidth="1.5" />
    </g> },
    { id: 'mesa', label: 'Mesa', dibujo: () => <g {...p}>
        <rect x="8" y="40" width="84" height="10" fill="#c68652" />
        <path d="M16 50 V90 M84 50 V90" strokeWidth="7" stroke="#8b5a2b" />
        <path d="M16 50 V90 M84 50 V90" strokeWidth="3" fill="none" />
    </g> },
    { id: 'coche', label: 'Coche', dibujo: () => <g {...p}>
        <path d="M8 68 V54 Q8 48 16 47 L28 46 L38 30 H66 L78 46 L88 48 Q94 50 94 58 V68 Z" fill="#e74c3c" />
        <path d="M42 34 H52 V46 H34 Z M56 34 H64 L72 46 H56 Z" fill="#cfefff" strokeWidth="2" />
        <circle cx="27" cy="70" r="10" fill="#2d3436" /><circle cx="27" cy="70" r="4" fill="#b2bec3" strokeWidth="1.5" />
        <circle cx="75" cy="70" r="10" fill="#2d3436" /><circle cx="75" cy="70" r="4" fill="#b2bec3" strokeWidth="1.5" />
        <rect x="86" y="52" width="6" height="5" fill="#ffd93b" strokeWidth="1.5" />
    </g> },
    { id: 'movil', label: 'Móvil', dibujo: () => <g {...p}>
        <rect x="30" y="8" width="40" height="84" rx="7" fill="#2d3436" />
        <rect x="35" y="17" width="30" height="62" rx="2" fill="#74b9ff" strokeWidth="1.5" />
        <path d="M40 30 h20 M40 40 h14 M40 50 h18" stroke="white" strokeWidth="3" />
        <circle cx="50" cy="85" r="2.5" fill="#636e72" strokeWidth="1" />
    </g> },
    { id: 'ordenador', label: 'Portátil', dibujo: () => <g {...p}>
        <rect x="18" y="18" width="64" height="44" rx="3" fill="#636e72" />
        <rect x="23" y="23" width="54" height="34" fill="#55efc4" strokeWidth="1.5" />
        <path d="M30 32 l6 5 l-6 5 M40 42 h12" stroke={T} strokeWidth="2.5" fill="none" />
        <path d="M8 66 H92 L86 76 H14 Z" fill="#b2bec3" />
    </g> },
    { id: 'mochila', label: 'Mochila', dibujo: () => <g {...p}>
        <path d="M38 22 Q38 10 50 10 Q62 10 62 22" fill="none" strokeWidth="4" />
        <rect x="22" y="20" width="56" height="70" rx="16" fill="#e67e22" />
        <rect x="32" y="52" width="36" height="28" rx="6" fill="#d35400" />
        <path d="M32 62 h36" strokeWidth="2" />
    </g> },
    { id: 'lapiz', label: 'Lápiz', dibujo: () => <g {...p} transform="rotate(-35 50 50)">
        <rect x="40" y="14" width="20" height="58" fill="#fdcb6e" />
        <rect x="40" y="8" width="20" height="10" rx="3" fill="#ff7675" />
        <path d="M40 72 L50 92 L60 72 Z" fill="#f5d6b0" />
        <path d="M46 84 L50 92 L54 84 Z" fill={T} strokeWidth="1" />
    </g> },
    { id: 'bombilla', label: 'Idea', dibujo: () => <g {...p}>
        <path d="M50 12 Q76 12 76 38 Q76 52 63 62 V72 H37 V62 Q24 52 24 38 Q24 12 50 12 Z" fill="#ffe066" />
        <rect x="38" y="72" width="24" height="14" rx="3" fill="#b2bec3" />
        <path d="M42 46 L50 56 L58 46" fill="none" strokeWidth="2" />
        <path d="M50 2 V6 M14 20 L18 23 M86 20 L82 23 M8 40 H13 M92 40 H87" strokeWidth="3" stroke="#f4b400" />
    </g> },
    { id: 'interrogacion', label: '¿?', dibujo: () => <g>
        <text x="50" y="82" textAnchor="middle" fontSize="88" fontWeight="900" fontFamily="'Arial Black', Arial, sans-serif" fill="#6c5ce7" stroke={T} strokeWidth="4" paintOrder="stroke">?</text>
    </g> },
    { id: 'exclamacion', label: '¡!', dibujo: () => <g>
        <text x="50" y="84" textAnchor="middle" fontSize="88" fontWeight="900" fontFamily="'Arial Black', Arial, sans-serif" fill="#e74c3c" stroke={T} strokeWidth="4" paintOrder="stroke">!</text>
    </g> },
    { id: 'corazon', label: 'Corazón', dibujo: () => <g {...p}>
        <path d="M50 86 C14 62 8 36 26 24 Q42 15 50 32 Q58 15 74 24 C92 36 86 62 50 86 Z" fill="#ff4d6d" />
        <path d="M28 34 Q32 28 38 28" stroke="white" strokeWidth="4" fill="none" opacity="0.7" />
    </g> },
    { id: 'estrella', label: 'Estrella', dibujo: () => <g {...p}>
        <path d="M50 8 L61 36 L91 37 L67 55 L76 85 L50 68 L24 85 L33 55 L9 37 L39 36 Z" fill="#ffd32a" />
    </g> },
    { id: 'sol', label: 'Sol', dibujo: () => <g {...p}>
        {Array.from({ length: 12 }, (_, i) => { const a = (i / 12) * Math.PI * 2; return <line key={i} x1={50 + 30 * Math.cos(a)} y1={50 + 30 * Math.sin(a)} x2={50 + 44 * Math.cos(a)} y2={50 + 44 * Math.sin(a)} stroke="#f4b400" strokeWidth="5" />; })}
        <circle cx="50" cy="50" r="24" fill="#ffd93b" />
        <circle cx="42" cy="46" r="2.5" fill={T} strokeWidth="0" /><circle cx="58" cy="46" r="2.5" fill={T} strokeWidth="0" />
        <path d="M41 56 Q50 63 59 56" fill="none" strokeWidth="2.5" />
    </g> },
    { id: 'nube', label: 'Nube', dibujo: () => <g {...p}>
        <path d="M22 72 Q6 72 8 58 Q10 46 24 48 Q24 30 42 30 Q54 18 68 30 Q86 28 86 46 Q96 50 92 62 Q90 72 78 72 Z" fill="white" />
    </g> },
    { id: 'lluvia', label: 'Lluvia', dibujo: () => <g {...p}>
        <path d="M22 52 Q6 52 8 40 Q10 28 24 30 Q24 14 42 14 Q54 4 68 14 Q86 12 86 30 Q96 34 92 44 Q90 52 78 52 Z" fill="#b2bec3" />
        {[[28, 62], [46, 68], [64, 62], [36, 82], [56, 84], [74, 80]].map(([x, y]) => <path key={`${x}${y}`} d={`M${x} ${y} l-3 8`} stroke="#0984e3" strokeWidth="3.5" />)}
    </g> },
    { id: 'luna', label: 'Luna', dibujo: () => <g {...p}>
        <path d="M62 10 A40 40 0 1 0 90 66 A32 32 0 1 1 62 10 Z" fill="#fdf6c4" />
    </g> },
    { id: 'cohete', label: 'Cohete', dibujo: () => <g {...p} transform="rotate(30 50 50)">
        <path d="M50 4 Q68 22 66 62 H34 Q32 22 50 4 Z" fill="#dfe6e9" />
        <circle cx="50" cy="32" r="8" fill="#74b9ff" />
        <path d="M34 50 L20 70 L34 66 Z M66 50 L80 70 L66 66 Z" fill="#e74c3c" />
        <path d="M40 64 Q50 96 60 64 Z" fill="#ff9f43" strokeWidth="2" />
    </g> },
    { id: 'regalo', label: 'Regalo', dibujo: () => <g {...p}>
        <rect x="16" y="40" width="68" height="50" fill="#a29bfe" />
        <rect x="12" y="30" width="76" height="14" fill="#6c5ce7" />
        <rect x="45" y="30" width="10" height="60" fill="#ffd32a" strokeWidth="2" />
        <path d="M50 30 Q34 8 28 22 Q26 30 50 30 Q74 30 72 22 Q66 8 50 30 Z" fill="#ffd32a" strokeWidth="2.5" />
    </g> },
    { id: 'flor', label: 'Flor', dibujo: () => <g {...p}>
        <path d="M50 52 V94" stroke="#27ae60" strokeWidth="5" />
        <path d="M50 78 Q30 70 26 80 Q38 88 50 80" fill="#2ecc71" strokeWidth="2" />
        {Array.from({ length: 6 }, (_, i) => { const a = (i / 6) * Math.PI * 2; return <circle key={i} cx={50 + 17 * Math.cos(a)} cy={34 + 17 * Math.sin(a)} r="12" fill="#ff7eb6" strokeWidth="2.5" />; })}
        <circle cx="50" cy="34" r="10" fill="#ffd32a" strokeWidth="2.5" />
    </g> },
    { id: 'casa', label: 'Casa', dibujo: () => <g {...p}>
        <rect x="18" y="44" width="64" height="48" fill="#fab1a0" />
        <path d="M10 48 L50 12 L90 48 Z" fill="#c0392b" />
        <rect x="42" y="64" width="16" height="28" fill="#7a4a24" />
        <rect x="24" y="54" width="13" height="13" fill="#cfefff" strokeWidth="2" /><rect x="63" y="54" width="13" height="13" fill="#cfefff" strokeWidth="2" />
    </g> },
    { id: 'trofeo', label: 'Trofeo', dibujo: () => <g {...p}>
        <path d="M30 14 H70 V36 Q70 58 50 60 Q30 58 30 36 Z" fill="#f1c40f" />
        <path d="M30 20 H16 Q16 42 32 44 M70 20 H84 Q84 42 68 44" fill="none" strokeWidth="3.5" />
        <rect x="44" y="60" width="12" height="14" fill="#f1c40f" />
        <rect x="30" y="74" width="40" height="14" rx="2" fill="#8b5a2b" />
        <text x="50" y="44" textAnchor="middle" fontSize="20" fontWeight="900" fontFamily="Arial" fill={T} stroke="none">1</text>
    </g> },
    { id: 'reloj', label: 'Reloj', dibujo: () => <g {...p}>
        <circle cx="50" cy="52" r="36" fill="white" strokeWidth="5" />
        <path d="M50 52 V30 M50 52 L64 60" strokeWidth="4" />
        {[0, 1, 2, 3].map((i) => <circle key={i} cx={50 + 28 * Math.cos(i * Math.PI / 2)} cy={52 + 28 * Math.sin(i * Math.PI / 2)} r="2.5" fill={T} strokeWidth="0" />)}
        <path d="M28 18 L18 28 M72 18 L82 28" strokeWidth="5" />
    </g> },
    { id: 'pizza', label: 'Pizza', dibujo: () => <g {...p}>
        <path d="M50 92 L14 22 Q50 6 86 22 Z" fill="#fdcb6e" />
        <path d="M14 22 Q50 6 86 22 L82 30 Q50 16 18 30 Z" fill="#e1a35b" />
        {[[44, 42], [58, 50], [48, 64], [36, 34], [64, 34]].map(([x, y]) => <circle key={`${x}${y}`} cx={x} cy={y} r="6" fill="#e74c3c" strokeWidth="2" />)}
    </g> },
    { id: 'globo', label: 'Globo', dibujo: () => <g {...p}>
        <path d="M50 70 Q46 82 54 90 Q48 96 52 99" fill="none" strokeWidth="2" />
        <ellipse cx="50" cy="38" rx="27" ry="32" fill="#ff6b6b" />
        <path d="M46 70 L54 70 L50 64 Z" fill="#ff6b6b" strokeWidth="2" />
        <ellipse cx="40" cy="26" rx="6" ry="9" fill="white" opacity="0.5" stroke="none" />
    </g> },
    { id: 'planta', label: 'Maceta', dibujo: () => <g {...p}>
        <path d="M50 60 Q30 40 22 22 Q44 26 50 52 Q56 26 78 22 Q70 40 50 60 Z" fill="#2ecc71" />
        <path d="M50 60 V36" stroke="#27ae60" strokeWidth="3" />
        <path d="M28 60 H72 L66 92 H34 Z" fill="#e17055" />
        <rect x="24" y="56" width="52" height="10" rx="2" fill="#d35400" />
    </g> },
    { id: 'pelota', label: 'Pelota', dibujo: () => <g {...p}>
        <circle cx="50" cy="50" r="36" fill="#ff9f43" />
        <path d="M14 50 H86 M50 14 V86 M24 24 Q42 50 24 76 M76 24 Q58 50 76 76" fill="none" strokeWidth="2.5" />
    </g> },
];

export const fondoPorId = (id) => FONDOS.find((f) => f.id === id) || FONDOS[0];
export const objetoPorId = (id) => OBJETOS.find((o) => o.id === id) || OBJETOS[0];

// ─── Personajes listos ───────────────────────────────────────────────────────
const base = { v: 2, colorOjos: '#6b4423', ojos: 'normales', boca: 'sonrisa', accesorio: 'ninguno', fondo: '#1e3a8a', patron: 'liso' };
export const PERSONAJES_PRESET = [
    { ...base, base: 'persona', piel: '#f9c9a0', pelo: 'corto', colorPelo: '#4a2c17', ropaTipo: 'sudadera', ropa: '#2980b9' },
    { ...base, base: 'persona', piel: '#e8a878', pelo: 'coletas', colorPelo: '#1b1b1b', ropaTipo: 'camiseta', ropa: '#e84393', boca: 'dientes' },
    { ...base, base: 'persona', piel: '#8d5524', pelo: 'afro', colorPelo: '#1b1b1b', ropaTipo: 'rayas', ropa: '#f1c40f' },
    { ...base, base: 'persona', piel: '#ffe0c7', pelo: 'largo', colorPelo: '#d2a15b', ropaTipo: 'camisa', ropa: '#27ae60', accesorio: 'gafas', colorOjos: '#3b7dd8' },
    { ...base, base: 'persona', piel: '#c68652', pelo: 'pinchos', colorPelo: '#e74c3c', ropaTipo: 'heroe', ropa: '#6c5ce7', boca: 'colmillo' },
    { ...base, base: 'persona', piel: '#f9c9a0', pelo: 'moño', colorPelo: '#8b4513', ropaTipo: 'traje', ropa: '#2d3436', accesorio: 'gafas' },
    { ...base, base: 'persona', piel: '#f9c9a0', pelo: 'rapado', colorPelo: '#ecf0f1', ropaTipo: 'camisa', ropa: '#8d6e63', accesorio: 'pajarita' },
    { ...base, base: 'gato', piel: '#ff8c42', pelo: 'ninguno', colorPelo: '#4a2c17', ropaTipo: 'camiseta', ropa: '#00cec9', boca: 'gatuna' },
    { ...base, base: 'oso', piel: '#a0522d', pelo: 'ninguno', colorPelo: '#4a2c17', ropaTipo: 'sudadera', ropa: '#e74c3c' },
    { ...base, base: 'robot', piel: '#b2bec3', pelo: 'ninguno', colorPelo: '#4a2c17', ropaTipo: 'traje', ropa: '#2980b9', ojos: 'brillantes' },
    { ...base, base: 'dragon', piel: '#6ab04c', pelo: 'ninguno', colorPelo: '#4a2c17', ropaTipo: 'camiseta', ropa: '#f1c40f', boca: 'colmillo', accesorio: 'corona' },
    { ...base, base: 'alien', piel: '#a3e635', pelo: 'ninguno', colorPelo: '#4a2c17', ropaTipo: 'heroe', ropa: '#6c5ce7', accesorio: 'astronauta' },
    { ...base, base: 'pinguino', piel: '#34495e', pelo: 'ninguno', colorPelo: '#4a2c17', ropaTipo: 'traje', ropa: '#2d3436', accesorio: 'pajarita' },
    { ...base, base: 'conejo', piel: '#ffe4ec', pelo: 'ninguno', colorPelo: '#4a2c17', ropaTipo: 'rayas', ropa: '#e84393', accesorio: 'lazo' },
    { ...base, base: 'zorro', piel: '#ff7a2f', pelo: 'ninguno', colorPelo: '#4a2c17', ropaTipo: 'camisa', ropa: '#16a085', accesorio: 'mago' },
    { ...base, base: 'persona', piel: '#5c3317', pelo: 'cresta', colorPelo: '#1abc9c', ropaTipo: 'sudadera', ropa: '#2d3436', accesorio: 'auriculares' },
];

export const MOODS_COMIC = [
    { id: 'neutral', emoji: '🙂', label: 'Normal' },
    { id: 'happy', emoji: '😄', label: 'Contento' },
    { id: 'sad', emoji: '😢', label: 'Triste' },
    { id: 'angry', emoji: '😠', label: 'Enfadado' },
    { id: 'surprised', emoji: '😲', label: 'Sorprendido' },
    { id: 'sleepy', emoji: '😴', label: 'Dormido' },
];
