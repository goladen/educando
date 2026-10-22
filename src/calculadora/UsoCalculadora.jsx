// «Uso de la calculadora» (Math World): retos contextualizados, secuencias de
// teclas de la Casio fx-82MS y series para descubrir regularidades.
// Se usa como herramienta propia (tarjeta CALCULADORA, ruta /calculadora) y
// embebida en otras apps de Math World con `bloques` filtrados (BotonCalculadora).
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { BLOQUES } from './retosCalculadora';
import Fx82MS, { ChipsTeclas, useAnimacionTeclas } from './Fx82MS';
import { comprobar, formatear } from './respuestas';
import { sonidoCorrecto, sonidoIncorrecto } from '../utils/sonidosFeedback';
import { guardarRegistroLocal } from '../utils/registrosLocales';
import { appsDeBloque, urlCalculadora } from './appsCalculadora';
import { ModalFichaCalculadora, ModalCompartirCalculadora } from './FichaCalculadora';

const KEY_PROGRESO = 'pikt_calculadora_progreso';

const leerProgreso = () => {
    try { return JSON.parse(localStorage.getItem(KEY_PROGRESO)) || {}; } catch { return {}; }
};
const guardarProgreso = (p) => {
    try { localStorage.setItem(KEY_PROGRESO, JSON.stringify(p)); } catch { /* sin almacenamiento */ }
};

const useAncho = () => {
    const [w, setW] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200);
    useEffect(() => {
        const f = () => setW(window.innerWidth);
        window.addEventListener('resize', f);
        return () => window.removeEventListener('resize', f);
    }, []);
    return w;
};

const btn = (bg, color = '#fff') => ({
    background: bg, color, border: 'none', borderRadius: 10, padding: '8px 14px',
    fontWeight: 800, cursor: 'pointer', fontSize: 14, fontFamily: 'inherit',
});
const tarjeta = { background: '#fff', borderRadius: 16, padding: 16, boxShadow: '0 2px 10px #0001', marginBottom: 14 };

export default function UsoCalculadora({ onExit, bloques, embebido = false, bloqueInicial = null, itemInicial = null, appOrigen = null }) {
    const lista = useMemo(() => (bloques?.length ? BLOQUES.filter(b => bloques.includes(b.id)) : BLOQUES), [bloques]);
    const [bloqueId, setBloqueId] = useState(bloqueInicial || (lista.length === 1 ? lista[0].id : null));
    const [progreso, setProgreso] = useState(leerProgreso);
    const [modal, setModal] = useState(null); // { tipo: 'ficha'|'compartir', bloque?, url?, titulo? }
    const ancho = useAncho();
    const movil = ancho < 820;

    // Como herramienta propia, la URL refleja el bloque abierto (/calculadora/<bloque>)
    useEffect(() => {
        if (embebido) return;
        const destino = `/calculadora${bloqueId ? `/${bloqueId}` : ''}`;
        if (window.location.pathname !== destino) window.history.replaceState({}, '', destino + window.location.search);
    }, [bloqueId, embebido]);

    const compartir = (bloqueC, item) => setModal({
        tipo: 'compartir',
        url: urlCalculadora(bloqueC?.id, item?.id),
        titulo: item ? `🧮 ${bloqueC.titulo} · ${item.titulo}` : bloqueC ? `🧮 Calculadora · ${bloqueC.titulo}` : '🧮 Uso de la calculadora',
    });
    const ficha = (bloqueF) => setModal({ tipo: 'ficha', bloque: bloqueF });
    // Ir a una app de Math World donde se trabaja el mismo contenido
    const irApp = (ruta) => {
        if (embebido) onExit?.();
        window.history.pushState({}, '', ruta);
        window.dispatchEvent(new Event('popstate'));
    };

    const marcar = (id, datos) => setProgreso(p => {
        const n = { ...p, [id]: { ...(p[id] || {}), ...datos } };
        guardarProgreso(n);
        return n;
    });

    const bloque = lista.find(b => b.id === bloqueId);

    return (
        <div style={{
            position: embebido ? 'relative' : 'fixed', inset: embebido ? undefined : 0, zIndex: embebido ? undefined : 9999,
            background: '#eef6f4', overflowY: 'auto', minHeight: embebido ? '100%' : undefined,
            fontFamily: "'Segoe UI', Tahoma, sans-serif", color: '#0f172a',
        }}>
            <div style={{ maxWidth: 1150, margin: '0 auto', padding: movil ? '12px 12px 40px' : '18px 20px 40px' }}>
                <Cabecera
                    titulo={bloque ? `${bloque.emoji} ${bloque.titulo}` : '🧮 Uso de la calculadora'}
                    onVolver={bloque && lista.length > 1 ? () => setBloqueId(null) : onExit}
                    textoVolver={bloque && lista.length > 1 ? '← Bloques' : '← Salir'}
                />
                {bloque
                    ? <VistaBloque key={bloque.id} bloque={bloque} progreso={progreso} marcar={marcar} movil={movil}
                        itemInicial={bloque.id === bloqueInicial ? itemInicial : null}
                        apps={appsDeBloque(bloque.id).filter(a => a.id !== appOrigen)} irApp={irApp}
                        onCompartir={(item) => compartir(bloque, item)} onFicha={() => ficha(bloque)} />
                    : <Inicio lista={lista} progreso={progreso} onElegir={setBloqueId} onCompartir={compartir} onFicha={ficha} />}
                {modal?.tipo === 'ficha' && <ModalFichaCalculadora bloque={modal.bloque} onClose={() => setModal(null)} />}
                {modal?.tipo === 'compartir' && <ModalCompartirCalculadora url={modal.url} titulo={modal.titulo} onClose={() => setModal(null)} />}
            </div>
        </div>
    );
}

function Cabecera({ titulo, onVolver, textoVolver }) {
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
            {onVolver && <button onClick={onVolver} style={btn('#0f766e')}>{textoVolver}</button>}
            <h2 style={{ margin: 0, fontSize: 'clamp(20px, 4vw, 28px)' }}>{titulo}</h2>
            <span style={{ marginLeft: 'auto', fontSize: 12, fontWeight: 700, color: '#475569', background: '#fff', borderRadius: 20, padding: '4px 10px' }}>
                Modelo: Casio fx-82MS
            </span>
        </div>
    );
}

// ─────────────────────────────── Pantalla de inicio
const miniBtn = { background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 8, padding: '3px 7px', cursor: 'pointer', fontSize: 15 };

function Inicio({ lista, progreso, onElegir, onCompartir, onFicha }) {
    return (
        <>
            <div style={{ ...tarjeta, background: '#0f766e', color: '#fff' }}>
                <b style={{ fontSize: 17 }}>No se trata solo de calcular: se trata de descubrir.</b>
                <p style={{ margin: '6px 0 0', lineHeight: 1.5 }}>
                    En cada bloque hay <b>🎯 retos</b> con una situación real, la <b>🎹 secuencia de teclas</b> exacta en la fx-82MS
                    y <b>🔍 series de cálculos</b> para encontrar regularidades. Ten tu calculadora a mano.
                </p>
                <details style={{ marginTop: 8 }}>
                    <summary style={{ cursor: 'pointer', fontWeight: 800 }}>⚙️ Antes de empezar: deja la calculadora lista</summary>
                    <ul style={{ margin: '6px 0 0', lineHeight: 1.6 }}>
                        <li>Borrar todo (modos y memorias): <b>SHIFT MODE (CLR) 3 = AC</b>.</li>
                        <li>Modo de cálculo normal: <b>MODE 1</b> (COMP).</li>
                        <li>Ángulos en grados (aparece una D arriba): <b>MODE MODE 1</b> (Deg).</li>
                        <li>Mostrar los números de forma normal: <b>MODE MODE MODE 3 1</b> (Norm 1).</li>
                    </ul>
                </details>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: 14 }}>
                {lista.map(b => {
                    const total = b.retos.length + b.regularidades.length;
                    const hechos = [...b.retos, ...b.regularidades].filter(x => progreso[x.id]?.ok).length;
                    const apps = appsDeBloque(b.id);
                    return (
                        <div key={b.id} role="button" tabIndex={0} onClick={() => onElegir(b.id)}
                            onKeyDown={e => e.key === 'Enter' && onElegir(b.id)} style={{
                            ...tarjeta, marginBottom: 0, textAlign: 'left', cursor: 'pointer', border: `3px solid ${b.color}22`,
                            borderTop: `6px solid ${b.color}`, position: 'relative',
                        }}>
                            <div style={{ position: 'absolute', top: 8, right: 8, display: 'flex', gap: 4 }}>
                                <button onClick={e => { e.stopPropagation(); onFicha(b); }} title="Ficha PDF para imprimir" style={miniBtn}>📄</button>
                                <button onClick={e => { e.stopPropagation(); onCompartir(b); }} title="Compartir este bloque" style={miniBtn}>🔗</button>
                            </div>
                            <div style={{ fontSize: 34 }}>{b.emoji}</div>
                            <div style={{ fontWeight: 900, fontSize: 17, margin: '4px 0' }}>{b.titulo}</div>
                            <div style={{ fontSize: 13, color: '#475569', minHeight: 36 }}>{b.descripcion}</div>
                            <div style={{ marginTop: 10, height: 8, background: '#e2e8f0', borderRadius: 4, overflow: 'hidden' }}>
                                <div style={{ width: `${(hechos / total) * 100}%`, height: '100%', background: b.color, transition: 'width .3s' }} />
                            </div>
                            <div style={{ fontSize: 12, fontWeight: 700, color: '#64748b', marginTop: 4 }}>
                                {hechos}/{total} · {b.retos.length} retos · {b.regularidades.length} regularidades
                            </div>
                            {apps.length > 0 && (
                                <div style={{ fontSize: 11.5, color: '#64748b', marginTop: 6 }}>
                                    También en: {apps.map(a => `${a.emoji} ${a.nombre}`).join(' · ')}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </>
    );
}

// ─────────────────────────────── Un bloque
function VistaBloque({ bloque, progreso, marcar, movil, itemInicial, apps, irApp, onCompartir, onFicha }) {
    // ?item=<id> abre directamente ese reto o regularidad
    const posInicial = (() => {
        const r = bloque.retos.findIndex(x => x.id === itemInicial);
        if (r >= 0) return ['retos', r];
        const g = bloque.regularidades.findIndex(x => x.id === itemInicial);
        if (g >= 0) return ['regularidades', g];
        return ['retos', 0];
    })();
    const [pestana, setPestana] = useState(posInicial[0]);
    const [idx, setIdx] = useState(posInicial[1]);
    const [secuencia, setSecuencia] = useState({ teclas: '', pantalla: '' });
    const anim = useAnimacionTeclas(secuencia.teclas);
    const registrado = useRef(false);
    const calcRef = useRef(null);

    const verTeclas = (teclas, pantalla) => {
        setSecuencia({ teclas, pantalla });
        // en móvil la calculadora queda debajo: llevar la vista hasta ella
        if (movil) setTimeout(() => calcRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50);
    };
    useEffect(() => { if (secuencia.teclas) anim.reproducir(); }, [secuencia]); // eslint-disable-line react-hooks/exhaustive-deps

    // Registro local («Mis registros») al completar todos los retos del bloque
    useEffect(() => {
        if (registrado.current) return;
        const estados = bloque.retos.map(r => progreso[r.id]);
        if (estados.every(e => e?.ok) && !progreso[`reg-${bloque.id}`]) {
            registrado.current = true;
            const aLaPrimera = estados.filter(e => e.intentos === 1).length;
            guardarRegistroLocal('CALCULADORA', {
                titulo: `Calculadora · ${bloque.titulo}`,
                aciertos: aLaPrimera, intentos: bloque.retos.length, via: 'local',
            });
            marcar(`reg-${bloque.id}`, { ok: true });
        }
    }, [progreso, bloque, marcar]);

    const items = pestana === 'retos' ? bloque.retos : bloque.regularidades;
    const item = items[Math.min(idx, items.length - 1)];

    const pestanas = [
        { id: 'retos', txt: `🎯 Retos (${bloque.retos.length})` },
        { id: 'regularidades', txt: `🔍 Regularidades (${bloque.regularidades.length})` },
        { id: 'teclas', txt: '🎹 Teclas clave' },
    ];

    return (
        <div style={{ display: 'grid', gridTemplateColumns: movil ? '1fr' : 'minmax(0, 1fr) 290px', gap: 18, alignItems: 'start' }}>
            <div>
                <p style={{ margin: '0 0 10px', color: '#334155' }}>{bloque.descripcion}</p>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>
                    <button onClick={onFicha} style={btn('#fff', '#0f766e')}>📄 Ficha PDF</button>
                    <button onClick={() => onCompartir(null)} style={btn('#fff', '#0f766e')}>🔗 Compartir bloque</button>
                    {apps.length > 0 && <span style={{ fontSize: 13, fontWeight: 700, color: '#475569', marginLeft: 4 }}>Practícalo también en:</span>}
                    {apps.map(a => (
                        <button key={a.id} onClick={() => irApp(a.ruta)} title={`Abrir ${a.nombre}`}
                            style={{ ...btn(`${bloque.color}18`, '#0f172a'), border: `1.5px solid ${bloque.color}66`, fontSize: 13 }}>
                            {a.emoji} {a.nombre} →
                        </button>
                    ))}
                </div>
                {bloque.preparacion && (
                    <div style={{ ...tarjeta, background: '#fef9c3', border: '2px solid #facc15', padding: 12 }}>
                        ⚙️ <b>Prepara la calculadora:</b> {bloque.preparacion}
                    </div>
                )}
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
                    {pestanas.map(p => (
                        <button key={p.id} onClick={() => { setPestana(p.id); setIdx(0); }}
                            style={btn(pestana === p.id ? bloque.color : '#fff', pestana === p.id ? '#fff' : '#334155')}>
                            {p.txt}
                        </button>
                    ))}
                </div>

                {pestana === 'teclas' && (
                    <div style={tarjeta}>
                        {bloque.teclasClave.map((t, i) => (
                            <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '10px 0', borderBottom: i < bloque.teclasClave.length - 1 ? '1px solid #e2e8f0' : 'none', flexWrap: movil ? 'wrap' : 'nowrap' }}>
                                <button onClick={() => verTeclas(t.teclas, '')} title="Ver en la calculadora" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, minWidth: 140, textAlign: 'left' }}>
                                    <ChipsTeclas teclas={t.teclas} compacto />
                                </button>
                                <span style={{ lineHeight: 1.5 }}>{t.que}</span>
                            </div>
                        ))}
                    </div>
                )}

                {pestana !== 'teclas' && item && (
                    <>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
                            {items.map((it, i) => (
                                <button key={it.id} onClick={() => setIdx(i)} title={it.titulo} style={{
                                    width: 34, height: 34, borderRadius: '50%', border: i === idx ? `3px solid ${bloque.color}` : '2px solid #cbd5e1',
                                    background: progreso[it.id]?.ok ? '#22c55e' : '#fff', color: progreso[it.id]?.ok ? '#fff' : '#334155',
                                    fontWeight: 900, cursor: 'pointer',
                                }}>{progreso[it.id]?.ok ? '✓' : i + 1}</button>
                            ))}
                        </div>
                        {pestana === 'retos'
                            ? <TarjetaReto key={item.id} reto={item} color={bloque.color} estado={progreso[item.id]} marcar={marcar} verTeclas={verTeclas} onCompartir={() => onCompartir(item)} />
                            : <TarjetaRegularidad key={item.id} reg={item} color={bloque.color} estado={progreso[item.id]} marcar={marcar} verTeclas={verTeclas} onCompartir={() => onCompartir(item)} />}
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <button disabled={idx === 0} onClick={() => setIdx(i => i - 1)} style={{ ...btn('#fff', '#334155'), opacity: idx === 0 ? 0.4 : 1 }}>← Anterior</button>
                            <button disabled={idx >= items.length - 1} onClick={() => setIdx(i => i + 1)} style={{ ...btn(bloque.color), opacity: idx >= items.length - 1 ? 0.4 : 1 }}>Siguiente →</button>
                        </div>
                    </>
                )}
            </div>

            <div ref={calcRef} style={{ position: movil ? 'static' : 'sticky', top: 12, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                <Fx82MS anim={anim} resultado={secuencia.pantalla?.split('→').pop().trim()} ancho={movil ? 280 : 290} />
                {secuencia.teclas ? (
                    <div style={{ display: 'flex', gap: 6 }}>
                        <button onClick={anim.reproducir} style={btn('#0f766e')}>▶ Repetir</button>
                        <button onClick={anim.siguiente} disabled={anim.terminado} style={{ ...btn('#fff', '#0f766e'), opacity: anim.terminado ? 0.5 : 1 }}>Paso a paso ⏭</button>
                    </div>
                ) : (
                    <div style={{ fontSize: 13, color: '#475569', textAlign: 'center', maxWidth: 260 }}>
                        Pulsa <b>🎹 Ver teclas</b> en un reto para ver aquí qué teclas hay que pulsar.
                    </div>
                )}
                {secuencia.teclas && <div style={{ ...tarjeta, padding: 10, width: '100%', boxSizing: 'border-box', marginBottom: 0 }}><ChipsTeclas teclas={secuencia.teclas} activo={anim.tokenActivo} compacto /></div>}
            </div>
        </div>
    );
}

// ─────────────────────────────── Reto
function TarjetaReto({ reto, color, estado, marcar, verTeclas, onCompartir }) {
    const [txt, setTxt] = useState('');
    const [fb, setFb] = useState(null); // { ok, motivo }
    const [fallos, setFallos] = useState(0);
    const [mostrarTeclas, setMostrarTeclas] = useState(false);
    const resuelto = estado?.ok || fb?.ok;
    const verSolucion = resuelto || fallos >= 2;

    const enviar = () => {
        if (!txt.trim()) return;
        const r = comprobar(txt, reto);
        setFb(r);
        if (r.ok) {
            sonidoCorrecto();
            if (!estado?.ok) marcar(reto.id, { ok: true, intentos: fallos + 1 });
        } else {
            sonidoIncorrecto();
            if (!r.motivo || !r.motivo.startsWith('No entiendo')) setFallos(f => f + 1);
        }
    };

    const solucion = typeof reto.respuesta === 'string' ? reto.respuesta : formatear(reto.respuesta);

    return (
        <div style={{ ...tarjeta, borderLeft: `6px solid ${color}` }}>
            <div style={{ display: 'flex', alignItems: 'center' }}>
                <div style={{ fontSize: 12, fontWeight: 800, color, textTransform: 'uppercase', letterSpacing: 0.5 }}>🎯 Situación</div>
                <button onClick={onCompartir} title="Compartir este reto" style={{ ...miniBtn, marginLeft: 'auto' }}>🔗</button>
            </div>
            <h3 style={{ margin: '4px 0 8px' }}>{reto.titulo}</h3>
            <p style={{ fontSize: 16, lineHeight: 1.55, margin: '0 0 12px', whiteSpace: 'pre-wrap' }}>{reto.situacion}</p>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <input value={txt} onChange={e => { setTxt(e.target.value); setFb(null); }}
                    onKeyDown={e => e.key === 'Enter' && enviar()}
                    placeholder={reto.tipo === 'fraccion' ? 'p. ej. 19/12' : reto.tipo === 'sexagesimal' ? 'p. ej. 12°30\'15"' : 'Tu resultado'}
                    style={{ flex: '1 1 160px', minWidth: 0, padding: '10px 12px', fontSize: 17, borderRadius: 10, border: `2px solid ${fb ? (fb.ok ? '#22c55e' : '#ef4444') : '#cbd5e1'}`, fontFamily: 'inherit' }} />
                {reto.unidad && <b style={{ color: '#475569' }}>{reto.unidad}</b>}
                <button onClick={enviar} style={btn(color)}>Comprobar</button>
                <button onClick={() => { setMostrarTeclas(true); verTeclas(reto.teclas, reto.pantalla); }} style={btn('#1e293b')}>🎹 Ver teclas</button>
            </div>
            {reto.tipo === 'sexagesimal' && (
                <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
                    {['°', '′', '″'].map(s => (
                        <button key={s} onClick={() => setTxt(t => t + s)} style={{ ...btn('#e2e8f0', '#0f172a'), padding: '4px 12px' }}>{s}</button>
                    ))}
                </div>
            )}

            {fb && (
                <div style={{ marginTop: 10, padding: '8px 12px', borderRadius: 10, fontWeight: 700, background: fb.ok ? '#dcfce7' : '#fee2e2', color: fb.ok ? '#166534' : '#991b1b' }}>
                    {fb.ok ? '✅ ¡Correcto!' : `❌ ${fb.motivo || (fallos >= 2 ? 'Mira la solución y la secuencia de teclas.' : 'Revisa la secuencia de teclas y vuelve a intentarlo.')}`}
                </div>
            )}

            {mostrarTeclas && (
                <div style={{ marginTop: 12, padding: 12, background: '#f8fafc', borderRadius: 12 }}>
                    <div style={{ fontSize: 12, fontWeight: 800, color: '#475569', marginBottom: 6 }}>🎹 SECUENCIA DE TECLAS (fx-82MS)</div>
                    <ChipsTeclas teclas={reto.teclas} />
                    {verSolucion && reto.pantalla && <div style={{ marginTop: 8, fontFamily: '"Courier New", monospace', fontWeight: 700 }}>Pantalla: {reto.pantalla}</div>}
                </div>
            )}

            {verSolucion && (
                <div style={{ marginTop: 12, padding: 12, background: `${color}12`, borderRadius: 12, lineHeight: 1.55 }}>
                    {!resuelto && <div><b>Solución:</b> {solucion} {reto.unidad || ''}</div>}
                    <div>💡 {reto.explicacion}</div>
                    {reto.errorTipico && <div style={{ marginTop: 6 }}>⚠️ <b>Error típico:</b> {reto.errorTipico}</div>}
                </div>
            )}
        </div>
    );
}

// ─────────────────────────────── Regularidad
function TarjetaRegularidad({ reg, color, estado, marcar, verTeclas, onCompartir }) {
    const [vals, setVals] = useState(() => reg.serie.map(() => ''));
    const [okFila, setOkFila] = useState(() => reg.serie.map(() => (estado?.ok ? true : null)));
    const [revelado, setRevelado] = useState(!!estado?.ok);
    const [eleccion, setEleccion] = useState(estado?.ok ? reg.correcta : null);
    const filasListas = revelado || okFila.every(Boolean);

    const comprobarFila = (i) => {
        const s = reg.serie[i];
        const r = comprobar(vals[i], { respuesta: s.valor, tipo: reg.tipoRespuesta, tol: reg.tol, tolRel: reg.tolRel });
        setOkFila(o => o.map((x, j) => (j === i ? r.ok : x)));
        if (r.ok) sonidoCorrecto(); else sonidoIncorrecto();
    };

    const elegir = (i) => {
        if (eleccion === reg.correcta) return;
        setEleccion(i);
        if (i === reg.correcta) {
            sonidoCorrecto();
            if (!estado?.ok) marcar(reg.id, { ok: true });
        } else sonidoIncorrecto();
    };

    return (
        <div style={{ ...tarjeta, borderLeft: `6px solid ${color}` }}>
            <div style={{ display: 'flex', alignItems: 'center' }}>
                <div style={{ fontSize: 12, fontWeight: 800, color, textTransform: 'uppercase', letterSpacing: 0.5 }}>🔍 Descubre la regularidad</div>
                <button onClick={onCompartir} title="Compartir esta regularidad" style={{ ...miniBtn, marginLeft: 'auto' }}>🔗</button>
            </div>
            <h3 style={{ margin: '4px 0 6px' }}>{reg.titulo}</h3>
            <p style={{ margin: '0 0 12px', lineHeight: 1.5 }}>{reg.intro}</p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {reg.serie.map((s, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', padding: '6px 8px', borderRadius: 10, background: okFila[i] ? '#dcfce7' : okFila[i] === false ? '#fee2e2' : '#f8fafc' }}>
                        <b style={{ minWidth: 120, fontSize: 16 }}>{s.expr}</b>
                        <button onClick={() => verTeclas(s.teclas, s.mostrar || formatear(s.valor))} title="Ver teclas" style={{ ...btn('#1e293b'), padding: '4px 8px', fontSize: 13 }}>🎹</button>
                        <span style={{ fontWeight: 800 }}>=</span>
                        {revelado && !okFila[i] ? (
                            <b style={{ color: '#0f766e', fontFamily: '"Courier New", monospace', fontSize: 16 }}>{s.mostrar || formatear(s.valor)}</b>
                        ) : (
                            <>
                                <input value={vals[i]} disabled={!!okFila[i]}
                                    onChange={e => { const v = e.target.value; setVals(a => a.map((x, j) => (j === i ? v : x))); setOkFila(o => o.map((x, j) => (j === i ? null : x))); }}
                                    onKeyDown={e => e.key === 'Enter' && comprobarFila(i)}
                                    placeholder={okFila[i] ? formatear(s.valor) : '?'}
                                    style={{ width: 130, padding: '6px 8px', fontSize: 15, borderRadius: 8, border: '2px solid #cbd5e1', fontFamily: 'inherit' }} />
                                {!okFila[i] && <button onClick={() => comprobarFila(i)} style={{ ...btn(color), padding: '5px 10px', fontSize: 13 }}>✓</button>}
                                {okFila[i] && <span>✅</span>}
                            </>
                        )}
                    </div>
                ))}
            </div>
            {!filasListas && (
                <button onClick={() => setRevelado(true)} style={{ ...btn('#fff', '#475569'), border: '1px solid #cbd5e1', marginTop: 10, fontSize: 13 }}>
                    👀 Mostrar los resultados
                </button>
            )}

            {filasListas && (
                <div style={{ marginTop: 14 }}>
                    <div style={{ fontWeight: 900, marginBottom: 8 }}>🤔 {reg.pregunta}</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 8 }}>
                        {reg.opciones.map((o, i) => {
                            const elegida = eleccion === i;
                            const bien = i === reg.correcta;
                            return (
                                <button key={i} onClick={() => elegir(i)} style={{
                                    ...btn(elegida ? (bien ? '#22c55e' : '#ef4444') : '#f1f5f9', elegida ? '#fff' : '#0f172a'),
                                    textAlign: 'left', fontWeight: 700, border: '2px solid #e2e8f0',
                                }}>{o}</button>
                            );
                        })}
                    </div>
                    {eleccion === reg.correcta && (
                        <div style={{ marginTop: 12, padding: 12, background: `${color}14`, borderRadius: 12, lineHeight: 1.55 }}>
                            🎉 <b>¡Regularidad descubierta!</b> {reg.conclusion}
                        </div>
                    )}
                    {eleccion != null && eleccion !== reg.correcta && (
                        <div style={{ marginTop: 10, color: '#991b1b', fontWeight: 700 }}>Vuelve a mirar los resultados de la serie e inténtalo otra vez.</div>
                    )}
                </div>
            )}
        </div>
    );
}
