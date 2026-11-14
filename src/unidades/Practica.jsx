import React, { useEffect, useMemo, useRef, useState } from 'react';
import { doc, getDoc, addDoc, collection } from 'firebase/firestore';
import { db } from '../firebase';
import { guardarRegistroLocal } from '../utils/registrosLocales';
import { sonidoCorrecto, sonidoIncorrecto } from '../utils/sonidosFeedback';
import { MAGNITUDES, leerNumero, escaleraDe, magnitudDibujo, saltosEntre } from './magnitudes.js';
import { generarConversion, generarCompleja, MAGNITUDES_COMPLEJAS, pick } from './generadores.js';
import { generarProblemaUnidades } from './problemasUnidades.js';
import { VisualConversion, Escalera, CadenaFactores } from './Visuales.jsx';

// ─────────────────────────────────────────────────────────────────────────────
//  PRÁCTICA: conversiones (por saltos, factores o libre) y problemas en los que
//  hay que pasar todo a la misma unidad. Corrige, explica con el dibujo y al
//  final guarda el registro y permite enviarlo al profesor (informes UNIDADES).
// ─────────────────────────────────────────────────────────────────────────────

const card = { background: 'white', borderRadius: 18, padding: '18px 18px', boxShadow: '0 6px 20px rgba(15,23,42,0.08)', border: '1px solid #e2e8f0' };
const btn = (c, lleno = true) => ({ padding: '11px 20px', borderRadius: 999, border: `2px solid ${c}`, background: lleno ? c : 'white', color: lleno ? 'white' : c, fontWeight: 900, fontSize: '0.95rem', cursor: 'pointer', fontFamily: 'inherit' });
const input = { padding: '10px 12px', borderRadius: 12, border: '2px solid #cbd5e1', fontSize: '1.15rem', fontWeight: 800, width: 150, textAlign: 'right', fontFamily: 'inherit' };

// fracción «2/3», «−1/2» o número
const leerFrac = (t) => {
    const conPi = /π/.test(String(t || ''));
    const s = String(t || '').replace(/\s/g, '').replace(/[−–]/g, '-').replace(/π/g, '').replace(/^(-?)\//, '$11/');
    if (conPi && (s === '' || s === '-')) return s === '-' ? -1 : 1; // «π» = 1·π
    const m = s.match(/^(-?\d+(?:[.,]\d+)?)\/(-?\d+(?:[.,]\d+)?)$/);
    if (m) { const d = Number(m[2].replace(',', '.')); return d ? Number(m[1].replace(',', '.')) / d : NaN; }
    return s === '' ? NaN : s === '-' ? NaN : leerNumero(s || '1');
};
export function comprobarRespuesta(q, txt) {
    if (q.tipo === 'opcion') return txt ? txt === q.v : null;
    const v = q.tipo === 'frac' ? leerFrac(txt) : leerNumero(txt);
    if (!Number.isFinite(v)) return null;
    const tol = Math.max(q.tol ?? 0, Math.abs(q.v) * 1e-4, 1e-9);
    return Math.abs(v - q.v) <= tol;
}

/** Genera un ejercicio según el modo: 'conv' | 'complejas' | 'problemas' | 'mixto' */
export function generarEjercicio({ modo, mags, nivel, metodo }) {
    const m = pick(mags);
    if (modo === 'problemas') return generarProblemaUnidades({ mags, nivel }) || generarConversion(m, { nivel, metodo });
    if (modo === 'complejas') {
        const ok = mags.filter((x) => MAGNITUDES_COMPLEJAS.includes(x));
        return generarCompleja(ok.length ? pick(ok) : pick(MAGNITUDES_COMPLEJAS), { nivel });
    }
    if (modo === 'mixto' && Math.random() < 0.3) return generarProblemaUnidades({ mags, nivel }) || generarConversion(m, { nivel, metodo });
    return generarConversion(m, { nivel, metodo });
}

// ── Enviar al profesor ───────────────────────────────────────────────────────
function ModalEnviar({ datos, onClose }) {
    const [codigo, setCodigo] = useState('');
    const [nombre, setNombre] = useState('');
    const [curso, setCurso] = useState('');
    const [estado, setEstado] = useState({ enviando: false, enviado: false, error: '' });
    const enviar = async () => {
        const code = codigo.trim().toUpperCase();
        if (!nombre.trim()) return setEstado((e) => ({ ...e, error: 'Escribe tu nombre.' }));
        if (!code) return setEstado((e) => ({ ...e, error: 'Escribe el código del profesor.' }));
        setEstado({ enviando: true, enviado: false, error: '' });
        try {
            const c = await getDoc(doc(db, 'codigos_profesor', code));
            if (!c.exists()) return setEstado({ enviando: false, enviado: false, error: 'Código no encontrado.' });
            const intentos = datos.aciertos + datos.fallos;
            const porcentaje = Math.round((datos.aciertos / Math.max(1, intentos)) * 100);
            await addDoc(collection(db, 'informes_juegos'), {
                tipo: 'UNIDADES', modalidad: 'Individual', fecha: new Date(), codigoProfesor: code,
                jugadores: [{ nombre: nombre.trim(), curso: curso.trim(), aciertos: datos.aciertos, fallos: datos.fallos, intentos, puntos: datos.puntos, porcentaje, config: datos.config, detalle: datos.detalle }],
            });
            guardarRegistroLocal('UNIDADES', { titulo: 'Cambio de unidades', aciertos: datos.aciertos, intentos, porcentaje, nombre: nombre.trim(), curso: curso.trim(), via: 'profesor' });
            setEstado({ enviando: false, enviado: true, error: '' });
        } catch (e) { setEstado({ enviando: false, enviado: false, error: 'Error: ' + e.message }); }
    };
    const campo = { padding: '9px 12px', borderRadius: 9, border: '1.5px solid #cbd5e1', fontSize: '0.95rem', width: '100%', boxSizing: 'border-box', fontFamily: 'inherit' };
    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.6)', zIndex: 10050, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 14 }}>
            <div style={{ ...card, width: '100%', maxWidth: 380 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <h3 style={{ margin: 0, color: '#0891b2' }}>📤 Enviar al profesor</h3>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '1.3rem', cursor: 'pointer', color: '#94a3b8' }}>✕</button>
                </div>
                {estado.enviado ? (
                    <div style={{ textAlign: 'center', padding: 14 }}>
                        <div style={{ fontSize: '2.6rem' }}>✅</div>
                        <b style={{ color: '#16a34a' }}>¡Informe enviado!</b>
                        <div><button onClick={onClose} style={{ ...btn('#0891b2'), marginTop: 12 }}>Cerrar</button></div>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                        <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre y apellido" style={campo} />
                        <input value={curso} onChange={(e) => setCurso(e.target.value)} placeholder="Curso (ej: 1º ESO A)" style={campo} />
                        <input value={codigo} onChange={(e) => setCodigo(e.target.value.toUpperCase())} placeholder="Código del profesor" maxLength={10} style={{ ...campo, letterSpacing: 2, fontWeight: 800 }} />
                        {estado.error && <div style={{ color: '#dc2626', fontSize: '0.85rem' }}>⚠ {estado.error}</div>}
                        <button onClick={enviar} disabled={estado.enviando} style={btn('#0891b2')}>{estado.enviando ? 'Enviando…' : '📤 Enviar'}</button>
                    </div>
                )}
            </div>
        </div>
    );
}

// ── Ayuda antes de responder ─────────────────────────────────────────────────
function Ayuda({ ap, metodo }) {
    const v = ap.v;
    if (!v || v.clase !== 'conv') return null;
    const magD = magnitudDibujo(v.mag, v.de, v.a);
    if (metodo === 'saltos' && saltosEntre(magD, v.de, v.a)) return <Escalera mag={magD} de={v.de} a={v.a} mostrarSaltos={false} maxAncho={440} />;
    if (metodo === 'factor' && v.mag !== 'temperatura') return <CadenaFactores mag={v.mag} de={v.de} a={v.a} valor={v.valor} vacio />;
    return null;
}

/**
 * modo: 'conv' | 'complejas' | 'problemas' | 'mixto'
 * cfg: { mags, nivel, metodo, n }
 */
export default function Practica({ modo, cfg, onSalir }) {
    const { mags, nivel, metodo, n = 10 } = cfg;
    const nuevo = () => generarEjercicio({ modo, mags, nivel, metodo });
    const [ap, setAp] = useState(nuevo);
    const [resp, setResp] = useState({});
    const [corregido, setCorregido] = useState(null); // [ok por respuesta]
    const [pistas, setPistas] = useState(0);
    const [num, setNum] = useState(1);
    const [puntos, setPuntos] = useState(0);
    const [detalle, setDetalle] = useState([]);
    const [fin, setFin] = useState(false);
    const [enviar, setEnviar] = useState(false);
    const [guardado, setGuardado] = useState(false);
    const primerInput = useRef(null);
    const aciertos = detalle.filter((d) => d.ok).length;

    useEffect(() => { primerInput.current?.focus(); }, [ap]);

    const comprobar = () => {
        if (corregido) return;
        const oks = ap.r.map((q, i) => comprobarRespuesta(q, resp[i]));
        if (oks.some((o) => o === null)) return; // falta alguna casilla
        setCorregido(oks);
        const ok = oks.every(Boolean);
        (ok ? sonidoCorrecto : sonidoIncorrecto)();
        if (ok) setPuntos((p) => p + Math.max(4, 10 - pistas * 2));
        setDetalle((d) => [...d, { ok, enunciado: ap.e.slice(0, 160), respuesta: ap.r.map((_, i) => resp[i] ?? '').join(' · '), solucion: ap.s }]);
    };
    const siguiente = () => {
        if (num >= n) { setFin(true); return; }
        setNum((x) => x + 1); setAp(nuevo()); setResp({}); setCorregido(null); setPistas(0);
    };
    const reiniciar = () => { setNum(1); setPuntos(0); setDetalle([]); setFin(false); setGuardado(false); setAp(nuevo()); setResp({}); setCorregido(null); setPistas(0); };
    const datosInforme = { aciertos, fallos: detalle.length - aciertos, puntos, config: { modo, magnitudes: mags, nivel, metodo, numEjercicios: n, tipos: mags.map((m) => MAGNITUDES[m]?.nombre || m) }, detalle };

    if (fin) {
        const pct = Math.round((aciertos / Math.max(1, detalle.length)) * 100);
        return (
            <div style={{ ...card, maxWidth: 620, margin: '0 auto', textAlign: 'center' }}>
                <div style={{ fontSize: '3rem' }}>{pct >= 80 ? '🏆' : pct >= 50 ? '👍' : '💪'}</div>
                <h2 style={{ margin: '6px 0', color: '#0f172a' }}>{aciertos} de {detalle.length} correctas · {puntos} puntos</h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5, textAlign: 'left', margin: '14px 0', maxHeight: 300, overflowY: 'auto' }}>
                    {detalle.map((d, i) => (
                        <div key={i} style={{ padding: '6px 10px', borderRadius: 10, background: d.ok ? '#f0fdf4' : '#fef2f2', fontSize: '0.85rem', fontWeight: 600, color: '#334155' }}>
                            {d.ok ? '✅' : '❌'} {d.enunciado} <span style={{ color: '#64748b' }}>→ {d.solucion}</span>
                        </div>
                    ))}
                </div>
                <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
                    <button onClick={reiniciar} style={btn('#0891b2')}>🔁 Otra vez</button>
                    <button disabled={guardado} onClick={() => { guardarRegistroLocal('UNIDADES', { titulo: 'Cambio de unidades', aciertos, intentos: detalle.length, porcentaje: pct }); setGuardado(true); }} style={btn('#2563eb', false)}>{guardado ? '✔ Guardado' : '💾 Guardar en mis registros'}</button>
                    <button onClick={() => setEnviar(true)} style={btn('#16a34a')}>📤 Enviar al profesor</button>
                    <button onClick={onSalir} style={btn('#64748b', false)}>← Menú</button>
                </div>
                {enviar && <ModalEnviar datos={datosInforme} onClose={() => setEnviar(false)} />}
            </div>
        );
    }

    const pasos = ap.pasos || [];
    const todasOk = corregido?.every(Boolean);
    return (
        <div style={{ ...card, maxWidth: 760, margin: '0 auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
                <button onClick={onSalir} style={{ ...btn('#64748b', false), padding: '6px 14px' }}>← Menú</button>
                <span style={{ fontWeight: 900, color: '#0891b2' }}>{num} / {n}</span>
                <span style={{ fontWeight: 900, color: '#f59e0b' }}>⭐ {puntos}</span>
            </div>

            <div style={{ fontSize: ap.largo ? '1.12rem' : '1.6rem', fontWeight: 800, color: '#0f172a', lineHeight: 1.5, textAlign: ap.largo ? 'left' : 'center', margin: '6px 0 14px' }}>{ap.e}</div>

            {!corregido && <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}><Ayuda ap={ap} metodo={metodo} /></div>}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: ap.largo ? 'flex-start' : 'center' }}>
                {ap.r.map((q, i) => (
                    <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                        {q.etiqueta && <span style={{ fontWeight: 800, color: '#475569', minWidth: 90 }}>{q.etiqueta}</span>}
                        {q.tipo === 'opcion'
                            ? q.opciones.map((o) => (
                                <button key={o} disabled={!!corregido} onClick={() => setResp((r) => ({ ...r, [i]: o }))}
                                    style={{ ...btn('#7c3aed', resp[i] === o), padding: '8px 14px' }}>{o}</button>
                            ))
                            : <input ref={i === 0 ? primerInput : null} value={resp[i] ?? ''} disabled={!!corregido} inputMode="decimal"
                                onChange={(e) => setResp((r) => ({ ...r, [i]: e.target.value }))}
                                onKeyDown={(e) => { if (e.key === 'Enter') (corregido ? siguiente() : comprobar()); }}
                                placeholder={q.tipo === 'frac' ? 'p. ej. 2/3' : '?'}
                                style={{ ...input, borderColor: corregido ? (corregido[i] ? '#16a34a' : '#dc2626') : '#cbd5e1' }} />}
                        <span style={{ fontWeight: 800, color: '#334155' }}>{q.tipo !== 'opcion' && q.unidad}</span>
                        {corregido && !corregido[i] && <span style={{ fontWeight: 800, color: '#16a34a' }}>→ {q.vTxt ?? q.v} {q.tipo !== 'opcion' ? q.unidad : ''}</span>}
                    </div>
                ))}
            </div>

            {!corregido && pistas > 0 && (
                <ol style={{ margin: '14px 0 0', paddingLeft: 22, color: '#7c3aed', fontWeight: 700, lineHeight: 1.6 }}>
                    {pasos.slice(0, pistas).map((p, i) => <li key={i}>{p}</li>)}
                </ol>
            )}

            {corregido && (
                <div style={{ marginTop: 14, padding: '12px 14px', borderRadius: 14, background: todasOk ? '#f0fdf4' : '#fef2f2', border: `2px solid ${todasOk ? '#86efac' : '#fca5a5'}` }}>
                    <div style={{ fontWeight: 900, fontSize: '1.1rem', color: todasOk ? '#15803d' : '#b91c1c' }}>{todasOk ? '✅ ¡Correcto!' : '❌ Revisa la solución'}: {ap.s}</div>
                    <ol style={{ margin: '8px 0', paddingLeft: 22, color: '#334155', fontWeight: 600, lineHeight: 1.6 }}>{pasos.map((p, i) => <li key={i}>{p}</li>)}</ol>
                    {ap.v && <div style={{ overflowX: 'auto' }}><VisualConversion v={ap.v} solucion /></div>}
                </div>
            )}

            <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 16, flexWrap: 'wrap' }}>
                {!corregido ? (
                    <>
                        {pasos.length > 0 && pistas < pasos.length && <button onClick={() => setPistas((p) => p + 1)} style={btn('#7c3aed', false)}>💡 Pista {pistas + 1}/{pasos.length}</button>}
                        <button onClick={comprobar} style={btn('#0891b2')}>Comprobar ✔</button>
                    </>
                ) : (
                    <button onClick={siguiente} style={btn('#16a34a')}>{num >= n ? 'Ver resultados 🏁' : 'Siguiente →'}</button>
                )}
            </div>
            {modo === 'problemas' && !corregido && <p style={{ textAlign: 'center', color: '#64748b', fontSize: '0.85rem', marginTop: 10 }}>Antes de operar, pasa todas las cantidades a la <b>misma unidad</b>.</p>}
        </div>
    );
}

export { escaleraDe };
