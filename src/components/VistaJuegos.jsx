// Previsualización de cada pregunta en los juegos donde se puede usar el recurso.
// Maquetas pequeñas (aproximadas) que usan la MISMA regla de letra que los juegos (utils/encajeTexto),
// y un resumen de cuántas preguntas pueden no verse bien en cada juego.
import { useMemo, useState } from 'react';
import { PERFILES_JUEGO, JUEGOS_DE_TIPO, factorLetra, revisarPregunta, revisarRecurso, textosDePregunta, limitesJuego } from '../utils/encajeTexto';

const px = (base, texto, el) => (el ? Math.max(6, base * factorLetra(texto, el.cabe, el.min)) : base);
const corta = (s, n) => (s.length > n ? s.slice(0, n - 1) + '…' : s);
const clamp = (lineas) => ({ display: '-webkit-box', WebkitLineClamp: lineas, WebkitBoxOrient: 'vertical', overflow: 'hidden' });

function opcionesDe(t) {
    const r = t.respuestas.slice(0, 4);
    while (r.length < 2) r.push('…');
    return r;
}

// ─── Maquetas (≈ 1/4 de la pantalla real) ────────────────────────────────────
function Maqueta({ juego, t, p }) {
    const perfil = PERFILES_JUEGO[juego];
    const P = perfil.pregunta, R = perfil.respuesta;
    const ops = opcionesDe(t);
    const enun = t.enunciado || '¿…?';
    switch (juego) {
        case 'BURBUJAS': return (
            <div style={{ height: '100%', background: 'linear-gradient(#2f3640,#1e272e)', position: 'relative' }}>
                <div style={{ background: 'rgba(0,0,0,0.85)', color: '#fff', fontWeight: 700, textAlign: 'center', padding: '4px 6px', fontSize: px(9, enun, P), lineHeight: 1.1, ...clamp(factorLetra(enun, P.cabe, P.min) < 1 ? 3 : 2) }}>{enun}</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center', padding: 8 }}>
                    {ops.map((o, i) => {
                        const largo = factorLetra(o, R.cabe, R.min) < 1;
                        const d = largo ? 50 : 42;
                        return <div key={i} style={{ width: d, height: d, borderRadius: '50%', background: ['#ff4757', '#2ecc71', '#00d2d3', '#ffa502'][i], color: '#fff', fontWeight: 700, fontSize: px(9, o, R), lineHeight: 1.05, display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: 3, boxSizing: 'border-box', overflow: 'hidden', overflowWrap: 'anywhere' }}>{o}</div>;
                    })}
                </div>
            </div>
        );
        case 'TEST': return (
            <div style={{ height: '100%', background: '#2f3640' }}>
                <div style={{ background: 'rgba(0,0,0,0.85)', color: '#fff', fontWeight: 700, textAlign: 'center', padding: '4px 6px', fontSize: px(9, enun, P), lineHeight: 1.1, ...clamp(3) }}>{enun}</div>
                <div style={{ padding: '5px 10px', display: 'flex', flexDirection: 'column', gap: 3 }}>
                    {ops.map((o, i) => <div key={i} style={{ background: '#fff', borderLeft: '3px solid #ccc', borderRadius: 3, padding: '2px 5px', fontSize: px(7.5, o, R), fontWeight: 700, color: '#333', ...clamp(2) }}>{o}</div>)}
                </div>
            </div>
        );
        case 'PIKATRON': return (
            <div style={{ height: '100%', background: 'linear-gradient(#87ceeb,#bfe9ff)', position: 'relative' }}>
                <div style={{ margin: 4, background: '#fff', borderRadius: 5, padding: '3px 6px', color: '#333', fontWeight: 700, fontSize: px(8, enun, P), lineHeight: 1.15, textAlign: 'center' }}>{enun}</div>
                <div style={{ position: 'absolute', bottom: 12, left: 0, right: 0, display: 'flex', justifyContent: 'space-around', alignItems: 'flex-end', padding: '0 4px' }}>
                    {ops.map((o, i) => {
                        const w = Math.min(150, 100 + Math.max(0, o.length - 10) * 4) / 2.6;
                        return <div key={i} style={{ width: w, height: 16, background: ['#3498db', '#e67e22', '#9b59b6', '#e74c3c'][i], border: '1px solid #fff', color: '#fff', fontWeight: 700, fontSize: Math.max(4, 6.2 * factorLetra(o, R.cabe, R.min)), lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', overflow: 'hidden', ...clamp(2) }}>{o}</div>;
                    })}
                </div>
                <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 12, background: '#6ab04c' }} />
            </div>
        );
        case 'PLATAFORMAS': return (
            <div style={{ height: '100%', background: 'linear-gradient(#1e3c72,#2a5298)', padding: 6, boxSizing: 'border-box', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                <div style={{ background: 'rgba(0,0,0,0.9)', border: '1px solid #f1c40f', color: '#f1c40f', borderRadius: 4, padding: '2px 5px', fontWeight: 700, fontSize: enun.length > 45 ? 6 : 7, textAlign: 'center', maxWidth: '90%', ...clamp(4) }}>{enun}</div>
                <div style={{ display: 'flex', gap: 3, marginTop: 'auto', marginBottom: 14 }}>
                    {ops.map((o, i) => <div key={i} style={{ width: 40, height: 26, borderRadius: 3, background: ['#e74c3c', '#3498db', '#2ecc71', '#f39c12'][i], color: '#111', fontWeight: 700, fontSize: o.length > 22 ? 5 : 6, lineHeight: 1.1, display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', overflow: 'hidden', padding: 1, boxSizing: 'border-box', ...clamp(3) }}>{o}</div>)}
                </div>
            </div>
        );
        case 'PASAPALABRA': return (
            <div style={{ height: '100%', background: '#1a237e', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: 6, boxSizing: 'border-box', gap: 4 }}>
                <div style={{ width: 22, height: 22, borderRadius: '50%', background: '#3498db', color: '#fff', fontWeight: 900, fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{(p?.letra || t.respuestas[0]?.[0] || 'A').toUpperCase()}</div>
                <div style={{ height: factorLetra(enun, P.cabe, P.min) < 1 ? 50 : 40, overflow: 'auto', color: '#ecf0f1', fontSize: px(8, enun, P), lineHeight: 1.3, width: '95%', textAlign: 'center' }}>{enun}</div>
                <div style={{ width: '80%', background: '#fff', borderRadius: 10, padding: '3px 6px', fontSize: 7, color: '#999', textAlign: 'center' }}>Respuesta… <span style={{ color: '#2c3e50' }}>({t.respuestas[0]?.length || 0} letras)</span></div>
            </div>
        );
        case 'APAREJADOS': return (
            <div style={{ height: '100%', background: '#27ae60', display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'center' }}>
                {ops.slice(0, 2).map((o, i) => <div key={i} style={{ width: 44, height: 58, background: '#ecf0f1', border: '1px solid #bdc3c7', borderRadius: 4, color: '#2c3e50', fontWeight: 700, fontSize: px(9, o, R), lineHeight: 1.1, display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: 2, boxSizing: 'border-box', overflow: 'hidden', overflowWrap: 'anywhere' }}>{o}</div>)}
            </div>
        );
        case 'BUNKER': return (
            <div style={{ height: '100%', background: 'radial-gradient(#1b2a2f,#05070a)', position: 'relative', fontFamily: 'Courier New, monospace' }}>
                <div style={{ margin: '6px auto 0', maxWidth: '80%', background: 'rgba(5,7,10,.6)', border: '1px solid #263238', color: '#e7f3ec', fontSize: px(7.5, enun, P), textAlign: 'center', padding: '2px 4px' }}>{enun}</div>
                <div style={{ position: 'absolute', bottom: 10, left: 0, right: 0, display: 'flex', justifyContent: 'space-around', alignItems: 'flex-end' }}>
                    {ops.map((o, i) => <div key={i} style={{ background: 'rgba(5,7,10,.88)', border: '1px solid #7fffb0', color: '#fff', fontWeight: 700, fontSize: 6, padding: '1px 3px', maxWidth: 70, textAlign: 'center', lineHeight: 1.1 }}>{o}</div>)}
                </div>
            </div>
        );
        case 'INVASORES': return (
            <div style={{ height: '100%', background: '#020617', padding: 5, boxSizing: 'border-box' }}>
                <div style={{ color: '#a5f3fc', fontWeight: 700, textAlign: 'center', fontSize: enun.length <= 30 ? 11 : enun.length <= 60 ? 9 : 7.5, lineHeight: 1.05, ...clamp(3) }}>{enun}</div>
                <div style={{ display: 'flex', justifyContent: 'space-around', marginTop: 8 }}>
                    {ops.map((o, i) => (
                        <div key={i} style={{ width: 42, textAlign: 'center' }}>
                            <div style={{ fontSize: 14 }}>👾</div>
                            <div style={{ border: `1px solid ${['#f472b6', '#4ade80', '#60a5fa', '#facc15'][i]}`, background: '#0f172a', color: '#f8fafc', fontSize: px(8, o, R), lineHeight: 1.05, padding: 1, overflowWrap: 'anywhere', ...clamp(factorLetra(o, R.cabe, R.min) < 1 ? 3 : 2) }}>{o}</div>
                        </div>
                    ))}
                </div>
            </div>
        );
        default: { // Money Board, Luz roja, Ruleta, PiLive: pregunta grande + botones
            const fondos = { MONEYBOARD: '#0b1a3a', CALAMAR: '#0b1210', RULETA: '#fff', PILIVE_SOLO: '#46178f' };
            const claro = juego === 'RULETA';
            const base = { MONEYBOARD: 10, CALAMAR: 9, RULETA: 8.5, PILIVE_SOLO: 9.5 }[juego] || 9;
            return (
                <div style={{ height: '100%', background: fondos[juego], padding: 6, boxSizing: 'border-box', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 6 }}>
                    <div style={{ color: claro ? '#333' : '#fff', fontWeight: 800, textAlign: 'center', fontSize: px(base, enun, P), lineHeight: 1.25 }}>{enun}</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
                        {ops.map((o, i) => <div key={i} style={{ background: claro ? '#fff' : juego === 'CALAMAR' ? '#e6317f' : 'rgba(255,255,255,0.12)', border: claro ? '1px solid #ddd' : 'none', borderRadius: 5, color: claro ? '#555' : '#fff', fontWeight: 700, fontSize: px(7, o, R), padding: '3px 4px', textAlign: 'center' }}>{o}</div>)}
                    </div>
                </div>
            );
        }
    }
}

function TarjetaJuego({ juego, p }) {
    const perfil = PERFILES_JUEGO[juego];
    const t = textosDePregunta(p);
    const r = revisarPregunta(p, juego);
    return (
        <div style={{ border: `2px solid ${r.ok ? '#bbf7d0' : '#fcd34d'}`, borderRadius: 12, overflow: 'hidden', background: '#fff', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '6px 9px', fontWeight: 800, fontSize: '0.82rem', color: '#1e293b', display: 'flex', justifyContent: 'space-between', gap: 6 }}>
                <span>{perfil.icono} {perfil.nombre}</span>
                <span style={{ color: r.ok ? '#16a34a' : '#b45309' }}>{r.ok ? '✓' : '⚠'}</span>
            </div>
            <div style={{ height: 150, overflow: 'hidden', fontFamily: 'system-ui, sans-serif' }}><Maqueta juego={juego} t={t} p={p} /></div>
            <div style={{ padding: '6px 9px', fontSize: '0.74rem', lineHeight: 1.35, color: r.ok ? '#15803d' : '#b45309', minHeight: 30 }}>
                {r.ok ? 'Se ve entera' : r.problemas.join(' · ')}
            </div>
        </div>
    );
}

/** Rejilla con una pregunta vista en todos los juegos de su tipo. */
export function VistaPreguntaEnJuegos({ pregunta, tipoJuego }) {
    const juegos = JUEGOS_DE_TIPO[String(tipoJuego || '').toUpperCase()] || [];
    if (!pregunta || !juegos.length) return null;
    return (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10 }}>
            {juegos.map(j => <TarjetaJuego key={j} juego={j} p={pregunta} />)}
        </div>
    );
}

/** Ventana con todas las preguntas del recurso: elige una y la ves en cada juego. */
export function ModalVistaJuegos({ recurso, tipoJuego, onClose }) {
    const juegos = useMemo(() => JUEGOS_DE_TIPO[String(tipoJuego || '').toUpperCase()] || [], [tipoJuego]);
    const lista = useMemo(() => {
        const hojas = Array.isArray(recurso?.hojas) ? recurso.hojas : [];
        return hojas.flatMap((h, hi) => (h.preguntas || []).map((p, i) => ({ p, hoja: h.nombreHoja || h.nombre || `Hoja ${hi + 1}`, i })))
            .filter(x => { const t = textosDePregunta(x.p); return !t.omitir && (t.enunciado || t.respuestas.length); })
            .map(x => ({ ...x, malos: juegos.filter(j => !revisarPregunta(x.p, j).ok) }));
    }, [recurso, juegos]);
    const resumen = useMemo(() => juegos.map(j => ({ j, ...revisarRecurso(recurso, j) })), [recurso, juegos]);
    const [sel, setSel] = useState(() => Math.max(0, lista.findIndex(x => x.malos.length)));
    const [soloMalas, setSoloMalas] = useState(false);
    const visibles = lista.map((x, k) => ({ ...x, k })).filter(x => !soloMalas || x.malos.length);
    const actual = lista[sel] || lista[0];

    return (
        <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 10060, background: 'rgba(15,23,42,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 12, fontFamily: 'system-ui, sans-serif' }}>
            <div onClick={e => e.stopPropagation()} style={{ background: '#f8fafc', borderRadius: 18, width: '100%', maxWidth: 1100, maxHeight: '94vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 25px 70px rgba(0,0,0,0.45)' }}>
                <div style={{ padding: '14px 18px', background: '#fff', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 900, fontSize: '1.1rem', color: '#0f172a' }}>👁 Cómo se verá en cada juego</div>
                        <div style={{ fontSize: '0.8rem', color: '#64748b' }}>Vista aproximada. Las preguntas marcadas con ⚠ pueden no leerse enteras: al jugar se podrán excluir.</div>
                    </div>
                    <button onClick={onClose} style={{ border: 'none', background: '#e2e8f0', borderRadius: 10, padding: '8px 12px', cursor: 'pointer', fontWeight: 700 }}>✕ Cerrar</button>
                </div>

                <div style={{ padding: '10px 18px', display: 'flex', flexWrap: 'wrap', gap: 6, background: '#fff', borderBottom: '1px solid #e2e8f0' }}>
                    {resumen.map(({ j, total, largas }) => {
                        const lim = limitesJuego(j);
                        return (
                            <span key={j} title={`Máximo aproximado: pregunta ${lim.pregunta ?? '—'} letras · cada respuesta ${lim.respuesta ?? '—'} letras`}
                                style={{ fontSize: '0.78rem', fontWeight: 700, padding: '4px 9px', borderRadius: 99, background: largas.length ? '#fef3c7' : '#dcfce7', color: largas.length ? '#92400e' : '#166534' }}>
                                {PERFILES_JUEGO[j].icono} {PERFILES_JUEGO[j].nombre}: {largas.length ? `${largas.length}/${total} ⚠` : 'todo bien ✓'}
                            </span>
                        );
                    })}
                </div>

                {!lista.length ? (
                    <div style={{ padding: 30, textAlign: 'center', color: '#64748b' }}>Todavía no hay preguntas que previsualizar.</div>
                ) : (
                    <div style={{ display: 'flex', flexWrap: 'wrap', minHeight: 0, flex: 1, overflow: 'auto' }}>
                        <div style={{ flex: '1 1 240px', maxWidth: 320, borderRight: '1px solid #e2e8f0', background: '#fff', maxHeight: '70vh', overflowY: 'auto' }}>
                            <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: '0.8rem', padding: '8px 12px', color: '#475569', borderBottom: '1px solid #f1f5f9' }}>
                                <input type="checkbox" checked={soloMalas} onChange={e => setSoloMalas(e.target.checked)} /> Solo las que tienen ⚠
                            </label>
                            {visibles.map(x => {
                                const t = textosDePregunta(x.p);
                                return (
                                    <button key={x.k} onClick={() => setSel(x.k)}
                                        style={{ display: 'block', width: '100%', textAlign: 'left', border: 'none', borderBottom: '1px solid #f1f5f9', padding: '8px 12px', cursor: 'pointer', background: x.k === sel ? '#e0f2fe' : 'transparent', fontFamily: 'inherit' }}>
                                        <div style={{ fontSize: '0.7rem', color: '#64748b' }}>{x.hoja} · n.º {x.i + 1} {x.malos.length ? <b style={{ color: '#b45309' }}>· ⚠ {x.malos.length} juego{x.malos.length > 1 ? 's' : ''}</b> : <span style={{ color: '#16a34a' }}>· ✓</span>}</div>
                                        <div style={{ fontSize: '0.84rem', color: '#0f172a' }}>{corta(t.enunciado || t.respuestas.join(' / '), 80)}</div>
                                    </button>
                                );
                            })}
                            {!visibles.length && <div style={{ padding: 14, fontSize: '0.85rem', color: '#16a34a' }}>✓ Todas las preguntas se ven bien.</div>}
                        </div>
                        <div style={{ flex: '3 1 420px', padding: 14, minWidth: 0 }}>
                            {actual && <VistaPreguntaEnJuegos pregunta={actual.p} tipoJuego={tipoJuego} />}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

/** Botón flotante «Ver en los juegos» para cualquier editor (no hace falta tocar el editor). */
export default function BotonVistaJuegos({ recurso, tipoJuego, zIndex = 7000, estilo }) {
    const [abierto, setAbierto] = useState(false);
    const juegos = useMemo(() => JUEGOS_DE_TIPO[String(tipoJuego || '').toUpperCase()] || [], [tipoJuego]);
    const avisos = useMemo(() => {
        if (!juegos.length) return 0;
        try { return juegos.reduce((n, j) => n + (revisarRecurso(recurso, j).largas.length ? 1 : 0), 0); } catch { return 0; }
    }, [recurso, juegos]);
    if (!juegos.length) return null;
    return (
        <>
            <button onClick={() => setAbierto(true)} title="Previsualiza cada pregunta en los juegos donde se puede usar"
                style={{ position: 'fixed', left: 16, bottom: 16, zIndex, border: 'none', borderRadius: 99, padding: '11px 16px', cursor: 'pointer', fontWeight: 800, fontSize: '0.9rem', color: '#fff', background: avisos ? 'linear-gradient(135deg,#f59e0b,#d97706)' : 'linear-gradient(135deg,#6366f1,#4f46e5)', boxShadow: '0 6px 20px rgba(0,0,0,0.3)', fontFamily: 'system-ui, sans-serif', ...estilo }}>
                👁 Ver en los juegos{avisos ? ` · ⚠ ${avisos}` : ''}
            </button>
            {abierto && <ModalVistaJuegos recurso={recurso} tipoJuego={tipoJuego} onClose={() => setAbierto(false)} />}
        </>
    );
}
