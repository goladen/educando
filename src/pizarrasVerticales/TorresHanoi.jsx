// Torres de Hanói (Pizarras verticales · pestaña «Juegos, retos y acertijos», JuegosMagia.jsx).
// Incluye paneles «Potencias de 2» (2ⁿ − 1, recurrencia, binario) y «Busca el algoritmo» (pistas + iterativo y recursivo),
// y 🤖 «Siguiente movimiento» (óptimo desde cualquier posición).
// Tocar una torre coge su disco de arriba; tocar otra lo deja (nunca sobre uno más pequeño).
// Contador de movimientos frente al mínimo 2ⁿ − 1, deshacer, solución animada y notas para el profesor.
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { sonidoCorrecto, sonidoIncorrecto } from '../utils/sonidosFeedback';
import { guardarRegistroLocal } from '../utils/registrosLocales';

const COLORES = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899', '#64748b', '#0f766e'];
const NOMBRES = ['A', 'B', 'C'];
const btn = (bg, color = 'white', extra = {}) => ({
    background: bg, color, border: 'none', borderRadius: 10, padding: '9px 14px', fontWeight: 700,
    cursor: 'pointer', fontSize: '0.9rem', fontFamily: 'inherit', ...extra,
});
const inicial = n => [Array.from({ length: n }, (_, i) => n - i), [], []];
const solucion = (n, de = 0, a = 2, aux = 1, out = []) => {
    if (n === 0) return out;
    solucion(n - 1, de, aux, a, out);
    out.push([de, a]);
    solucion(n - 1, aux, a, de, out);
    return out;
};
const fmt = s => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
const LS_MEJORES = 'pv_hanoi_mejores_v1';
const leerMejores = () => { try { return JSON.parse(localStorage.getItem(LS_MEJORES)) || {}; } catch { return {}; } };

// Siguiente movimiento óptimo para llevar TODOS los discos a la torre C desde cualquier posición.
// Para colocar el disco k en la torre t: si ya está, basta con colocar los k−1 menores en t; si no,
// hay que llevar los k−1 menores a la torre que queda libre, mover k a t y volver a colocar los k−1 encima.
function siguienteOptimo(torres, n) {
    const pos = {};
    torres.forEach((t, i) => t.forEach(d => { pos[d] = i; }));
    const sig = (k, t) => {
        if (k === 0) return null;
        if (pos[k] === t) return sig(k - 1, t);
        const otra = 3 - pos[k] - t;
        return sig(k - 1, otra) || [pos[k], t];
    };
    return sig(n, 2);
}
// En la solución óptima desde el principio, en el movimiento m se mueve el disco (nº de ceros finales de m en binario) + 1.
const discoDelPaso = m => { let k = 1; while (m % 2 === 0) { m /= 2; k++; } return k; };
const sup = { fontSize: '0.75em', verticalAlign: 'super' };
const caja = { background: 'white', borderRadius: 14, padding: '12px 16px', marginTop: 12, lineHeight: 1.55, fontSize: '0.93rem', color: '#1f2937' };

function PanelPotencias({ n, mejores }) {
    const [verMin, setVerMin] = useState(false);
    const [verPorque, setVerPorque] = useState(false);
    const filas = [1, 2, 3, 4, 5, 6, 7, 8];
    const pasos = Array.from({ length: Math.min(2 ** n - 1, 31) }, (_, i) => i + 1);
    const td = { border: '1px solid #e2e8f0', padding: '4px 10px', textAlign: 'center' };
    return (
        <div style={{ ...caja, borderLeft: '5px solid #0891b2' }}>
            <b style={{ fontSize: '1.05rem' }}>🔢 ¿Qué tienen que ver las potencias de 2?</b>
            <p style={{ margin: '6px 0' }}>Jugad con 1, 2, 3, 4… discos y apuntad el menor número de movimientos que conseguís. Vuestros mejores resultados se guardan en la tabla. ¿Veis algún patrón?</p>
            <div style={{ overflowX: 'auto' }}>
                <table style={{ borderCollapse: 'collapse', margin: '6px 0' }}>
                    <tbody>
                        <tr><td style={{ ...td, fontWeight: 800, textAlign: 'left' }}>Discos</td>{filas.map(k => <td key={k} style={{ ...td, fontWeight: 800 }}>{k}</td>)}</tr>
                        <tr><td style={{ ...td, fontWeight: 800, textAlign: 'left' }}>Vuestro récord</td>{filas.map(k => <td key={k} style={{ ...td, color: mejores[k] === 2 ** k - 1 ? '#16a34a' : undefined, fontWeight: 700 }}>{mejores[k] ?? '—'}</td>)}</tr>
                        {verMin && <tr><td style={{ ...td, fontWeight: 800, textAlign: 'left' }}>Mínimo</td>{filas.map(k => <td key={k} style={td}>{2 ** k - 1}</td>)}</tr>}
                        {verMin && <tr><td style={{ ...td, fontWeight: 800, textAlign: 'left' }}>Mínimo + 1</td>{filas.map(k => <td key={k} style={{ ...td, color: '#0891b2', fontWeight: 800 }}>2<span style={sup}>{k}</span> = {2 ** k}</td>)}</tr>}
                    </tbody>
                </table>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '6px 0' }}>
                <button onClick={() => setVerMin(v => !v)} style={btn('#0891b2')}>{verMin ? 'Ocultar' : 'Mostrar'} los mínimos</button>
                <button onClick={() => setVerPorque(v => !v)} style={btn('#0e7490')}>{verPorque ? 'Ocultar la explicación' : <>¿Por qué 2<span style={sup}>n</span> − 1?</>}</button>
            </div>
            {verPorque && (
                <div>
                    <p style={{ margin: '8px 0 4px' }}><b>1. Cada torre se apoya en la anterior.</b> Para mover n discos, antes hay que quitar de encima los n − 1 de arriba (M<sub>n−1</sub> movimientos), mover el disco grande (1 movimiento) y volver a poner los n − 1 encima (otros M<sub>n−1</sub>):</p>
                    <p style={{ textAlign: 'center', fontWeight: 800, fontSize: '1.1rem', margin: '4px 0' }}>M<sub>n</sub> = 2 · M<sub>n−1</sub> + 1</p>
                    <p style={{ margin: '4px 0' }}><b>2. Sumando 1 todo se duplica.</b> M<sub>n</sub> + 1 = 2 · (M<sub>n−1</sub> + 1). Como M<sub>1</sub> + 1 = 2, cada disco nuevo duplica: 2, 4, 8, 16… es decir, M<sub>n</sub> + 1 = 2<span style={sup}>n</span> y <b>M<sub>n</sub> = 2<span style={sup}>n</span> − 1</b>.</p>
                    <p style={{ margin: '4px 0' }}><b>3. Contando disco a disco.</b> El disco grande se mueve 1 vez, el siguiente 2, el siguiente 4… el más pequeño 2<span style={sup}>n−1</span> veces. En total 1 + 2 + 4 + … + 2<span style={sup}>n−1</span> = 2<span style={sup}>n</span> − 1 (en binario es 111…1, con n unos).</p>
                    <p style={{ margin: '8px 0 4px' }}><b>4. El binario esconde la solución.</b> Numera los movimientos 1, 2, 3… y escríbelos en binario: en el movimiento m se mueve el disco que indica el número de ceros del final + 1. Con {n} discos:</p>
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                            <tbody>
                                <tr><td style={{ ...td, fontWeight: 800 }}>Movimiento</td>{pasos.map(m => <td key={m} style={td}>{m}</td>)}</tr>
                                <tr><td style={{ ...td, fontWeight: 800 }}>Binario</td>{pasos.map(m => <td key={m} style={{ ...td, fontFamily: 'monospace' }}>{m.toString(2)}</td>)}</tr>
                                <tr><td style={{ ...td, fontWeight: 800 }}>Disco</td>{pasos.map(m => <td key={m} style={{ ...td, fontWeight: 800, color: 'white', background: COLORES[(discoDelPaso(m) - 1) % COLORES.length] }}>{discoDelPaso(m)}</td>)}</tr>
                            </tbody>
                        </table>
                    </div>
                    {2 ** n - 1 > 31 && <div style={{ fontSize: '0.8rem', opacity: 0.7 }}>(Se muestran los 31 primeros de {2 ** n - 1}).</div>}
                    <p style={{ margin: '8px 0 0' }}>Fíjate: el disco 1 se mueve en los impares, el 2 cada 4 empezando en el 2, el 3 cada 8… igual que las cifras de una cuenta en binario.</p>
                </div>
            )}
        </div>
    );
}

const PISTAS_ALGORITMO = [
    'Fíjate solo en el disco más pequeño. ¿Cada cuánto se mueve en la solución? ¿Hacia qué torre va siempre?',
    'El disco pequeño se mueve uno de cada dos movimientos, y siempre gira en el mismo sentido (como las agujas del reloj o al revés).',
    'Cuando no toca mover el pequeño, ¿cuántos movimientos posibles hay que no usen el disco pequeño? (Solo hay uno).',
    'El sentido depende de si el número de discos es par o impar. Probad con 3 y con 4 discos para descubrirlo.',
];

function PanelAlgoritmo() {
    const [pistas, setPistas] = useState(0);
    const [verAlg, setVerAlg] = useState(false);
    return (
        <div style={{ ...caja, borderLeft: '5px solid #16a34a' }}>
            <b style={{ fontSize: '1.05rem' }}>🧩 Reto: ¿un algoritmo que funcione con cualquier número de discos?</b>
            <p style={{ margin: '6px 0' }}>Un algoritmo es una receta de pasos tan clara que hasta una máquina podría seguirla sin pensar. Escribid en la pizarra unas instrucciones para resolver la torre con 3 discos, probadlas con 4 y con 5… ¿Funcionan siempre?</p>
            {pistas > 0 && PISTAS_ALGORITMO.slice(0, pistas).map((p, i) => (
                <div key={i} style={{ background: '#fefce8', border: '2px solid #facc15', borderRadius: 10, padding: '6px 10px', margin: '6px 0' }}>💡 {p}</div>
            ))}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '6px 0' }}>
                <button onClick={() => setPistas(p => Math.min(PISTAS_ALGORITMO.length, p + 1))} disabled={pistas >= PISTAS_ALGORITMO.length} style={btn(pistas >= PISTAS_ALGORITMO.length ? '#cbd5e1' : '#ca8a04')}>💡 Pista ({pistas}/{PISTAS_ALGORITMO.length})</button>
                <button onClick={() => setVerAlg(v => !v)} style={btn('#16a34a')}>{verAlg ? 'Ocultar' : 'Ver'} los algoritmos</button>
            </div>
            {verAlg && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))', gap: 12, marginTop: 8 }}>
                    <div style={{ background: '#f0fdf4', borderRadius: 10, padding: '10px 12px' }}>
                        <b>Algoritmo 1 · Sin pensar (iterativo)</b>
                        <ol style={{ margin: '6px 0', paddingLeft: 20 }}>
                            <li>Mueve el disco pequeño una torre en el mismo sentido de siempre: si el número de discos es <b>par</b>, A → B → C → A; si es <b>impar</b>, A → C → B → A.</li>
                            <li>Haz el único movimiento posible que no use el disco pequeño.</li>
                            <li>Repite 1 y 2 hasta que la torre esté entera en C.</li>
                        </ol>
                        <div style={{ fontSize: '0.82rem', color: '#4b5563' }}>Funciona para cualquier n y usa exactamente 2<span style={sup}>n</span> − 1 movimientos.</div>
                    </div>
                    <div style={{ background: '#eff6ff', borderRadius: 10, padding: '10px 12px' }}>
                        <b>Algoritmo 2 · Pensando en pequeño (recursivo)</b>
                        <div style={{ fontSize: '0.88rem', margin: '6px 0' }}>Para mover <b>n</b> discos de una torre ORIGEN a una DESTINO usando la AUXILIAR:</div>
                        <pre style={{ background: '#1e293b', color: '#e2e8f0', borderRadius: 8, padding: '8px 10px', fontSize: '0.8rem', overflowX: 'auto', margin: 0 }}>{`mover(n, origen, destino, auxiliar):
  si n = 0: no hagas nada
  mover(n−1, origen, auxiliar, destino)
  lleva el disco n de origen a destino
  mover(n−1, auxiliar, destino, origen)`}</pre>
                        <div style={{ fontSize: '0.82rem', color: '#4b5563', marginTop: 6 }}>Es la misma idea que M<sub>n</sub> = 2·M<sub>n−1</sub> + 1: el problema grande se resuelve con dos copias del pequeño.</div>
                    </div>
                </div>
            )}
            <div style={{ fontSize: '0.82rem', color: '#4b5563', marginTop: 8 }}>El botón 🤖 <b>Siguiente movimiento</b> calcula el mejor movimiento desde cualquier posición, aunque os hayáis desviado de la solución.</div>
        </div>
    );
}

export default function TorresHanoi() {
    const [n, setN] = useState(4);
    const [torres, setTorres] = useState(() => inicial(4));
    const [sel, setSel] = useState(null);           // índice de la torre de la que se ha cogido un disco
    const [hist, setHist] = useState([]);           // [[de, a], ...]
    const [error, setError] = useState('');
    const [auto, setAuto] = useState(false);
    const [vel, setVel] = useState(500);
    const [inicio, setInicio] = useState(null);
    const [ahora, setAhora] = useState(Date.now());
    const [usoSolucion, setUsoSolucion] = useState(false);
    const [pistasUsadas, setPistasUsadas] = useState(0);
    const [panel, setPanel] = useState(null);       // 'potencias' | 'algoritmo' | 'notas'
    const [mejores, setMejores] = useState(leerMejores);
    const guardado = useRef(false);

    const minimo = 2 ** n - 1;
    const ganado = torres[2].length === n;

    const reiniciar = useCallback((nuevoN = n) => {
        setN(nuevoN); setTorres(inicial(nuevoN)); setSel(null); setHist([]); setError('');
        setAuto(false); setInicio(null); setUsoSolucion(false); setPistasUsadas(0); guardado.current = false;
    }, [n]);

    const torresRef = useRef(torres);
    torresRef.current = torres;

    const mover = useCallback((de, a, manual = true) => {
        const t = torresRef.current;
        const disco = t[de][t[de].length - 1];
        const tope = t[a][t[a].length - 1];
        if (disco == null || (tope != null && tope < disco)) {
            if (manual) { setError('No se puede poner un disco sobre otro más pequeño.'); try { sonidoIncorrecto(); } catch { /* sin audio */ } }
            return false;
        }
        const c = t.map(x => [...x]);
        c[de].pop(); c[a].push(disco);
        torresRef.current = c;
        setTorres(c);
        setHist(h => [...h, [de, a]]);
        setInicio(i => i ?? Date.now());
        return true;
    }, []);

    const tocar = i => {
        if (auto || ganado) return;
        setError('');
        if (sel === null) {
            if (torres[i].length) setSel(i);
            return;
        }
        if (sel === i) { setSel(null); return; }
        mover(sel, i);
        setSel(null);
    };

    const deshacer = () => {
        if (!hist.length || auto) return;
        const [de, a] = hist[hist.length - 1];
        setTorres(t => { const c = t.map(x => [...x]); c[de].push(c[a].pop()); return c; });
        setHist(h => h.slice(0, -1));
        setSel(null);
    };

    // Teclado: 1, 2, 3 (o A, B, C)
    useEffect(() => {
        const onKey = e => {
            const k = e.key.toUpperCase();
            const i = k === '1' || k === 'A' ? 0 : k === '2' || k === 'B' ? 1 : k === '3' || k === 'C' ? 2 : -1;
            if (i >= 0) tocar(i);
            if ((e.ctrlKey || e.metaKey) && k === 'Z') deshacer();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    });

    // Cronómetro
    useEffect(() => {
        if (!inicio || ganado) return undefined;
        const t = setInterval(() => setAhora(Date.now()), 1000);
        return () => clearInterval(t);
    }, [inicio, ganado]);

    // Solución animada desde el principio
    const verSolucion = () => {
        reiniciar(n);
        setUsoSolucion(true);
        setAuto(true);
    };
    useEffect(() => {
        if (!auto) return undefined;
        const pasos = solucion(n);
        let k = 0;
        const t = setInterval(() => {
            if (k >= pasos.length) { clearInterval(t); setAuto(false); return; }
            const [de, a] = pasos[k++];
            mover(de, a, false);
        }, vel);
        return () => clearInterval(t);
    }, [auto, n, vel, mover]);

    // Victoria
    useEffect(() => {
        if (!ganado || guardado.current) return;
        guardado.current = true;
        if (usoSolucion) return;
        try { sonidoCorrecto(); } catch { /* sin audio */ }
        if (!pistasUsadas) {
            setMejores(m => {
                if (m[n] != null && m[n] <= hist.length) return m;
                const nuevo = { ...m, [n]: hist.length };
                try { localStorage.setItem(LS_MEJORES, JSON.stringify(nuevo)); } catch { /* sin almacenamiento */ }
                return nuevo;
            });
        }
        guardarRegistroLocal('PIZARRAS_VERTICALES', {
            titulo: `Torres de Hanói · ${n} discos (${hist.length} movimientos)`,
            aciertos: minimo, intentos: Math.max(minimo, hist.length), nombre: 'Torres de Hanói', via: 'hanoi',
        });
    }, [ganado, usoSolucion, pistasUsadas, n, hist.length, minimo]);

    const pistaMovimiento = () => {
        if (auto || ganado) return;
        const m = siguienteOptimo(torresRef.current, n);
        if (!m) return;
        setSel(null); setError('');
        setPistasUsadas(p => p + 1);
        mover(m[0], m[1], false);
    };

    const segundos = inicio ? Math.floor(((ganado ? ahora : Date.now()) - inicio) / 1000) : 0;
    const anchoMax = 100;
    const altoDisco = Math.max(16, Math.min(30, 220 / n));

    return (
        <div style={{ maxWidth: 1000, margin: '0 auto' }}>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>
                <span style={{ fontWeight: 800 }}>Discos:</span>
                {[1, 2, 3, 4, 5, 6, 7, 8].map(k => (
                    <button key={k} onClick={() => reiniciar(k)} style={btn(k === n ? '#7c3aed' : 'white', k === n ? 'white' : '#7c3aed', { border: '2px solid #7c3aed', padding: '6px 12px' })}>{k}</button>
                ))}
                <div style={{ flex: 1 }} />
                <span style={{ fontWeight: 800, fontSize: '1.05rem' }}>Movimientos: {hist.length}</span>
                <span style={{ opacity: 0.75 }}>Mínimo: {minimo}</span>
                <span style={{ fontVariantNumeric: 'tabular-nums' }}>⏱ {fmt(segundos)}</span>
            </div>

            <div style={{ background: 'linear-gradient(#e0f2fe, #f8fafc)', borderRadius: 18, padding: '18px 10px 0', border: '1px solid #e2e8f0', userSelect: 'none' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                    {torres.map((t, i) => (
                        <div key={i} onClick={() => tocar(i)} style={{ cursor: auto ? 'default' : 'pointer', position: 'relative', height: altoDisco * n + 70, display: 'flex', flexDirection: 'column-reverse', alignItems: 'center', borderRadius: 12, background: sel === i ? 'rgba(124,58,237,0.10)' : 'transparent', paddingBottom: 14 }}>
                            {/* poste */}
                            <div style={{ position: 'absolute', bottom: 14, width: 10, height: altoDisco * n + 40, background: '#92400e', borderRadius: 6 }} />
                            {/* base */}
                            <div style={{ position: 'absolute', bottom: 0, width: '92%', height: 14, background: '#78350f', borderRadius: 6 }} />
                            {t.map((d, k) => {
                                const arriba = k === t.length - 1;
                                const levantado = arriba && sel === i;
                                return (
                                    <div key={d} style={{
                                        position: 'relative', zIndex: 1, height: altoDisco - 2, marginTop: 2,
                                        width: `${20 + (anchoMax - 20) * (d / n)}%`, background: COLORES[(d - 1) % COLORES.length],
                                        borderRadius: 8, border: '2px solid rgba(0,0,0,0.18)', color: 'white', fontWeight: 900,
                                        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: Math.min(15, altoDisco * 0.6),
                                        transform: levantado ? `translateY(-${altoDisco * (n - t.length) + 26}px)` : 'none', transition: 'transform 0.18s',
                                        boxShadow: levantado ? '0 8px 14px rgba(0,0,0,0.25)' : 'none',
                                    }}>{d}</div>
                                );
                            })}
                        </div>
                    ))}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', textAlign: 'center', fontWeight: 900, color: '#475569', padding: '6px 0 10px' }}>
                    {NOMBRES.map((x, i) => <div key={x}>{x}{i === 2 ? ' 🎯' : ''}</div>)}
                </div>
            </div>

            <div style={{ minHeight: 26, marginTop: 8, fontWeight: 700, color: '#dc2626' }}>{error}</div>
            {ganado && (
                <div style={{ background: '#dcfce7', color: '#166534', borderRadius: 12, padding: '10px 14px', fontWeight: 800, marginBottom: 10 }}>
                    {usoSolucion
                        ? `✅ Solución completa en ${hist.length} movimientos (el mínimo para ${n} discos).`
                        : hist.length === minimo
                            ? `🏆 ¡Perfecto! ${n} discos en ${hist.length} movimientos, el mínimo posible.`
                            : `🎉 ¡Conseguido en ${hist.length} movimientos! Se puede hacer en ${minimo}. ¿Lo intentas?`}
                    {!usoSolucion && pistasUsadas > 0 && ` (con ${pistasUsadas} ayuda${pistasUsadas === 1 ? '' : 's'} del 🤖: no cuenta como récord)`}
                </div>
            )}

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <button onClick={deshacer} disabled={!hist.length || auto} style={btn(hist.length && !auto ? '#f59e0b' : '#cbd5e1')}>↶ Deshacer</button>
                <button onClick={() => reiniciar(n)} style={btn('#64748b')}>↺ Empezar</button>
                <button onClick={pistaMovimiento} disabled={auto || ganado} style={btn(auto || ganado ? '#cbd5e1' : '#2563eb')}>🤖 Siguiente movimiento</button>
                <button onClick={verSolucion} disabled={auto} style={btn(auto ? '#cbd5e1' : '#0f766e')}>▶ Ver la solución</button>
                <label style={{ fontSize: '0.85rem' }}>Velocidad{' '}
                    <select value={vel} onChange={e => setVel(Number(e.target.value))} style={{ padding: 4, borderRadius: 6 }}>
                        <option value={1000}>lenta</option><option value={500}>normal</option><option value={150}>rápida</option>
                    </select>
                </label>
                <div style={{ flex: 1 }} />
                </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
                {[['potencias', '🔢 Potencias de 2', '#0891b2'], ['algoritmo', '🧩 Busca el algoritmo', '#16a34a'], ['notas', '👩‍🏫 Notas para el profesor', '#7c3aed']].map(([id, txt, c]) => (
                    <button key={id} onClick={() => setPanel(p => (p === id ? null : id))} style={btn(panel === id ? c : 'white', panel === id ? 'white' : c, { border: `2px solid ${c}` })}>{txt}</button>
                ))}
            </div>
            <div style={{ fontSize: '0.8rem', opacity: 0.7, marginTop: 6 }}>Toca una torre para coger el disco de arriba y otra para dejarlo (también con las teclas 1, 2, 3). Objetivo: pasar todos los discos a la torre C, moviendo uno cada vez y sin poner nunca un disco sobre otro más pequeño. Las partidas hechas con 🤖 no cuentan como récord.</div>

            {panel === 'potencias' && <PanelPotencias n={n} mejores={mejores} />}
            {panel === 'algoritmo' && <PanelAlgoritmo />}
            {panel === 'notas' && (
                <div style={{ background: 'white', borderRadius: 14, padding: '12px 16px', marginTop: 12, borderLeft: '5px solid #7c3aed', lineHeight: 1.5, fontSize: '0.93rem' }}>
                    <b>Cómo usarlo en las pizarras</b>
                    <ul style={{ margin: '6px 0', paddingLeft: 18 }}>
                        <li>Empezad con 3 discos (con monedas o papelitos de tamaños distintos) y anotad el número mínimo de movimientos. Luego 4, 5… y haced una tabla.</li>
                        <li>Pregunta clave: si ya sé mover 3 discos, ¿cómo muevo 4? (muevo 3 a la torre auxiliar, el grande a su sitio y otra vez los 3 encima).</li>
                        <li>De ahí sale la recurrencia Mₙ = 2·Mₙ₋₁ + 1 y, mirando la tabla (1, 3, 7, 15, 31…), la fórmula Mₙ = 2ⁿ − 1.</li>
                    </ul>
                    <b>Patrones para descubrir</b>
                    <ul style={{ margin: '6px 0', paddingLeft: 18 }}>
                        <li>El disco más pequeño se mueve uno de cada dos movimientos y siempre gira en el mismo sentido (A→B→C→A si el número de discos es par; A→C→B→A si es impar).</li>
                        <li>El disco k se mueve 2ⁿ⁻ᵏ veces: el grande, una sola vez.</li>
                    </ul>
                    <b>Extensiones (techo alto)</b>
                    <ul style={{ margin: '6px 0', paddingLeft: 18 }}>
                        <li>La leyenda dice que unos monjes mueven 64 discos de oro, uno por segundo. ¿Cuánto tardarán? (2⁶⁴ − 1 segundos ≈ 585 000 millones de años).</li>
                        <li>¿Y si hubiera que llevar la torre a la B en lugar de a la C? ¿Y si los discos empiezan repartidos?</li>
                        <li>Con 4 postes se necesitan muchos menos movimientos: ¿cuántos para 4 discos? (9).</li>
                    </ul>
                </div>
            )}
        </div>
    );
}
