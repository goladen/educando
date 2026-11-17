// Manipulaciones para comprobar algunos problemas del Canguro (canguro2026.js → campo «interactivo»).
import React, { useState, useEffect, useRef } from 'react';
import { sonidoCorrecto } from '../utils/sonidosFeedback';

const btn = (bg, color = 'white', extra = {}) => ({
    background: bg, color, border: 'none', borderRadius: 10, padding: '8px 13px', fontWeight: 700,
    cursor: 'pointer', fontSize: '0.9rem', fontFamily: 'inherit', ...extra,
});
const off = '#cbd5e1';
const exito = () => { try { sonidoCorrecto(); } catch { /* sin audio */ } };
const Ok = ({ children }) => <div style={{ background: '#dcfce7', color: '#166534', borderRadius: 10, padding: '8px 12px', fontWeight: 800, marginTop: 8 }}>{children}</div>;
const Nota = ({ children }) => <div style={{ fontSize: '0.85rem', opacity: 0.8, marginBottom: 8 }}>{children}</div>;

// ─────────── 1 · Botones de giro y simetría ───────────
const mult = (A, B) => [A[0] * B[0] + A[1] * B[2], A[0] * B[1] + A[1] * B[3], A[2] * B[0] + A[3] * B[2], A[2] * B[1] + A[3] * B[3]];
const GIRO = [0, 1, -1, 0];   // (x, y) → (y, −x): 90° horario
const SIMX = [1, 0, 0, -1];   // (x, y) → (x, −y)
const ID = [1, 0, 0, 1];

function Cara({ M, fantasma, color }) {
    const [a, b, c, d] = M;
    return (
        <g transform={`matrix(${a} ${c} ${b} ${d} 0 0)`} opacity={fantasma ? 0.35 : 1}>
            <g transform="translate(-2 1.6)">
                <circle r="0.8" fill={fantasma ? 'none' : '#facc15'} stroke={color} strokeWidth="0.07" strokeDasharray={fantasma ? '0.15 0.12' : undefined} />
                <circle cx="-0.28" cy="0.2" r="0.17" fill="white" stroke={color} strokeWidth="0.05" />
                <circle cx="0.28" cy="0.2" r="0.17" fill="white" stroke={color} strokeWidth="0.05" />
                <circle cx="-0.24" cy="0.2" r="0.07" fill={color} />
                <circle cx="0.32" cy="0.2" r="0.07" fill={color} />
                <path d="M -0.38 -0.22 Q 0 -0.62 0.38 -0.22" fill="none" stroke={color} strokeWidth="0.07" strokeLinecap="round" />
                <path d="M -0.15 0.75 L 0 1.05 L 0.15 0.75" fill="#ef4444" stroke={color} strokeWidth="0.04" />
            </g>
        </g>
    );
}

function Botones() {
    const [hist, setHist] = useState([]);
    const M = hist.reduce((acc, h) => mult(h === 'G' ? GIRO : SIMX, acc), ID);
    const logrado = M.join() === [-1, 0, 0, 1].join();
    const avisado = useRef(false);
    useEffect(() => { if (logrado && !avisado.current) { avisado.current = true; exito(); } if (!logrado) avisado.current = false; }, [logrado]);
    return (
        <div>
            <Nota>Pulsa los botones y lleva el rostro hasta la silueta punteada. (Le hemos puesto un gorrito rojo para ver hacia dónde mira.)</Nota>
            <svg viewBox="-4 -4 8 8" style={{ width: '100%', maxWidth: 340, display: 'block', margin: '0 auto', background: 'white', borderRadius: 12 }}>
                <g transform="scale(1 -1)">
                    <line x1="-3.8" y1="0" x2="3.8" y2="0" stroke="#334155" strokeWidth="0.05" />
                    <line x1="0" y1="-3.8" x2="0" y2="3.8" stroke="#334155" strokeWidth="0.05" />
                    <Cara M={[-1, 0, 0, 1]} fantasma color="#64748b" />
                    <Cara M={M} color="#1f2937" />
                </g>
                <text x="3.5" y="-0.2" fontSize="0.45" fill="#334155">x</text>
                <text x="0.2" y="-3.5" fontSize="0.45" fill="#334155">y</text>
            </svg>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap', marginTop: 10 }}>
                <button onClick={() => setHist(h => [...h, 'G'])} style={btn('#be123c')}>↻ Girar 90° (horario)</button>
                <button onClick={() => setHist(h => [...h, 'S'])} style={btn('#be123c')}>↕ Simetría eje X</button>
                <button onClick={() => setHist(h => h.slice(0, -1))} disabled={!hist.length} style={btn(hist.length ? '#f59e0b' : off)}>↶</button>
                <button onClick={() => setHist([])} style={btn('#94a3b8')}>↺</button>
            </div>
            <div style={{ textAlign: 'center', marginTop: 8, fontWeight: 700 }}>
                Pulsaciones: {hist.length} {hist.length > 0 && <span style={{ opacity: 0.7, fontWeight: 400 }}>({hist.map(h => (h === 'G' ? '↻' : '↕')).join(' ')})</span>}
            </div>
            {logrado && <Ok>✅ ¡Conseguido con {hist.length} pulsaciones! ¿Se puede con menos?</Ok>}
        </div>
    );
}

// ─────────── 2 · Canicas en círculo ───────────
function Canicas() {
    const N = 7;
    const [rojas, setRojas] = useState([]);
    const [formas, setFormas] = useState([]); // distancias encontradas
    const [msg, setMsg] = useState('');
    const toca = i => {
        setMsg('');
        setRojas(r => (r.includes(i) ? r.filter(x => x !== i) : r.length < 2 ? [...r, i] : [r[1], i]));
    };
    const guardar = () => {
        if (rojas.length < 2) { setMsg('Coloca las 2 canicas rojas.'); return; }
        const d0 = Math.abs(rojas[0] - rojas[1]);
        const d = Math.min(d0, N - d0); // blancas entre ellas por el lado corto = d − 1
        if (d === 1) { setMsg('❌ Las rojas están juntas: no vale.'); return; }
        if (formas.includes(d)) { setMsg('🔁 Esa ya la tenías: es la misma forma girada (o dada la vuelta).'); return; }
        setFormas(f => [...f, d].sort()); setMsg('✅ ¡Forma nueva!'); exito();
    };
    const pos = i => [50 + 36 * Math.sin((2 * Math.PI * i) / N), 50 - 36 * Math.cos((2 * Math.PI * i) / N)];
    const Mini = ({ d }) => (
        <svg viewBox="0 0 100 100" style={{ width: 70 }}>
            {[...Array(N)].map((_, i) => { const [x, y] = pos(i); return <circle key={i} cx={x} cy={y} r="9" fill={i === 0 || i === d ? '#dc2626' : 'white'} stroke="#334155" strokeWidth="2" />; })}
        </svg>
    );
    return (
        <div>
            <Nota>Toca dos huecos para poner las canicas rojas y pulsa «Comprobar». Dos colocaciones son la misma si una es la otra girada.</Nota>
            <svg viewBox="0 0 100 100" style={{ width: '100%', maxWidth: 280, display: 'block', margin: '0 auto' }}>
                <circle cx="50" cy="50" r="36" fill="none" stroke="#e2e8f0" strokeWidth="1.5" />
                {[...Array(N)].map((_, i) => {
                    const [x, y] = pos(i);
                    return <circle key={i} cx={x} cy={y} r="9" onClick={() => toca(i)} style={{ cursor: 'pointer' }}
                        fill={rojas.includes(i) ? '#dc2626' : 'white'} stroke="#334155" strokeWidth="2" />;
                })}
            </svg>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 8 }}>
                <button onClick={guardar} style={btn('#16a34a')}>✔ Comprobar</button>
                <button onClick={() => { setRojas([]); setFormas([]); setMsg(''); }} style={btn('#94a3b8')}>↺ Empezar</button>
            </div>
            {msg && <div style={{ textAlign: 'center', marginTop: 6, fontWeight: 700 }}>{msg}</div>}
            <div style={{ marginTop: 10, fontWeight: 800 }}>Formas distintas encontradas: {formas.length}</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>{formas.map(d => <Mini key={d} d={d} />)}</div>
        </div>
    );
}

// ─────────── 15 · Llaves y cerraduras ───────────
const PERMS = [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]];
const COLK = ['#dc2626', '#2563eb', '#16a34a'];
function Llaves() {
    const [perm, setPerm] = useState([2, 0, 1]);
    const [tabla, setTabla] = useState(null);
    const [verTodas, setVerTodas] = useState(false);
    const abiertas = p => p.filter((k, i) => k === i).length;
    const azar = () => setPerm(PERMS[Math.floor(Math.random() * 6)]);
    const mil = () => {
        const t = [0, 0, 0, 0];
        for (let i = 0; i < 1000; i++) t[abiertas(PERMS[Math.floor(Math.random() * 6)])]++;
        setTabla(t);
    };
    const Fila = ({ p }) => (
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            {p.map((k, i) => (
                <div key={i} style={{ textAlign: 'center', border: `3px solid ${COLK[i]}`, borderRadius: 10, padding: '4px 10px', background: k === i ? '#dcfce7' : 'white' }}>
                    <div style={{ fontSize: '1.4rem' }}>{k === i ? '🔓' : '🔒'}</div>
                    <div style={{ color: COLK[k], fontWeight: 900 }}>🔑</div>
                </div>
            ))}
            <b>{abiertas(p)} abierta{abiertas(p) === 1 ? '' : 's'}</b>
        </div>
    );
    return (
        <div>
            <Nota>Cada cerradura (borde de color) se abre con la llave de su mismo color.</Nota>
            <Fila p={perm} />
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
                <button onClick={azar} style={btn('#2563eb')}>🎲 Colocar al azar</button>
                <button onClick={mil} style={btn('#7c3aed')}>🔁 Probar 1000 veces</button>
                <button onClick={() => setVerTodas(v => !v)} style={btn('#64748b')}>{verTodas ? 'Ocultar' : 'Ver'} las 6 formas</button>
            </div>
            {tabla && (
                <table style={{ marginTop: 10, borderCollapse: 'collapse' }}>
                    <tbody>{tabla.map((v, i) => (
                        <tr key={i}><td style={{ padding: '2px 10px' }}>{i} abiertas</td><td style={{ padding: '2px 10px', fontWeight: 800, color: v === 0 ? '#dc2626' : undefined }}>{v} veces</td></tr>
                    ))}</tbody>
                </table>
            )}
            {verTodas && <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 10 }}>{PERMS.map((p, i) => <Fila key={i} p={p} />)}</div>}
        </div>
    );
}

// ─────────── 23 · Dado rodando ───────────
const DADO0 = { arriba: 'M', delante: 'K', dcha: '6', abajo: '2', detras: '0', izq: '2' };
const rodar = (d, dir) => {
    if (dir === 'delante') return { ...d, arriba: d.detras, delante: d.arriba, abajo: d.delante, detras: d.abajo };
    if (dir === 'atras') return { ...d, arriba: d.delante, detras: d.arriba, abajo: d.detras, delante: d.abajo };
    if (dir === 'dcha') return { ...d, arriba: d.izq, dcha: d.arriba, abajo: d.dcha, izq: d.abajo };
    return { ...d, arriba: d.dcha, izq: d.arriba, abajo: d.izq, dcha: d.abajo };
};
const RUTA = ['delante', 'dcha', 'dcha', 'atras', 'izq'];
const MOV = { delante: [1, 0], atras: [-1, 0], dcha: [0, 1], izq: [0, -1] };
const FLECHA = { delante: '↓', atras: '↑', dcha: '→', izq: '←' };

function Dado() {
    const [hist, setHist] = useState([]);
    const dado = hist.reduce(rodar, DADO0);
    const casilla = hist.reduce(([f, c], m) => [f + MOV[m][0], c + MOV[m][1]], [0, 0]);
    const paso = hist.length;
    const sigue = paso < RUTA.length && hist.every((m, i) => m === RUTA[i]);
    const libre = !hist.every((m, i) => m === RUTA[i]);
    const fin = !libre && paso === RUTA.length;
    const avisado = useRef(false);
    useEffect(() => { if (fin && !avisado.current) { avisado.current = true; exito(); } if (!fin) avisado.current = false; }, [fin]);
    const mover = m => { const [f, c] = [casilla[0] + MOV[m][0], casilla[1] + MOV[m][1]]; if (f < 0 || f > 1 || c < 0 || c > 2) return; setHist(h => [...h, m]); };
    const cara = (txt, extra) => <div style={{ width: 54, height: 54, border: '2px solid #334155', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: '1.4rem', background: '#fde047', color: '#1f2937', ...extra }}>{txt}</div>;
    const vacio = <div style={{ width: 54, height: 54 }} />;
    return (
        <div>
            <Nota>Cuadrícula vista desde arriba (la fila de abajo es la más cercana a ti). Las flechas grises marcan el recorrido.</Nota>
            <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 70px)', gap: 4 }}>
                    {[0, 1].map(f => [0, 1, 2].map(c => {
                        const aqui = casilla[0] === f && casilla[1] === c;
                        const idx = [[0, 0], [1, 0], [1, 1], [1, 2], [0, 2], [0, 1]].findIndex(([a, b]) => a === f && b === c);
                        return (
                            <div key={`${f}${c}`} style={{ width: 70, height: 70, border: '2px solid #64748b', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', background: aqui ? '#fde047' : 'white', position: 'relative' }}>
                                {aqui ? <b style={{ fontSize: '1.8rem', color: '#1f2937' }}>{dado.arriba}</b> : <span style={{ color: '#94a3b8', fontSize: '1.3rem' }}>{idx < 5 ? FLECHA[RUTA[idx]] : '🏁'}</span>}
                                <span style={{ position: 'absolute', top: 2, left: 5, fontSize: '0.7rem', color: '#94a3b8' }}>{idx + 1}</span>
                            </div>
                        );
                    }))}
                </div>
                {/* desarrollo del dado: arriba en el centro */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 54px)', gap: 2, color: '#1f2937' }}>
                    {vacio}{cara(dado.detras, { opacity: 0.6 })}{vacio}{vacio}
                    {cara(dado.izq, { opacity: 0.6 })}{cara(dado.arriba, { background: '#f59e0b' })}{cara(dado.dcha, { opacity: 0.6 })}{cara(dado.abajo, { opacity: 0.35 })}
                    {vacio}{cara(dado.delante, { opacity: 0.6 })}{vacio}{vacio}
                    <div style={{ gridColumn: '1 / 5', fontSize: '0.75rem', opacity: 0.75 }}>Naranja: arriba · a la derecha del todo: abajo</div>
                </div>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap', marginTop: 10 }}>
                <button onClick={() => setHist(h => [...h, RUTA[h.length]])} disabled={!sigue} style={btn(sigue ? '#16a34a' : off)}>▶ Siguiente paso del recorrido</button>
                {['atras', 'izq', 'dcha', 'delante'].map(m => <button key={m} onClick={() => mover(m)} style={btn('#475569', 'white', { padding: '8px 12px' })}>{FLECHA[m]}</button>)}
                <button onClick={() => setHist(h => h.slice(0, -1))} disabled={!hist.length} style={btn(hist.length ? '#f59e0b' : off)}>↶</button>
                <button onClick={() => setHist([])} style={btn('#94a3b8')}>↺</button>
            </div>
            {fin && <Ok>🏁 Fin del recorrido: arriba queda «{dado.arriba}».</Ok>}
        </div>
    );
}

// ─────────── 28 · Pantalla 2026 ───────────
const sumaCifras = n => String(Math.abs(n)).split('').reduce((s, c) => s + Number(c), 0);
const OBJ28 = [2022, 5037, 12345, 2223];
function Pantalla() {
    const [hist, setHist] = useState([2026]);
    const [verResto, setVerResto] = useState(false);
    const n = hist[hist.length - 1];
    const s = sumaCifras(n);
    const vistos = OBJ28.filter(o => hist.slice(1).includes(o));
    return (
        <div>
            <Nota>Suma o resta la suma de las cifras e intenta llegar a 2022, 5037, 12345 o 2223.</Nota>
            <div style={{ background: '#0f172a', color: '#4ade80', fontFamily: 'monospace', fontSize: '2.6rem', fontWeight: 900, textAlign: 'center', borderRadius: 12, padding: '10px 0' }}>
                {n}{verResto && <span style={{ fontSize: '1rem', color: '#facc15' }}> (resto ÷9: {n % 9})</span>}
            </div>
            <div style={{ textAlign: 'center', margin: '6px 0' }}>Suma de cifras: <b>{s}</b></div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
                <button onClick={() => setHist(h => [...h, n + s])} style={btn('#16a34a')}>+ {s}</button>
                <button onClick={() => setHist(h => [...h, n - s])} disabled={n - s < 0} style={btn(n - s < 0 ? off : '#dc2626')}>− {s}</button>
                <button onClick={() => setHist(h => (h.length > 1 ? h.slice(0, -1) : h))} style={btn('#f59e0b')}>↶</button>
                <button onClick={() => setHist([2026])} style={btn('#94a3b8')}>↺</button>
                <label style={{ alignSelf: 'center', fontSize: '0.85rem' }}><input type="checkbox" checked={verResto} onChange={e => setVerResto(e.target.checked)} /> Ver resto entre 9</label>
            </div>
            {vistos.length > 0 && <Ok>¡Ha aparecido {vistos.join(', ')}!</Ok>}
            <div style={{ marginTop: 8, fontFamily: 'monospace', fontSize: '0.85rem', opacity: 0.8, wordBreak: 'break-word' }}>
                {hist.map((v, i) => <span key={i}>{i ? ' → ' : ''}{v}{verResto ? `·${v % 9}` : ''}</span>)}
            </div>
        </div>
    );
}

// ─────────── 30 · Corro de 13 niños ───────────
function Corro() {
    const [n, setN] = useState(13);
    const [k, setK] = useState(13);
    const [inicio, setInicio] = useState(1);
    const [estado, setEstado] = useState(null); // { vivos, idx, fuera:[], cuenta, actual }
    const timer = useRef(null);
    useEffect(() => () => clearInterval(timer.current), []);
    const reset = () => { clearInterval(timer.current); setEstado(null); };
    const empezar = () => {
        reset();
        const vivos = [...Array(n)].map((_, i) => ((inicio - 1 + i) % n) + 1);
        let st = { vivos, idx: 0, fuera: [], cuenta: 0, actual: vivos[0] };
        setEstado(st);
        timer.current = setInterval(() => {
            st = { ...st };
            if (st.vivos.length <= 1) { clearInterval(timer.current); return; }
            st.cuenta += 1; st.actual = st.vivos[st.idx];
            if (st.cuenta === k) {
                st.fuera = [...st.fuera, st.actual];
                st.vivos = st.vivos.filter((_, i) => i !== st.idx);
                st.idx = st.idx % st.vivos.length; st.cuenta = 0;
                if (st.vivos.length === 1) { clearInterval(timer.current); if (st.vivos[0] === 1) exito(); }
            } else st.idx = (st.idx + 1) % st.vivos.length;
            setEstado(st);
        }, 90);
    };
    const pos = i => [50 + 40 * Math.sin((2 * Math.PI * i) / n), 50 - 40 * Math.cos((2 * Math.PI * i) / n)];
    const ganador = estado && estado.vivos.length === 1 ? estado.vivos[0] : null;
    return (
        <div>
            <Nota>Elige por qué niño se empieza (tocándolo) y pulsa «Jugar». Mateo es el 1.</Nota>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 8, fontSize: '0.9rem' }}>
                <label>Niños <input type="number" min={2} max={30} value={n} onChange={e => { reset(); const v = Math.max(2, Math.min(30, Number(e.target.value) || 13)); setN(v); setInicio(1); }} style={{ width: 54 }} /></label>
                <label>Sale el que dice <input type="number" min={1} max={50} value={k} onChange={e => { reset(); setK(Math.max(1, Math.min(50, Number(e.target.value) || 13))); }} style={{ width: 54 }} /></label>
                <span>Empieza: <b>{inicio}</b></span>
            </div>
            <svg viewBox="0 0 100 100" style={{ width: '100%', maxWidth: 320, display: 'block', margin: '0 auto' }}>
                {[...Array(n)].map((_, i) => {
                    const num = i + 1; const [x, y] = pos(i);
                    const fuera = estado?.fuera.includes(num);
                    const act = estado && estado.actual === num && !ganador;
                    return (
                        <g key={num} onClick={() => { reset(); setInicio(num); }} style={{ cursor: 'pointer' }}>
                            <circle cx={x} cy={y} r="6" fill={ganador === num ? '#16a34a' : fuera ? '#e2e8f0' : act ? '#facc15' : num === inicio ? '#bfdbfe' : 'white'} stroke={num === 1 ? '#dc2626' : '#2563eb'} strokeWidth={num === 1 ? 1.6 : 1} />
                            <text x={x} y={y + 2.2} textAnchor="middle" fontSize="6" fontWeight="700" fill={fuera ? '#94a3b8' : '#1f2937'}>{num}</text>
                        </g>
                    );
                })}
                {estado && !ganador && <text x="50" y="53" textAnchor="middle" fontSize="10" fontWeight="900" fill="#1f2937">{estado.cuenta || ''}</text>}
            </svg>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 8 }}>
                <button onClick={empezar} style={btn('#16a34a')}>▶ Jugar</button>
                <button onClick={reset} style={btn('#94a3b8')}>↺</button>
            </div>
            {estado && estado.fuera.length > 0 && <div style={{ fontSize: '0.85rem', marginTop: 6 }}>Salen: {estado.fuera.join(', ')}</div>}
            {ganador != null && (ganador === 1 ? <Ok>🏆 ¡Queda Mateo! Hay que empezar por el {inicio}.</Ok> : <div style={{ marginTop: 6, fontWeight: 800 }}>Queda el niño {ganador}.</div>)}
        </div>
    );
}

export const INTERACTIVOS = {
    botones: { titulo: 'Prueba los botones', Comp: Botones },
    canicas: { titulo: 'Coloca las canicas', Comp: Canicas },
    llaves: { titulo: 'Prueba las llaves', Comp: Llaves },
    dado: { titulo: 'Haz rodar el dado', Comp: Dado },
    pantalla: { titulo: 'Juega con la pantalla', Comp: Pantalla },
    corro: { titulo: 'Simula el corro', Comp: Corro },
};
