import React, { useMemo, useState } from 'react';
import {
    MAGNITUDES, convertir, fmt, unidadesDe, escaleraDe, saltosEntre, pasosConversion, leerNumero,
    unidad, nombreUnidad, magnitudDibujo, aSexagesimal, textoSexagesimal, fraccionDePi, relacion, conU,
} from './magnitudes.js';
import { Escalera, CadenaFactores, Termometros, CirculoAngulo, TablaVolCap } from './Visuales.jsx';

// ─────────────────────────────────────────────────────────────────────────────
//  CONVERSOR VISUAL («Aprende»): explicación + dibujo interactivo de una
//  magnitud. Reutilizable en otras herramientas:
//     <ConversorVisual magnitudes={['angulo']} />   (p. ej. en trigonometría)
// ─────────────────────────────────────────────────────────────────────────────

const card = { background: 'white', borderRadius: 16, padding: '14px 16px', boxShadow: '0 4px 14px rgba(15,23,42,0.07)', border: '1px solid #e2e8f0' };
const chip = (on, c) => ({ padding: '6px 12px', borderRadius: 999, border: `2px solid ${c}`, background: on ? c : 'white', color: on ? 'white' : c, fontWeight: 800, fontSize: '0.82rem', cursor: 'pointer', fontFamily: 'inherit' });
const sel = { padding: '7px 10px', borderRadius: 10, border: '2px solid #cbd5e1', fontSize: '1rem', fontWeight: 700, background: 'white', fontFamily: 'inherit' };

// 1 m² = 100 dm²: cuadrado de 10 × 10
function Cuadricula({ grande = 'm²', pequena = 'dm²', n = 10, color = '#27ae60' }) {
    const L = 150, c = L / n;
    return (
        <svg viewBox={`0 0 ${L + 60} ${L + 30}`} style={{ width: 200, display: 'block' }}>
            {Array.from({ length: n * n }, (_, k) => (
                <rect key={k} x={5 + (k % n) * c} y={5 + Math.floor(k / n) * c} width={c} height={c} fill={k === 0 ? color : 'white'} fillOpacity={k === 0 ? 0.6 : 1} stroke={color} strokeWidth={0.6} />
            ))}
            <rect x={5} y={5} width={L} height={L} fill="none" stroke={color} strokeWidth={2.5} />
            <text x={L + 10} y={L / 2} fontSize={13} fontWeight={800} fill="#0f172a">1 {grande}</text>
            <text x={5} y={L + 24} fontSize={11.5} fontWeight={700} fill="#334155">{n} × {n} = {n * n} {pequena}</text>
        </svg>
    );
}

// 1 dm³ = 1 000 cm³ = 1 l: cubo en perspectiva
function Cubo({ etiqueta = '1 dm³ = 1 l', color = '#e67e22' }) {
    const a = 90, d = 40;
    return (
        <svg viewBox="0 0 200 170" style={{ width: 200, display: 'block' }}>
            <polygon points={`20,${40 + a} ${20 + a},${40 + a} ${20 + a},40 20,40`} fill="#7dd3fc" fillOpacity={0.55} stroke={color} strokeWidth={2} />
            <polygon points={`20,40 ${20 + d},${40 - d / 1.4} ${20 + a + d},${40 - d / 1.4} ${20 + a},40`} fill="#bae6fd" stroke={color} strokeWidth={2} />
            <polygon points={`${20 + a},40 ${20 + a + d},${40 - d / 1.4} ${20 + a + d},${40 + a - d / 1.4} ${20 + a},${40 + a}`} fill="#38bdf8" fillOpacity={0.6} stroke={color} strokeWidth={2} />
            {Array.from({ length: 9 }, (_, i) => <line key={i} x1={20 + (i + 1) * a / 10} x2={20 + (i + 1) * a / 10} y1={40} y2={40 + a} stroke={color} strokeWidth={0.4} />)}
            {Array.from({ length: 9 }, (_, i) => <line key={`h${i}`} x1={20} x2={20 + a} y1={40 + (i + 1) * a / 10} y2={40 + (i + 1) * a / 10} stroke={color} strokeWidth={0.4} />)}
            <text x={20} y={160} fontSize={13} fontWeight={800} fill="#0f172a">{etiqueta}</text>
            <text x={22 + a / 2} y={40 + a + 13} fontSize={10} textAnchor="middle" fill="#334155">10 cm = 1 dm</text>
        </svg>
    );
}

function Ilustracion({ mag }) {
    if (mag === 'superficie') return <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center' }}><Cuadricula /><span style={{ fontWeight: 700, color: '#334155', maxWidth: 260 }}>Un cuadrado de 1 m de lado está formado por 10 filas de 10 cuadrados de 1 dm: por eso cada salto vale <b>×100</b>.</span></div>;
    if (mag === 'volumen' || mag === 'volcap') return <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center' }}><Cubo etiqueta={mag === 'volcap' ? '1 dm³ = 1 l' : '1 dm³ = 1 000 cm³'} /><span style={{ fontWeight: 700, color: '#334155', maxWidth: 260 }}>{mag === 'volcap' ? 'Si llenas de agua un cubo de 1 dm de arista, caben exactamente 1 litro.' : '10 × 10 × 10 = 1 000 cubitos de 1 cm³ caben en el cubo de 1 dm³: cada salto vale ×1 000.'}</span></div>;
    return null;
}

/** Tabla de equivalencias: 1 unidad = … unidad SI (o con la de referencia) */
function TablaEquivalencias({ mag }) {
    const M = MAGNITUDES[mag];
    if (M.especial) return null;
    const ref = M.escalera ? M.escalera[Math.floor(M.escalera.length / 2)] : (M.compuesta ? M.unidades[0].s : M.unidades[0].s);
    const base = mag === 'masa' ? 'g' : mag === 'angulo' ? '°' : mag === 'volcap' ? 'l' : ref;
    return (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {M.unidades.filter((u) => u.s !== base).map((u) => (
                <span key={u.s} style={{ padding: '4px 9px', borderRadius: 8, background: '#f1f5f9', fontSize: '0.82rem', fontWeight: 700, color: '#334155' }}>
                    1 {u.s} = {conU(relacion(mag, u.s, base), base)}
                </span>
            ))}
        </div>
    );
}

export default function ConversorVisual({ magnitudes = null, magInicial = null, nivel = 2, compacto = false }) {
    const lista = (magnitudes || Object.keys(MAGNITUDES)).filter((m) => MAGNITUDES[m]);
    const [mag, setMag] = useState(magInicial && lista.includes(magInicial) ? magInicial : lista[0]);
    const M = MAGNITUDES[mag];
    const us = unidadesDe(mag, 3);
    const defecto = (m) => {
        const e = MAGNITUDES[m].escalera;
        if (e) return [e[0], e[Math.min(3, e.length - 1)]];
        const u2 = unidadesDe(m, 3);
        return [u2[0], u2[1]];
    };
    const [par, setPar] = useState(() => defecto(mag));
    const [txt, setTxt] = useState('3,5');
    const [metodo, setMetodo] = useState('saltos');
    const [c, setC] = useState(25);       // temperatura (°C)
    const [grados, setGrados] = useState(60); // ángulos
    const [clicDe, setClicDe] = useState(true);

    const cambiarMag = (m) => { setMag(m); setPar(defecto(m)); setTxt(m === 'velocidad' ? '72' : m === 'densidad' ? '2,7' : '3,5'); setMetodo(MAGNITUDES[m].escalera ? 'saltos' : 'factor'); };
    const [de, a] = par;
    const valor = leerNumero(txt);
    const ok = Number.isFinite(valor);
    const magD = magnitudDibujo(mag, de, a);
    const hayEscalera = !!saltosEntre(magD, de, a);
    const met = hayEscalera ? metodo : 'factor';
    const res = ok ? convertir(valor, mag, de, a) : NaN;
    const pasos = useMemo(() => (ok ? pasosConversion(valor, mag, de, a, met) : []), [ok, valor, mag, de, a, met]);

    const elegirEscalon = (s) => {
        if (clicDe) setPar(([, y]) => [s, y]); else setPar(([x]) => [x, s]);
        setClicDe((v) => !v);
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {lista.length > 1 && (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {lista.map((m) => <button key={m} onClick={() => cambiarMag(m)} style={chip(m === mag, MAGNITUDES[m].color)}>{MAGNITUDES[m].emoji} {MAGNITUDES[m].nombre}</button>)}
                </div>
            )}

            <div style={{ ...card, borderLeft: `6px solid ${M.color}` }}>
                <h3 style={{ margin: '0 0 6px', color: M.color }}>{M.emoji} {M.nombre}</h3>
                <p style={{ margin: 0, color: '#334155', lineHeight: 1.55, fontWeight: 600 }}>{M.explica}</p>
                {!compacto && <div style={{ marginTop: 10 }}><Ilustracion mag={mag} /></div>}
            </div>

            {/* ── TEMPERATURA ── */}
            {mag === 'temperatura' && (
                <div style={card}>
                    <label style={{ fontWeight: 800, color: '#334155' }}>Mueve la temperatura: <b style={{ color: '#ef4444' }}>{c} °C</b>
                        <input type="range" min={-40} max={120} value={c} onChange={(e) => setC(Number(e.target.value))} style={{ width: '100%' }} />
                    </label>
                    <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', alignItems: 'center' }}>
                        <Termometros c={c} />
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontWeight: 700, color: '#334155' }}>
                            <div>K = °C + 273 = {c} + 273 = <b>{c + 273} K</b></div>
                            <div>°F = °C · 1,8 + 32 = {c} · 1,8 + 32 = <b>{fmt(c * 1.8 + 32)} °F</b></div>
                            <div style={{ color: '#64748b', fontSize: '0.88rem' }}>Al revés: °C = K − 273 · °C = (°F − 32) : 1,8</div>
                            <div style={{ color: '#64748b', fontSize: '0.88rem' }}>Curiosidad: a −40 grados, Celsius y Fahrenheit coinciden.</div>
                        </div>
                    </div>
                </div>
            )}

            {/* ── ÁNGULOS: grados ↔ radianes ── */}
            {mag === 'angulo' && (
                <div style={card}>
                    <label style={{ fontWeight: 800, color: '#334155' }}>Ángulo: <b style={{ color: '#6c5ce7' }}>{grados}°</b>
                        <input type="range" min={0} max={360} step={5} value={grados} onChange={(e) => setGrados(Number(e.target.value))} style={{ width: '100%' }} />
                    </label>
                    <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', alignItems: 'center' }}>
                        <CirculoAngulo grados={grados} />
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontWeight: 700, color: '#334155' }}>
                            <div>{grados}° · <span style={{ color: '#6c5ce7' }}>π rad / 180°</span> = <b>{fraccionDePi(grados).texto} rad</b></div>
                            <div>≈ {fmt(Number((grados * Math.PI / 180).toFixed(4)))} rad · {fmt(grados / 360)} vueltas</div>
                            <div style={{ color: '#64748b', fontSize: '0.88rem' }}>360° = 2π rad = 1 vuelta · 1 rad ≈ 57,3°</div>
                        </div>
                    </div>
                    <div style={{ marginTop: 10, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {[30, 45, 60, 90, 120, 135, 150, 180, 270, 360].map((g) => (
                            <button key={g} onClick={() => setGrados(g)} style={{ ...chip(g === grados, '#6c5ce7'), padding: '4px 9px' }}>{g}° = {fraccionDePi(g).texto}</button>
                        ))}
                    </div>
                    <p style={{ margin: '10px 0 0', fontWeight: 700, color: '#334155' }}>Sistema sexagesimal: 12,5° = {textoSexagesimal(aSexagesimal(12.5))} · 1° = 60' · 1' = 60"</p>
                </div>
            )}

            {/* ── CONVERSOR GENERAL ── */}
            {mag !== 'temperatura' && (
                <div style={card}>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', fontWeight: 800, color: '#334155' }}>
                        <input value={txt} onChange={(e) => setTxt(e.target.value)} inputMode="decimal" style={{ ...sel, width: 110, textAlign: 'right' }} />
                        <select value={de} onChange={(e) => setPar([e.target.value, a])} style={{ ...sel, borderColor: '#2563eb' }}>{us.map((s) => <option key={s} value={s}>{s}</option>)}</select>
                        <span>→</span>
                        <select value={a} onChange={(e) => setPar([de, e.target.value])} style={{ ...sel, borderColor: '#16a34a' }}>{us.map((s) => <option key={s} value={s}>{s}</option>)}</select>
                        <button onClick={() => setPar([a, de])} title="Intercambiar" style={{ ...sel, cursor: 'pointer' }}>⇄</button>
                        <span style={{ fontSize: '1.2rem' }}>= <b style={{ color: '#16a34a' }}>{ok ? conU(res, a) : '…'}</b></span>
                    </div>
                    <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: 4 }}>{nombreUnidad(mag, de)} → {nombreUnidad(mag, a)}</div>

                    {hayEscalera && (
                        <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
                            <button onClick={() => setMetodo('saltos')} style={chip(met === 'saltos', '#ea580c')}>🪜 Contando saltos</button>
                            <button onClick={() => setMetodo('factor')} style={chip(met === 'factor', '#7c3aed')}>🔁 Factores de conversión</button>
                        </div>
                    )}

                    <div style={{ marginTop: 12 }}>
                        {magD === 'volcap' && <div style={{ marginBottom: 10 }}><TablaVolCap de={de} a={a} /></div>}
                        {met === 'saltos' && hayEscalera
                            ? <>
                                <Escalera mag={magD} de={de} a={a} onElegir={elegirEscalon} />
                                <div style={{ fontSize: '0.78rem', color: '#64748b' }}>Toca un peldaño para elegir {clicDe ? <b style={{ color: '#2563eb' }}>DE</b> : <b style={{ color: '#16a34a' }}>A</b>}.</div>
                            </>
                            : ok && <CadenaFactores mag={mag} de={de} a={a} valor={valor} size={1.1} />}
                    </div>
                    {ok && (
                        <ol style={{ margin: '12px 0 0', paddingLeft: 22, color: '#334155', fontWeight: 600, lineHeight: 1.7 }}>
                            {pasos.map((p, i) => <li key={i}>{p}</li>)}
                        </ol>
                    )}
                    {!ok && txt && <p style={{ color: '#dc2626', fontWeight: 700 }}>Escribe un número (por ejemplo 3,5 o 4,5·10^-3).</p>}
                </div>
            )}

            {!compacto && mag !== 'temperatura' && (
                <div style={card}>
                    <h4 style={{ margin: '0 0 8px', color: '#334155' }}>📋 Equivalencias</h4>
                    <TablaEquivalencias mag={mag} />
                </div>
            )}
        </div>
    );
}

export { escaleraDe, unidad };
