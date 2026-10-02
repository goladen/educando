import React, { useState } from 'react';
import { CheckCircle, Trophy } from 'lucide-react';
import { sonidoCorrecto, sonidoIncorrecto, sonidoPasar, sonidoFinal, despertarAudio } from './utils/sonidosFeedback';
import { guardarRegistroLocal } from './utils/registrosLocales';
import { CATS_PROB_NUM, generarProblemasNumeros, textoRespuestaNum, leerNumeroEs } from './generadorProblemasNumeros';

// ─────────────────────────────────────────────────────────────────────────────
//  📖 PROBLEMAS DE NÚMEROS (modo de Cálculo Mental)
//  Problemas guiados (preguntas una a una) de naturales, enteros y decimales.
//  El envío al profesor lo hace CalculoMental con su propio modal (onEnviar).
// ─────────────────────────────────────────────────────────────────────────────

const COLOR = '#E91E63';

export default function ProblemasNumeros({ isMobile, onSalir, onEnviar, usuario }) {
    const [fase, setFase] = useState('ELEGIR'); // ELEGIR | JUGANDO | FIN
    const [cats, setCats] = useState(['naturales', 'enteros', 'decimales']);
    const [nivel, setNivel] = useState(2);
    const [cuantos, setCuantos] = useState(5);
    const [lista, setLista] = useState([]);
    const [idx, setIdx] = useState(0);
    const [estados, setEstados] = useState([]); // por pregunta: { estado: null|'ok'|'visto', fallado }
    const [entrada, setEntrada] = useState('');
    const [feedback, setFeedback] = useState(null);
    const [stats, setStats] = useState({ aciertos: 0, fallos: 0, skips: 0, puntos: 0 });
    const [guardado, setGuardado] = useState(false);

    const prob = lista[idx];
    const qi = estados.findIndex(e => !e.estado);
    const q = prob && qi >= 0 ? prob.preguntas[qi] : null;
    const terminado = !!prob && qi === -1;

    const preparar = (p) => { setEstados(p.preguntas.map(() => ({ estado: null, fallado: false }))); setEntrada(''); setFeedback(null); };

    const empezar = () => {
        despertarAudio();
        const l = generarProblemasNumeros(cats, cuantos, nivel);
        setLista(l); setIdx(0); setGuardado(false);
        setStats({ aciertos: 0, fallos: 0, skips: 0, puntos: 0 });
        preparar(l[0]);
        setFase('JUGANDO');
    };

    const resolver = (estado) => setEstados(es => es.map((e, i) => (i === qi ? { ...e, estado } : e)));

    const comprobar = (opcion = null) => {
        if (!q || feedback) return;
        let ok;
        if (q.tipo === 'opcion') ok = opcion === q.r;
        else {
            const v = leerNumeroEs(entrada);
            if (Number.isNaN(v)) return;
            ok = Math.abs(v - q.r) < 0.005;
        }
        const yaFallada = estados[qi]?.fallado;
        if (ok) {
            sonidoCorrecto();
            setStats(s => ({ ...s, aciertos: s.aciertos + (yaFallada ? 0 : 1), puntos: s.puntos + (yaFallada ? 5 : 10) }));
            resolver('ok'); setEntrada('');
            setFeedback('CORRECT'); setTimeout(() => setFeedback(null), 600);
        } else {
            sonidoIncorrecto();
            if (!yaFallada) {
                setStats(s => ({ ...s, fallos: s.fallos + 1 }));
                setEstados(es => es.map((e, i) => (i === qi ? { ...e, fallado: true } : e)));
            }
            setFeedback('INCORRECT'); setTimeout(() => setFeedback(null), 800);
        }
    };

    const verSolucion = () => {
        if (!q) return;
        sonidoPasar();
        setStats(s => ({ ...s, skips: s.skips + 1, fallos: s.fallos + (estados[qi]?.fallado ? 0 : 1) }));
        resolver('visto'); setEntrada('');
    };

    const siguiente = () => {
        if (idx + 1 >= lista.length) { sonidoFinal(); setFase('FIN'); return; }
        setIdx(i => i + 1); preparar(lista[idx + 1]);
    };

    const cambiarSigno = () => setEntrada(t => (t.trim().startsWith('-') || t.trim().startsWith('−') ? t.trim().slice(1) : `-${t.trim()}`));

    const chip = (activo, c) => ({ padding: '8px 14px', borderRadius: 20, border: `2px solid ${c}`, background: activo ? c : 'white', color: activo ? 'white' : c, fontWeight: 800, fontSize: '0.85rem', cursor: 'pointer' });
    const card = { background: 'white', maxWidth: 640, margin: '10px auto', padding: '22px 20px', borderRadius: 20, boxShadow: '0 15px 35px rgba(0,0,0,0.1)', boxSizing: 'border-box' };

    // ── Elegir ──
    if (fase === 'ELEGIR') return (
        <div style={{ ...card, textAlign: 'center' }}>
            <h2 style={{ color: COLOR, margin: '0 0 6px' }}>📖 Problemas de números</h2>
            <p style={{ color: '#888', fontSize: '0.88rem', margin: '0 0 16px' }}>Problemas que se resuelven con operaciones sencillas. Los números cambian cada vez.</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
                {Object.entries(CATS_PROB_NUM).map(([k, c]) => {
                    const activo = cats.includes(k);
                    return (
                        <button key={k} onClick={() => setCats(p => (p.includes(k) ? (p.length > 1 ? p.filter(x => x !== k) : p) : [...p, k]))}
                            style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 14, border: `2px solid ${c.color}`, background: activo ? c.color + '18' : 'white', cursor: 'pointer', textAlign: 'left' }}>
                            <span style={{ width: 22, height: 22, borderRadius: 6, border: `2px solid ${c.color}`, background: activo ? c.color : 'white', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: '0.8rem', flexShrink: 0 }}>{activo ? '✓' : ''}</span>
                            <span style={{ flex: 1 }}>
                                <span style={{ fontWeight: 800, color: '#2c3e50', display: 'block' }}>{c.label}</span>
                                <span style={{ fontSize: '0.8rem', color: '#888' }}>{c.desc}</span>
                            </span>
                        </button>
                    );
                })}
            </div>
            <div style={{ display: 'flex', gap: 6, justifyContent: 'center', alignItems: 'center', flexWrap: 'wrap', marginBottom: 10 }}>
                <span style={{ fontWeight: 800, color: '#555', fontSize: '0.85rem' }}>Nivel:</span>
                {[[1, '👶 Fácil'], [2, '🤓 Medio'], [3, '🔥 Números grandes']].map(([n, l]) => <button key={n} onClick={() => setNivel(n)} style={chip(nivel === n, '#7b1fa2')}>{l}</button>)}
            </div>
            <div style={{ display: 'flex', gap: 6, justifyContent: 'center', alignItems: 'center', flexWrap: 'wrap', marginBottom: 18 }}>
                <span style={{ fontWeight: 800, color: '#555', fontSize: '0.85rem' }}>Problemas:</span>
                {[3, 5, 8, 10].map(n => <button key={n} onClick={() => setCuantos(n)} style={chip(cuantos === n, '#009688')}>{n}</button>)}
            </div>
            <button onClick={empezar} style={{ padding: '14px 30px', borderRadius: 30, border: 'none', background: COLOR, color: 'white', fontWeight: 900, fontSize: '1.05rem', cursor: 'pointer', boxShadow: `0 5px 14px ${COLOR}55` }}>▶ Empezar</button>
            <div style={{ marginTop: 14 }}>
                <button onClick={onSalir} style={{ padding: '10px 22px', borderRadius: 30, border: '2px solid #bdc3c7', background: 'white', color: '#7f8c8d', fontWeight: 800, cursor: 'pointer' }}>← Menú</button>
            </div>
        </div>
    );

    // ── Resultados ──
    if (fase === 'FIN') {
        const intentos = stats.aciertos + stats.fallos;
        const btn = (bg) => ({ padding: '12px 22px', borderRadius: 30, border: 'none', background: bg, color: 'white', fontWeight: 800, cursor: 'pointer', width: '100%', maxWidth: 300 });
        return (
            <div style={{ ...card, maxWidth: 480, textAlign: 'center' }}>
                <Trophy size={64} color="#f1c40f" style={{ marginBottom: 10 }} />
                <h2 style={{ color: '#2c3e50', margin: '0 0 6px' }}>¡Problemas terminados!</h2>
                <div style={{ fontSize: '3rem', fontWeight: 900, color: COLOR }}>{stats.puntos}</div>
                <div style={{ color: '#7f8c8d', marginBottom: 14 }}>✅ {stats.aciertos} a la primera · ❌ {stats.fallos} · {Math.round((stats.aciertos / Math.max(1, intentos)) * 100)} %</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center' }}>
                    <button onClick={empezar} style={btn(COLOR)}>🔁 Otros problemas</button>
                    <button onClick={() => setFase('ELEGIR')} style={btn('#7f8c8d')}>⚙️ Cambiar opciones</button>
                    <button disabled={guardado} onClick={() => {
                        guardarRegistroLocal('CALCULO', { titulo: 'Cálculo Mental · Problemas', aciertos: stats.aciertos, intentos, nombre: usuario?.nombre || usuario?.displayName || '', curso: '', via: 'local' });
                        setGuardado(true);
                    }} style={btn(guardado ? '#95a5a6' : '#16a085')}>{guardado ? '✅ Guardado' : '💾 Guardar en mis registros'}</button>
                    <button onClick={() => onEnviar({ ...stats, config: { operaciones: { problemas: true }, tipos: Object.fromEntries(cats.map(c => [c, true])), minNum: null, maxNum: null, tiempo: null, numEjercicios: lista.length, nivel } })}
                        style={btn('linear-gradient(135deg,#27ae60,#2ecc71)')}>📤 Enviar al profesor</button>
                </div>
            </div>
        );
    }

    // ── Resolviendo ──
    const cat = CATS_PROB_NUM[prob.cat];
    const borde = feedback === 'CORRECT' ? '#2ecc71' : feedback === 'INCORRECT' ? '#e74c3c' : 'transparent';
    return (
        <div style={{ ...card, border: `4px solid ${borde}`, transition: 'border-color 0.2s' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
                <span style={{ padding: '3px 12px', borderRadius: 20, background: cat.color + '22', color: cat.color, fontWeight: 800, fontSize: '0.78rem' }}>{cat.label}</span>
                <span style={{ fontWeight: 800, color: COLOR, fontSize: '0.85rem' }}>Problema {idx + 1}/{lista.length} · 🏆 {stats.puntos}</span>
            </div>
            <div style={{ display: 'flex', gap: 10, background: '#fdf2f6', border: '2px solid #f8bbd0', borderRadius: 14, padding: '12px 14px', marginBottom: 14 }}>
                <span style={{ fontSize: '1.8rem' }}>{prob.emoji}</span>
                <p style={{ margin: 0, color: '#2c3e50', fontSize: isMobile ? '0.95rem' : '1.05rem', lineHeight: 1.5, fontWeight: 600 }}>{prob.texto}</p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {prob.preguntas.map((pq, i) => {
                    if (qi !== -1 && i > qi) return null;
                    const e = estados[i] || {};
                    const actual = i === qi;
                    return (
                        <div key={i} style={{ borderRadius: 12, padding: '10px 12px', border: `2px solid ${actual ? '#f48fb1' : e.estado === 'ok' ? '#a5d6a7' : '#ffe0b2'}`, background: actual ? 'white' : e.estado === 'ok' ? '#f1f8e9' : '#fff8e1' }}>
                            <div style={{ fontWeight: 800, color: '#2c3e50', fontSize: '0.92rem', marginBottom: actual ? 8 : 2 }}>{i + 1}) {pq.p}</div>
                            {!actual && <div style={{ fontWeight: 900, color: e.estado === 'ok' ? '#27ae60' : '#e67e22' }}>{e.estado === 'ok' ? '✅' : '👀'} {textoRespuestaNum(pq)}</div>}
                            {actual && (
                                <>
                                    {pq.tipo === 'opcion' ? (
                                        <div style={{ display: 'flex', gap: 8 }}>
                                            {pq.opciones.map(o => <button key={o} onClick={() => comprobar(o)} disabled={!!feedback} style={{ padding: '10px 24px', borderRadius: 12, border: `2px solid ${COLOR}`, background: 'white', color: COLOR, fontWeight: 900, fontSize: '1.1rem', cursor: 'pointer' }}>{o}</button>)}
                                        </div>
                                    ) : (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                            {prob.cat === 'enteros' && (
                                                <button onClick={cambiarSigno} title="Cambiar el signo" style={{ width: 46, height: 46, borderRadius: 12, border: '2px solid #c0392b', background: 'white', color: '#c0392b', fontWeight: 900, fontSize: '1.2rem', cursor: 'pointer' }}>±</button>
                                            )}
                                            <input value={entrada} onChange={ev => setEntrada(ev.target.value)} onKeyDown={ev => ev.key === 'Enter' && comprobar()}
                                                inputMode="decimal" placeholder="?" autoFocus
                                                style={{ padding: '10px 12px', borderRadius: 12, border: '2px solid #f48fb1', fontSize: '1.3rem', fontWeight: 800, textAlign: 'center', width: 150, outline: 'none', color: '#2c3e50' }} />
                                            {pq.unidad && <span style={{ fontWeight: 800, color: '#7f8c8d' }}>{pq.unidad}</span>}
                                        </div>
                                    )}
                                    <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                                        {pq.tipo !== 'opcion' && (
                                            <button onClick={() => comprobar()} style={{ background: '#27ae60', color: 'white', border: 'none', borderRadius: 14, padding: '10px 18px', fontSize: '1rem', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, boxShadow: '0 4px 0 #1e8449' }}><CheckCircle size={18} /> Comprobar</button>
                                        )}
                                        <button onClick={verSolucion} style={{ padding: '10px 14px', borderRadius: 14, border: '2px solid #f39c12', background: 'white', color: '#e67e22', fontWeight: 800, cursor: 'pointer' }}>👀 Ver solución</button>
                                    </div>
                                    {feedback === 'INCORRECT' && <div style={{ marginTop: 8, color: '#e74c3c', fontWeight: 800 }}>❌ No es correcto, revísalo</div>}
                                    {prob.cat === 'decimales' && <div style={{ marginTop: 6, fontSize: '0.75rem', color: '#999' }}>Usa la coma para los decimales: 12,50</div>}
                                </>
                            )}
                        </div>
                    );
                })}
            </div>

            {terminado && (
                <div style={{ marginTop: 14, background: '#e8f5e9', borderRadius: 14, padding: '12px 14px', border: '2px solid #a5d6a7' }}>
                    <div style={{ fontWeight: 900, color: '#27ae60', marginBottom: 8 }}>🪜 Resolución</div>
                    <ol style={{ margin: 0, paddingLeft: 20, color: '#2c3e50', fontWeight: 600, fontSize: '0.92rem', lineHeight: 1.6 }}>
                        {prob.explicacion.map((t, i) => <li key={i}>{t}</li>)}
                    </ol>
                    <div style={{ display: 'flex', justifyContent: 'center', marginTop: 14 }}>
                        <button onClick={siguiente} style={{ background: '#27ae60', color: 'white', border: 'none', borderRadius: 14, padding: '12px 26px', fontSize: '1.05rem', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 4px 0 #1e8449' }}>
                            {idx + 1 >= lista.length ? '🏁 Ver resultados' : 'Siguiente problema ›'}
                        </button>
                    </div>
                </div>
            )}

            <div style={{ textAlign: 'center', marginTop: 14 }}>
                <button onClick={() => setFase('ELEGIR')} style={{ padding: '9px 20px', borderRadius: 30, border: '2px solid #bdc3c7', background: 'white', color: '#7f8c8d', fontWeight: 800, cursor: 'pointer', fontSize: '0.85rem' }}>← Opciones</button>
            </div>
        </div>
    );
}
