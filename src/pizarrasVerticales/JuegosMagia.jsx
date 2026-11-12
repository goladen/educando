// Juegos y acertijos de «magia matemática» para proyectar en clase.
// Cada juego: se hace el truco → la clase se pregunta por qué funciona → reto para las pizarras.
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

const TINTA = '#1f2937';
const btn = (bg, color = 'white', extra = {}) => ({
    background: bg, color, border: 'none', borderRadius: 10, padding: '9px 14px', fontWeight: 700,
    cursor: 'pointer', fontSize: '0.9rem', fontFamily: 'inherit', ...extra,
});
const chip = (activo, color) => ({
    padding: '6px 12px', borderRadius: 999, border: `2px solid ${color}`, cursor: 'pointer', fontWeight: 700,
    fontSize: '0.82rem', background: activo ? color : 'white', color: activo ? 'white' : color, fontFamily: 'inherit',
});
const inputGrande = {
    padding: '10px 14px', borderRadius: 12, border: '2px solid #cbd5e1', fontSize: '1.6rem', width: 200,
    textAlign: 'center', fontFamily: 'inherit', fontWeight: 800, letterSpacing: 2,
};
const panel = { background: 'white', borderRadius: 18, padding: 18, marginBottom: 14 };
const grande = { fontSize: 'clamp(1.15rem, 2.2vw, 1.6rem)', lineHeight: 1.45 };

const barajar = (arr) => {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
};

// ─────────────────────────── Notas para el profesor ───────────────────────────
function NotaProfe({ como, porque, retos }) {
    const [abierta, setAbierta] = useState(false);
    const [verPorque, setVerPorque] = useState(false);
    return (
        <div style={{ ...panel, borderLeft: '5px solid #7c3aed' }}>
            <button onClick={() => setAbierta(v => !v)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontWeight: 900, fontSize: '1rem', color: '#7c3aed', fontFamily: 'inherit', padding: 0 }}>
                👩‍🏫 Para el profesor {abierta ? '▲' : '▼'}
            </button>
            {abierta && (
                <div style={{ marginTop: 10, fontSize: '0.93rem', lineHeight: 1.55, display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div><b>🎬 Cómo hacerlo:</b><ol style={{ margin: '4px 0 0', paddingLeft: 20 }}>{como.map((t, i) => <li key={i}>{t}</li>)}</ol></div>
                    <div>
                        <b>🔍 ¿Por qué funciona?</b>{' '}
                        {verPorque
                            ? <div style={{ marginTop: 4, background: '#f5f3ff', borderRadius: 10, padding: '8px 12px' }}>{porque}</div>
                            : <button onClick={() => setVerPorque(true)} style={btn('#ede9fe', '#5b21b6', { padding: '3px 10px', fontSize: '0.8rem' })}>Mostrar explicación</button>}
                    </div>
                    <div><b>🧱 Retos para las pizarras (después del truco):</b><ul style={{ margin: '4px 0 0', paddingLeft: 20 }}>{retos.map((t, i) => <li key={i}>{t}</li>)}</ul></div>
                </div>
            )}
        </div>
    );
}

// ─────────────────────────── 1. Cartas mágicas en binario ───────────────────────────
const COLORES_CARTA = ['#2563eb', '#16a34a', '#dc2626', '#ca8a04', '#7c3aed', '#0891b2', '#db2777'];
const MAX_DE = { 4: 15, 5: 31, 6: 63, 7: 127 };

function numerosCarta(k, max) {
    const p = 1 << k;
    const out = [];
    for (let n = 1; n <= max; n++) if (n & p) out.push(n);
    return out;
}

function CartasBinarias() {
    const [nCartas, setNCartas] = useState(6);
    const [desordenar, setDesordenar] = useState(false);
    const [semilla, setSemilla] = useState(0);
    const [marcadas, setMarcadas] = useState(() => new Set());
    const [revelado, setRevelado] = useState(false);
    const [verTruco, setVerTruco] = useState(false);
    const [imprimir, setImprimir] = useState(false);
    const max = MAX_DE[nCartas];

    const cartas = useMemo(() => Array.from({ length: nCartas }, (_, k) => {
        const nums = numerosCarta(k, max);
        return desordenar ? barajar(nums) : nums;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }), [nCartas, desordenar, semilla, max]);

    const reiniciar = () => { setMarcadas(new Set()); setRevelado(false); };
    useEffect(reiniciar, [nCartas]);
    const toggle = k => { setRevelado(false); setMarcadas(prev => { const s = new Set(prev); if (s.has(k)) s.delete(k); else s.add(k); return s; }); };
    const suma = [...marcadas].reduce((s, k) => s + (1 << k), 0);
    const sumandos = [...marcadas].sort((a, b) => a - b).map(k => 1 << k);
    const binario = Array.from({ length: nCartas }, (_, i) => (marcadas.has(nCartas - 1 - i) ? '1' : '0')).join('');
    const cols = cartas[0].length >= 32 ? 8 : cartas[0].length >= 16 ? 8 : 4;

    useEffect(() => {
        if (!imprimir) return undefined;
        const t = setTimeout(() => { window.print(); setImprimir(false); }, 80);
        return () => clearTimeout(t);
    }, [imprimir]);

    return (
        <>
            <div style={{ ...panel, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <span style={{ fontWeight: 700 }}>Cartas:</span>
                {[4, 5, 6, 7].map(n => <button key={n} onClick={() => setNCartas(n)} style={chip(nCartas === n, '#2563eb')}>{n} (1-{MAX_DE[n]})</button>)}
                <span style={{ width: 10 }} />
                <button onClick={() => setDesordenar(v => !v)} style={chip(desordenar, '#ca8a04')}>🔀 Números desordenados</button>
                {desordenar && <button onClick={() => setSemilla(s => s + 1)} style={chip(false, '#ca8a04')}>Barajar otra vez</button>}
                <button onClick={() => setVerTruco(v => !v)} style={chip(verTruco, '#7c3aed')}>🔍 {verTruco ? 'Ocultar el truco' : 'Mostrar el truco'}</button>
                <button onClick={() => setImprimir(true)} style={chip(false, '#475569')}>🖨️ Imprimir cartas</button>
            </div>

            <div style={{ ...panel, ...grande, textAlign: 'center', background: '#fffbeb' }}>
                Piensa un número del <b>1 al {max}</b> y no lo digas. Dime solo <b>en qué cartas aparece</b>. 🔮
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 330px), 1fr))', gap: 12, marginBottom: 14 }}>
                {cartas.map((nums, k) => {
                    const on = marcadas.has(k);
                    const color = COLORES_CARTA[k % COLORES_CARTA.length];
                    return (
                        <button key={k} onClick={() => toggle(k)} style={{
                            background: on ? color : 'white', color: on ? 'white' : TINTA, border: `3px solid ${color}`,
                            borderRadius: 16, padding: 12, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
                            boxShadow: on ? `0 6px 18px ${color}66` : '0 2px 6px rgba(0,0,0,0.06)', transition: 'all 0.15s',
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                                <span style={{ fontWeight: 900, fontSize: '1.1rem' }}>CARTA {k + 1}</span>
                                <span style={{ fontSize: '0.85rem', fontWeight: 800 }}>
                                    {verTruco && <span style={{ background: on ? 'white' : color, color: on ? color : 'white', borderRadius: 8, padding: '2px 8px', marginRight: 6 }}>2^{k} = {1 << k}</span>}
                                    {on ? '✓ Está' : 'Toca si está'}
                                </span>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 3 }}>
                                {nums.map(n => {
                                    const clave = verTruco && n === (1 << k);
                                    return (
                                        <span key={n} style={{
                                            textAlign: 'center', fontWeight: 700, fontSize: nums.length > 32 ? '0.78rem' : '1rem', padding: '3px 0', borderRadius: 6,
                                            background: clave ? (on ? 'white' : color) : (on ? 'rgba(255,255,255,0.15)' : '#f8fafc'),
                                            color: clave ? (on ? color : 'white') : 'inherit',
                                        }}>{n}</span>
                                    );
                                })}
                            </div>
                        </button>
                    );
                })}
            </div>

            <div style={{ ...panel, textAlign: 'center' }}>
                <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
                    <button onClick={() => setRevelado(true)} style={btn('linear-gradient(135deg,#7c3aed,#db2777)', 'white', { fontSize: '1.15rem', padding: '12px 26px' })}>🔮 ¡Adivinar!</button>
                    <button onClick={reiniciar} style={btn('#e5e7eb', TINTA)}>↺ Otro número</button>
                </div>
                {revelado && (
                    <div style={{ marginTop: 16 }}>
                        <div style={{ fontSize: 'clamp(3rem, 10vw, 6.5rem)', fontWeight: 900, color: '#7c3aed', lineHeight: 1 }}>{suma || '¿?'}</div>
                        {suma === 0 && <div style={{ color: '#6b7280' }}>No has marcado ninguna carta… ¿seguro que tu número está entre 1 y {max}?</div>}
                        {verTruco && suma > 0 && (
                            <div style={{ marginTop: 10, ...grande }}>
                                {sumandos.join(' + ')} = <b>{suma}</b>
                                <div style={{ fontFamily: 'monospace', fontSize: '1.3rem', marginTop: 6 }}>
                                    En binario: <b>{binario}</b><sub>2</sub>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {verTruco && (
                <div style={{ ...panel, overflowX: 'auto' }}>
                    <div style={{ fontWeight: 800, marginBottom: 8 }}>Cada carta es una cifra del número en binario</div>
                    <table style={{ borderCollapse: 'collapse', fontFamily: 'monospace', fontSize: '1.05rem', margin: '0 auto' }}>
                        <thead>
                            <tr>
                                <th style={{ padding: '4px 10px' }}>Carta</th>
                                {Array.from({ length: nCartas }, (_, i) => nCartas - 1 - i).map(k => <th key={k} style={{ padding: '4px 10px', color: COLORES_CARTA[k % COLORES_CARTA.length] }}>{k + 1}</th>)}
                            </tr>
                            <tr>
                                <th style={{ padding: '4px 10px' }}>Vale</th>
                                {Array.from({ length: nCartas }, (_, i) => nCartas - 1 - i).map(k => <th key={k} style={{ padding: '4px 10px' }}>{1 << k}</th>)}
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td style={{ padding: '4px 10px', fontWeight: 700 }}>¿Está?</td>
                                {Array.from({ length: nCartas }, (_, i) => nCartas - 1 - i).map(k => (
                                    <td key={k} style={{ padding: '4px 10px', textAlign: 'center', fontWeight: 900, background: marcadas.has(k) ? '#dcfce7' : '#f8fafc' }}>{marcadas.has(k) ? 1 : 0}</td>
                                ))}
                            </tr>
                        </tbody>
                    </table>
                </div>
            )}

            <NotaProfe
                como={[
                    'Proyecta las cartas (o reparte las impresas). Un alumno piensa un número sin decirlo.',
                    'El alumno dice en qué cartas está; tú (o él) las tocas para marcarlas.',
                    'Suma mentalmente el primer número de cada carta marcada y di el número. Pulsa «¡Adivinar!» para comprobarlo delante de todos.',
                    'Repite 3 o 4 veces con alumnos distintos. Luego activa «Números desordenados» para que no vean el patrón a simple vista.',
                    'Antes de explicar nada, lánzalo como reto: «¿Cómo lo hago?». Que lo descubran en las pizarras.',
                ]}
                porque={'Todo número natural se escribe de una sola forma como suma de potencias de 2 distintas (su escritura en binario). La carta k contiene exactamente los números que tienen un 1 en la cifra que vale 2^(k−1). Por eso, decir en qué cartas está el número es dictar sus cifras binarias, y sumar el primer número de esas cartas (1, 2, 4, 8, 16, 32…) es pasar de binario a decimal. Ejemplo: 21 = 16 + 4 + 1 = 10101₂ → está en las cartas 1, 3 y 5. El 63 = 111111₂ está en todas.'}
                retos={[
                    '¿Qué tienen en común los primeros números de cada carta? ¿Por qué funciona el truco?',
                    '¿Por qué el 63 aparece en todas las cartas? ¿Hay algún número que no aparezca en ninguna?',
                    '¿Cuántos números hay en cada carta? ¿Por qué todas tienen los mismos?',
                    'Fabricad una séptima carta para poder adivinar números hasta el 127. ¿Cuántas cartas harían falta para llegar al 1000?',
                    'Reto difícil: diseñad cartas en base 3 (un número puede estar «una vez» o «dos veces» en una carta).',
                ]}
            />

            {imprimir && createPortal(
                <div className="pv-print">
                    <h2 style={{ margin: '0 0 10px' }}>Cartas mágicas · piensa un número del 1 al {max}</h2>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                        {cartas.map((nums, k) => (
                            <table key={k} style={{ borderCollapse: 'collapse', width: '100%', fontSize: 15 }}>
                                <thead><tr><th colSpan={cols} style={{ border: '1.5px solid #000', textAlign: 'left', padding: '3px 6px', fontSize: 17 }}>CARTA {k + 1}</th></tr></thead>
                                <tbody>
                                    {Array.from({ length: Math.ceil(nums.length / cols) }, (_, f) => (
                                        <tr key={f}>{nums.slice(f * cols, f * cols + cols).map(n => <td key={n} style={{ border: '1px solid #000', textAlign: 'center', padding: '3px 0' }}>{n}</td>)}</tr>
                                    ))}
                                </tbody>
                            </table>
                        ))}
                    </div>
                </div>,
                document.body,
            )}
        </>
    );
}

// ─────────────────────────── 2. Adivino en pocas preguntas (búsqueda binaria) ───────────────────────────
function AdivinoPreguntas() {
    const [N, setN] = useState(100);
    const [lo, setLo] = useState(1);
    const [hi, setHi] = useState(100);
    const [preguntas, setPreguntas] = useState(0);
    const [empezado, setEmpezado] = useState(false);
    const maxPreg = Math.ceil(Math.log2(N));
    const reiniciar = (n = N) => { setN(n); setLo(1); setHi(n); setPreguntas(0); setEmpezado(false); };
    const mid = Math.floor((lo + hi) / 2);
    const terminado = lo === hi;
    const responder = mayor => { setPreguntas(p => p + 1); if (mayor) setLo(mid + 1); else setHi(mid); };

    return (
        <>
            <div style={{ ...panel, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <span style={{ fontWeight: 700 }}>Números del 1 al</span>
                {[100, 1000, 1000000].map(n => <button key={n} onClick={() => reiniciar(n)} style={chip(N === n, '#0891b2')}>{n.toLocaleString('es-ES')}</button>)}
            </div>
            <div style={{ ...panel, textAlign: 'center' }}>
                {!empezado ? (
                    <>
                        <div style={grande}>Piensa un número del <b>1 al {N.toLocaleString('es-ES')}</b>. Lo voy a adivinar con <b>{maxPreg} preguntas</b> como mucho, y solo podéis responder <b>sí</b> o <b>no</b>.</div>
                        <button onClick={() => setEmpezado(true)} style={btn('#0891b2', 'white', { marginTop: 14, fontSize: '1.1rem', padding: '12px 24px' })}>¡Ya lo he pensado!</button>
                    </>
                ) : terminado ? (
                    <>
                        <div style={grande}>Tu número es…</div>
                        <div style={{ fontSize: 'clamp(3rem, 10vw, 6rem)', fontWeight: 900, color: '#0891b2', lineHeight: 1.1 }}>{lo.toLocaleString('es-ES')}</div>
                        <div style={{ color: '#4b5563', marginTop: 6 }}>Con {preguntas} {preguntas === 1 ? 'pregunta' : 'preguntas'}.</div>
                        <button onClick={() => reiniciar()} style={btn('#e5e7eb', TINTA, { marginTop: 12 })}>↺ Otra vez</button>
                    </>
                ) : (
                    <>
                        <div style={{ color: '#6b7280', fontWeight: 700 }}>Pregunta {preguntas + 1}</div>
                        <div style={{ ...grande, fontSize: 'clamp(1.5rem, 3.5vw, 2.4rem)', margin: '8px 0 14px' }}>¿Tu número es <b>mayor que {mid.toLocaleString('es-ES')}</b>?</div>
                        <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
                            <button onClick={() => responder(true)} style={btn('#16a34a', 'white', { fontSize: '1.3rem', padding: '12px 34px' })}>Sí</button>
                            <button onClick={() => responder(false)} style={btn('#dc2626', 'white', { fontSize: '1.3rem', padding: '12px 34px' })}>No</button>
                        </div>
                        <div style={{ marginTop: 18 }}>
                            <div style={{ position: 'relative', height: 22, background: '#e5e7eb', borderRadius: 11, overflow: 'hidden' }}>
                                <div style={{ position: 'absolute', top: 0, bottom: 0, left: `${((lo - 1) / N) * 100}%`, width: `${Math.max(0.6, ((hi - lo + 1) / N) * 100)}%`, background: '#0891b2', transition: 'all 0.3s' }} />
                            </div>
                            <div style={{ fontSize: '0.9rem', color: '#4b5563', marginTop: 6 }}>Queda entre <b>{lo.toLocaleString('es-ES')}</b> y <b>{hi.toLocaleString('es-ES')}</b> · {(hi - lo + 1).toLocaleString('es-ES')} posibles</div>
                        </div>
                    </>
                )}
            </div>
            <NotaProfe
                como={[
                    'Un alumno piensa un número y lo escribe en un papel (para que no haya trampas).',
                    'La pantalla hace las preguntas; la clase responde sí o no.',
                    'Antes de jugar, pide una predicción: «¿Cuántas preguntas creéis que necesito?». Prueba luego con 1 000 y con un millón.',
                ]}
                porque={'Cada pregunta parte por la mitad los números que quedan posibles (búsqueda binaria). Con 7 preguntas se pueden distinguir 2⁷ = 128 casos, que son más de 100. Para 1 000 hacen falta 10 (2¹⁰ = 1024) y para un millón, 20 (2²⁰ ≈ 1 048 576). Es la misma idea que las cartas en binario: cada respuesta sí/no es una cifra binaria.'}
                retos={[
                    '¿Por qué con 7 preguntas basta para 1-100? ¿Bastarían 6?',
                    '¿Cuántas preguntas harían falta para adivinar un día del año? ¿Y una persona de toda España?',
                    'Jugad en parejas en la pizarra: uno piensa y el otro pregunta. ¿Quién lo consigue con menos preguntas?',
                ]}
            />
        </>
    );
}

// ─────────────────────────── 3. El truco del 1089 ───────────────────────────
const invertir = s => s.split('').reverse().join('');
function Truco1089() {
    const [num, setNum] = useState('');
    const [paso, setPaso] = useState(0);
    const [sobre, setSobre] = useState(false);
    const valido = /^\d{3}$/.test(num) && num[0] !== num[2];
    const inv = invertir(num);
    const mayor = Math.max(+num, +inv || 0), menor = Math.min(+num, +inv || 0);
    const resta = String(mayor - menor).padStart(3, '0');
    const restaInv = invertir(resta);
    const total = +resta + +restaInv;
    const pasos = valido ? [
        `Le damos la vuelta: ${inv}`,
        `Restamos el menor al mayor: ${mayor} − ${String(menor).padStart(3, '0')} = ${resta}`,
        `Le damos la vuelta al resultado: ${restaInv}`,
        `Sumamos: ${resta} + ${restaInv} = ${total}`,
    ] : [];

    return (
        <>
            <div style={{ ...panel, ...grande }}>
                <ol style={{ margin: 0, paddingLeft: 24 }}>
                    <li>Escribe un número de <b>3 cifras</b> cuya primera y última cifra sean <b>distintas</b> (por ejemplo, 742).</li>
                    <li>Escríbelo al revés (247).</li>
                    <li>Resta el menor al mayor (742 − 247 = 495). Si sale de dos cifras, ponle un 0 delante (099).</li>
                    <li>Dale la vuelta al resultado (594).</li>
                    <li>Suma esos dos últimos números.</li>
                </ol>
                <div style={{ marginTop: 12, textAlign: 'center' }}>
                    <button onClick={() => setSobre(true)} style={btn('linear-gradient(135deg,#b45309,#f59e0b)', 'white', { fontSize: '1.1rem', padding: '12px 24px' })}>✉️ Abrir el sobre</button>
                    {sobre && <div style={{ fontSize: 'clamp(3rem, 10vw, 6rem)', fontWeight: 900, color: '#b45309', lineHeight: 1.1, marginTop: 10 }}>1089</div>}
                </div>
            </div>
            <div style={panel}>
                <div style={{ fontWeight: 800, marginBottom: 8 }}>🧮 Comprobar con el número de un alumno</div>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                    <input value={num} onChange={e => { setNum(e.target.value.replace(/\D/g, '').slice(0, 3)); setPaso(0); }} placeholder="742" inputMode="numeric" style={inputGrande} />
                    {num.length === 3 && !valido && <span style={{ color: '#dc2626' }}>La primera y la última cifra tienen que ser distintas.</span>}
                    {valido && paso < pasos.length && <button onClick={() => setPaso(p => p + 1)} style={btn('#b45309')}>Siguiente paso ▶</button>}
                </div>
                <div style={{ marginTop: 10, ...grande }}>
                    {pasos.slice(0, paso).map((t, i) => <div key={i}>{i + 1}. {t}</div>)}
                </div>
            </div>
            <NotaProfe
                como={[
                    'Antes de empezar, escribe 1089 en un papel, mételo en un sobre y déjalo a la vista (o usa el botón «Abrir el sobre»).',
                    'Todos los alumnos hacen las operaciones a la vez en su cuaderno o en la pizarra, cada uno con su número.',
                    'Pregunta quién ha obtenido 1089… ¡todos! Abre el sobre.',
                ]}
                porque={'Si el número es abc (a > c), al restar abc − cba = 100a + c − 100c − a = 99·(a − c). Como a − c va de 1 a 9, el resultado solo puede ser 099, 198, 297, 396, 495, 594, 693, 792 u 891. En todos, la cifra central es 9 y las otras dos suman 9; por eso, al sumarle su número al revés siempre sale 9·100 + 18·10 + 9 = 1089.'}
                retos={[
                    '¿Qué resultados puede dar la resta? Haced la lista. ¿Qué tienen en común?',
                    '¿Por qué hay que poner el 0 delante cuando la resta da 99?',
                    '¿Pasa algo parecido con números de 2 cifras? ¿Y de 4 cifras?',
                ]}
            />
        </>
    );
}

// ─────────────────────────── 4. Adivino de cumpleaños ───────────────────────────
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const DIAS_MES = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
function AdivinoCumple() {
    const [res, setRes] = useState('');
    const [ver, setVer] = useState(false);
    const n = Number(res) - 15;
    const dia = Math.floor(n / 100), mes = n % 100;
    const ok = res && n > 0 && mes >= 1 && mes <= 12 && dia >= 1 && dia <= DIAS_MES[mes - 1];
    return (
        <>
            <div style={{ ...panel, ...grande }}>
                <ol style={{ margin: 0, paddingLeft: 24 }}>
                    <li>Multiplica el <b>día</b> de tu cumpleaños por <b>20</b>.</li>
                    <li>Súmale <b>3</b>.</li>
                    <li>Multiplica el resultado por <b>5</b>.</li>
                    <li>Súmale el número del <b>mes</b> en que naciste (enero = 1 … diciembre = 12).</li>
                    <li>Dime el resultado.</li>
                </ol>
            </div>
            <div style={{ ...panel, textAlign: 'center' }}>
                <input value={res} onChange={e => { setRes(e.target.value.replace(/\D/g, '').slice(0, 5)); setVer(false); }} placeholder="Resultado" inputMode="numeric" style={inputGrande} />
                <div><button onClick={() => setVer(true)} disabled={!res} style={btn('#db2777', 'white', { marginTop: 12, fontSize: '1.1rem', padding: '12px 24px' })}>🎂 Adivinar</button></div>
                {ver && (ok
                    ? <div style={{ fontSize: 'clamp(2rem, 6vw, 3.6rem)', fontWeight: 900, color: '#db2777', marginTop: 12 }}>{dia} de {MESES[mes - 1]}</div>
                    : <div style={{ color: '#dc2626', marginTop: 12 }}>Ese resultado no corresponde a ninguna fecha. Repasad las operaciones.</div>)}
            </div>
            <NotaProfe
                como={[
                    'Un alumno hace las operaciones en secreto (con calculadora si hace falta) y dice el resultado.',
                    'Réstale 15 mentalmente: las dos últimas cifras son el mes y las de delante, el día.',
                    'Ejemplo: nació el 23 de julio → 23·20 = 460; +3 = 463; ·5 = 2315; +7 = 2322. 2322 − 15 = 2307 → día 23, mes 07.',
                ]}
                porque={'Si el día es d y el mes es m: (20d + 3)·5 + m = 100d + 15 + m. Al restar 15 queda 100d + m: el día queda en las centenas y el mes en las dos últimas cifras. El «+3» y el «·5» solo sirven para disimular.'}
                retos={[
                    'Escribid el truco con letras y explicad por qué funciona.',
                    'Inventad un truco que adivine el día, el mes y además la edad.',
                    'Cambiad los números del truco (20, 3, 5) por otros que también funcionen.',
                ]}
            />
        </>
    );
}

// ─────────────────────────── 5. La cifra borrada (prueba del 9) ───────────────────────────
function CifraBorrada() {
    const [cifras, setCifras] = useState('');
    const [ver, setVer] = useState(false);
    const suma = cifras.split('').reduce((s, c) => s + Number(c), 0);
    const falta = cifras ? ((9 - (suma % 9)) % 9 || 9) : null;
    return (
        <>
            <div style={{ ...panel, ...grande }}>
                <ol style={{ margin: 0, paddingLeft: 24 }}>
                    <li>Escribe un número de <b>4 o 5 cifras</b> (por ejemplo, 52 816).</li>
                    <li>Desordena sus cifras para formar otro número (por ejemplo, 18 652).</li>
                    <li>Resta el menor al mayor (52 816 − 18 652 = 34 164).</li>
                    <li>Rodea con un círculo una cifra del resultado que <b>no sea 0</b>.</li>
                    <li>Dime las demás cifras, en el orden que quieras.</li>
                </ol>
            </div>
            <div style={{ ...panel, textAlign: 'center' }}>
                <div style={{ fontSize: '0.9rem', color: '#6b7280', marginBottom: 6 }}>Cifras que te dicen (sin la rodeada)</div>
                <input value={cifras} onChange={e => { setCifras(e.target.value.replace(/\D/g, '').slice(0, 12)); setVer(false); }} placeholder="3464" inputMode="numeric" style={inputGrande} />
                <div><button onClick={() => setVer(true)} disabled={!cifras} style={btn('#16a34a', 'white', { marginTop: 12, fontSize: '1.1rem', padding: '12px 24px' })}>⭕ ¿Qué cifra has rodeado?</button></div>
                {ver && <div style={{ fontSize: 'clamp(3rem, 10vw, 6rem)', fontWeight: 900, color: '#16a34a', lineHeight: 1.1, marginTop: 10 }}>{falta}</div>}
            </div>
            <NotaProfe
                como={[
                    'Cada alumno hace las operaciones en su pizarra o cuaderno.',
                    'Un alumno te dice las cifras que no ha rodeado. Súmalas mentalmente: la cifra rodeada es lo que falta para llegar al siguiente múltiplo de 9.',
                    'Ejemplo: 34 164, rodea el 1 → dice 3, 4, 6, 4 → suman 17 → falta 1 para 18.',
                ]}
                porque={'Un número y cualquier reordenación de sus cifras tienen la misma suma de cifras, así que dan el mismo resto al dividir entre 9. Su diferencia es, por tanto, múltiplo de 9, y la suma de sus cifras también. Si sumamos las cifras que nos dicen, la cifra rodeada es la que completa un múltiplo de 9. Por eso no se puede rodear un 0: no sabríamos si falta un 0 o un 9.'}
                retos={[
                    '¿Por qué la diferencia siempre es múltiplo de 9? Probad con varios ejemplos y buscad una explicación.',
                    '¿Qué pasaría si se pudiera rodear un 0?',
                    'Investigad la «prueba del 9» para comprobar multiplicaciones. ¿Por qué funciona?',
                ]}
            />
        </>
    );
}

// ─────────────────────────── 6. Juego del 21 contra Pikt ───────────────────────────
function Juego21() {
    const [meta, setMeta] = useState(21);
    const [maxPaso, setMaxPaso] = useState(3);
    const [empieza, setEmpieza] = useState('clase');
    const [historial, setHistorial] = useState([]); // [{ n, quien }]
    const [turno, setTurno] = useState('clase');
    const [ganador, setGanador] = useState(null);
    const [partida, setPartida] = useState(0);
    const timer = useRef(null);
    const actual = historial.length ? historial[historial.length - 1].n : 0;

    const nueva = (e = empieza, m = meta, k = maxPaso) => {
        clearTimeout(timer.current);
        setEmpieza(e); setMeta(m); setMaxPaso(k);
        setHistorial([]); setGanador(null); setTurno(e); setPartida(p => p + 1);
    };
    useEffect(() => () => clearTimeout(timer.current), []);

    const decir = (quien, cuantos) => {
        const nuevos = [];
        for (let i = 1; i <= cuantos && actual + i <= meta; i++) nuevos.push({ n: actual + i, quien });
        const fin = nuevos[nuevos.length - 1].n;
        setHistorial(h => [...h, ...nuevos]);
        if (fin === meta) { setGanador(quien); return; }
        setTurno(quien === 'clase' ? 'pikt' : 'clase');
    };

    // Turno de Pikt: estrategia ganadora (números ≡ meta mod (k+1)); si no puede, dice 1 número.
    useEffect(() => {
        if (turno !== 'pikt' || ganador) return undefined;
        timer.current = setTimeout(() => {
            const m = maxPaso + 1;
            let cuantos = 0;
            for (let c = 1; c <= maxPaso && actual + c <= meta; c++) if ((meta - (actual + c)) % m === 0) { cuantos = c; break; }
            if (!cuantos) cuantos = 1;
            decir('pikt', cuantos);
        }, 900);
        return () => clearTimeout(timer.current);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [turno, ganador, partida]);

    const quienDijo = {};
    historial.forEach(h => { quienDijo[h.n] = h.quien; });

    return (
        <>
            <div style={{ ...panel, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <span style={{ fontWeight: 700 }}>Gana quien diga el</span>
                {[21, 30, 50].map(m => <button key={m} onClick={() => nueva(empieza, m, maxPaso)} style={chip(meta === m, '#ea580c')}>{m}</button>)}
                <span style={{ fontWeight: 700, marginLeft: 8 }}>Máximo por turno</span>
                {[3, 4].map(k => <button key={k} onClick={() => nueva(empieza, meta, k)} style={chip(maxPaso === k, '#ea580c')}>{k}</button>)}
                <span style={{ fontWeight: 700, marginLeft: 8 }}>Empieza</span>
                <button onClick={() => nueva('clase')} style={chip(empieza === 'clase', '#2563eb')}>La clase</button>
                <button onClick={() => nueva('pikt')} style={chip(empieza === 'pikt', '#2563eb')}>Pikt</button>
            </div>
            <div style={{ ...panel, ...grande, textAlign: 'center' }}>
                Por turnos, se cuenta desde el 1. En cada turno se dicen <b>de 1 a {maxPaso} números seguidos</b>. Gana quien diga el <b>{meta}</b>.
            </div>
            <div style={{ ...panel }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center', marginBottom: 14 }}>
                    {Array.from({ length: meta }, (_, i) => i + 1).map(n => {
                        const q = quienDijo[n];
                        return (
                            <span key={n} style={{
                                width: 42, height: 42, borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                fontWeight: 800, fontSize: '1rem',
                                background: q === 'clase' ? '#2563eb' : q === 'pikt' ? '#ea580c' : '#f1f5f9',
                                color: q ? 'white' : '#64748b', border: n === meta ? '3px solid #facc15' : 'none',
                            }}>{n}</span>
                        );
                    })}
                </div>
                <div style={{ display: 'flex', gap: 14, justifyContent: 'center', fontSize: '0.85rem', marginBottom: 12 }}>
                    <span><span style={{ color: '#2563eb' }}>●</span> La clase</span>
                    <span><span style={{ color: '#ea580c' }}>●</span> Pikt</span>
                </div>
                {ganador ? (
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: 'clamp(1.6rem, 4vw, 2.6rem)', fontWeight: 900, color: ganador === 'clase' ? '#2563eb' : '#ea580c' }}>
                            {ganador === 'clase' ? '🎉 ¡Gana la clase!' : '🤖 Gana Pikt'}
                        </div>
                        <button onClick={() => nueva()} style={btn('#e5e7eb', TINTA, { marginTop: 10 })}>↺ Otra partida</button>
                    </div>
                ) : turno === 'clase' ? (
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ fontWeight: 700, marginBottom: 8 }}>Turno de la clase. ¿Cuántos números decís?</div>
                        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
                            {Array.from({ length: maxPaso }, (_, i) => i + 1).filter(c => actual + c <= meta).map(c => (
                                <button key={c} onClick={() => decir('clase', c)} style={btn('#2563eb', 'white', { fontSize: '1.05rem', padding: '11px 18px' })}>
                                    {Array.from({ length: c }, (_, i) => actual + i + 1).join(', ')}
                                </button>
                            ))}
                        </div>
                    </div>
                ) : (
                    <div style={{ textAlign: 'center', fontWeight: 700, color: '#ea580c' }}>🤖 Pikt está pensando…</div>
                )}
            </div>
            <NotaProfe
                como={[
                    'Juega contra la clase una o dos partidas dejando que empiece Pikt: ganará siempre.',
                    'Después deja empezar a la clase. Si no conocen la estrategia, Pikt casi siempre recupera la ventaja.',
                    'Para el trabajo en pizarras, que jueguen por parejas y busquen una estrategia ganadora. Vuelve a jugar contra Pikt al final para comprobarla.',
                ]}
                porque={`Los números «ganadores» son los que están a una distancia múltiplo de ${maxPaso + 1} de la meta: ${(() => { const out = []; for (let n = meta; n > 0; n -= maxPaso + 1) out.unshift(n); return out.join(', '); })()}. Quien dice uno de ellos puede decir siempre el siguiente: si el rival dice c números, él dice ${maxPaso + 1} − c. Si el primer número ganador es menor o igual que ${maxPaso}, gana siempre quien empieza diciendo hasta él; si la meta es múltiplo de ${maxPaso + 1}, gana siempre el segundo.`}
                retos={[
                    'Empezad desde el final: ¿qué número tenéis que decir para estar seguros de decir el 21?',
                    '¿Os conviene empezar o que empiece el rival? ¿Depende de la meta?',
                    'Cambiad las reglas: ¿y si pierde quien dice el 21?',
                ]}
            />
        </>
    );
}

// ─────────────────────────── Menú de juegos ───────────────────────────
export const JUEGOS_MAGIA = [
    { id: 'cartas', emoji: '🃏', titulo: 'Cartas mágicas', desc: 'Piensa un número del 1 al 63, di en qué cartas está y el profe lo adivina. Sistema binario.', color: '#7c3aed', tema: 'Sentido numérico', C: CartasBinarias },
    { id: 'preguntas', emoji: '❓', titulo: 'Adivino en 7 preguntas', desc: 'Adivina un número del 1 al 100 solo con preguntas de sí o no. Búsqueda binaria.', color: '#0891b2', tema: 'Sentido numérico', C: AdivinoPreguntas },
    { id: '1089', emoji: '✉️', titulo: 'El truco del 1089', desc: 'Cada alumno elige un número distinto y a todos les da 1089. Valor posicional.', color: '#b45309', tema: 'Sentido algebraico', C: Truco1089 },
    { id: 'cumple', emoji: '🎂', titulo: 'Adivino de cumpleaños', desc: 'Unas operaciones y el profe descubre la fecha de cumpleaños. Expresiones algebraicas.', color: '#db2777', tema: 'Sentido algebraico', C: AdivinoCumple },
    { id: 'cifra', emoji: '⭕', titulo: 'La cifra borrada', desc: 'Rodea una cifra del resultado y el profe sabe cuál es. Divisibilidad entre 9.', color: '#16a34a', tema: 'Sentido numérico', C: CifraBorrada },
    { id: '21', emoji: '🤖', titulo: 'El 21 contra Pikt', desc: 'La clase juega contra la máquina, que conoce la estrategia ganadora. Estrategia y restos.', color: '#ea580c', tema: 'Lógica e ingenio', C: Juego21 },
];

export default function JuegosMagia() {
    const [sel, setSel] = useState(null);
    const ref = useRef(null);
    const juego = JUEGOS_MAGIA.find(j => j.id === sel);

    const pantallaCompleta = () => {
        try {
            if (document.fullscreenElement) document.exitFullscreen();
            else ref.current?.requestFullscreen?.();
        } catch { /* sin soporte */ }
    };

    if (juego) {
        const C = juego.C;
        return (
            <div ref={ref} style={{ background: '#f5f3ee', overflowY: 'auto' }}>
                <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 16px 40px', color: TINTA }}>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', margin: '6px 0 14px' }}>
                        <button onClick={() => setSel(null)} style={btn('#e5e7eb', TINTA)}>← Juegos</button>
                        <div style={{ flex: 1, fontWeight: 900, fontSize: '1.3rem', color: juego.color }}>{juego.emoji} {juego.titulo}</div>
                        <button onClick={pantallaCompleta} style={btn('#475569')}>⛶ Pantalla completa</button>
                    </div>
                    <C />
                </div>
            </div>
        );
    }

    return (
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 16px 40px', color: TINTA }}>
            <div style={{ ...panel, background: '#fffbeb' }}>
                <b>🎩 Magia matemática para empezar la clase.</b> Haz el truco, deja que se sorprendan y lanza la pregunta: <i>«¿Cómo lo he hecho?»</i>.
                Cada juego trae instrucciones, la explicación y retos para trabajar después en las pizarras verticales.
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 270px), 1fr))', gap: 12 }}>
                {JUEGOS_MAGIA.map(j => (
                    <button key={j.id} onClick={() => setSel(j.id)} style={{
                        textAlign: 'left', background: 'white', borderRadius: 16, padding: '16px 18px', cursor: 'pointer', fontFamily: 'inherit',
                        border: 'none', borderTop: `5px solid ${j.color}`, boxShadow: '0 3px 10px rgba(0,0,0,0.06)', color: TINTA,
                    }}>
                        <div style={{ fontSize: '2.2rem' }}>{j.emoji}</div>
                        <div style={{ fontWeight: 900, fontSize: '1.08rem', color: j.color }}>{j.titulo}</div>
                        <div style={{ fontSize: '0.86rem', color: '#4b5563', margin: '4px 0 6px' }}>{j.desc}</div>
                        <div style={{ fontSize: '0.75rem', color: '#6b7280', fontWeight: 700 }}>{j.tema}</div>
                    </button>
                ))}
            </div>
        </div>
    );
}
