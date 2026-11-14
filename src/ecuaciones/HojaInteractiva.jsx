// Hoja interactiva de Física y Química para el alumno (/?hojafq=ID).
// Responde el test y los problemas, corrige (los problemas con solución numérica se corrigen solos;
// los de respuesta abierta se autoevalúan viendo la solución) y envía el resultado al profesor
// (informes_juegos, tipo HOJA_FQ).
import { validarNombre } from '../utils/filtroNombres';
import { useEffect, useMemo, useState } from 'react';
import { db } from '../firebase';
import { doc, getDoc, addDoc, collection } from 'firebase/firestore';
import { cargarHoja, respuestaCorrecta } from './hojasInteractivas';

const LETRAS = 'abcdefgh';
const corto = (s, n) => { const t = String(s ?? ''); return t.length > n ? t.slice(0, n - 1) + '…' : t; };

export default function HojaInteractiva({ hojaId, onSalir }) {
    const [hoja, setHoja] = useState(undefined); // undefined = cargando · null = no existe
    const [resp, setResp] = useState({});       // clave → respuesta
    const [auto, setAuto] = useState({});       // clave → true/false (autoevaluación)
    const [corregida, setCorregida] = useState(false);
    const [verPasos, setVerPasos] = useState({});
    const [enviar, setEnviar] = useState(false);

    useEffect(() => {
        let vivo = true;
        cargarHoja(hojaId).then(h => { if (vivo) setHoja(h); }).catch(() => { if (vivo) setHoja(null); });
        return () => { vivo = false; };
    }, [hojaId]);

    // Todos los elementos en orden, con numeración continua
    const items = useMemo(() => {
        if (!hoja) return [];
        const l = [];
        (hoja.test || []).forEach((q, i) => l.push({ clave: 't' + i, tipo: 'test', q }));
        (hoja.ejercicios || []).forEach((e, i) => l.push({ clave: 'e' + i, tipo: 'abierta', q: { enunciado: e.enunciado, solucion: e.solucion } }));
        (hoja.problemas || []).forEach((p, i) => l.push({ clave: 'p' + i, tipo: p.comprobar ? 'numero' : 'abierta', q: p }));
        return l;
    }, [hoja]);

    const resultado = (it) => {
        if (it.tipo === 'test') return resp[it.clave] === undefined ? false : Number(resp[it.clave]) === Number(it.q.correcta);
        if (it.tipo === 'numero') return !!respuestaCorrecta(it.q.comprobar, resp[it.clave]);
        return auto[it.clave] ?? null; // abierta: la marca el alumno
    };
    const pendientes = corregida ? items.filter(it => it.tipo === 'abierta' && auto[it.clave] === undefined).length : 0;
    const aciertos = items.filter(it => resultado(it) === true).length;
    const enBlanco = items.filter(it => resp[it.clave] === undefined || String(resp[it.clave]).trim() === '').length;

    const corregir = () => {
        if (enBlanco && !window.confirm(`Te quedan ${enBlanco} sin responder. ¿Corregir igualmente?`)) return;
        setCorregida(true);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };
    const repetir = () => { setResp({}); setAuto({}); setCorregida(false); setVerPasos({}); };

    if (hoja === undefined) return <Pantalla><div style={{ padding: 60, textAlign: 'center', color: '#64748b' }}>Cargando la hoja…</div></Pantalla>;
    if (hoja === null) return <Pantalla onSalir={onSalir}><div style={{ padding: 60, textAlign: 'center' }}><div style={{ fontSize: 50 }}>🤔</div><h2>Esta hoja no existe o se ha borrado</h2><p style={{ color: '#64748b' }}>Pide a tu profesor un enlace nuevo.</p></div></Pantalla>;

    const color = hoja.area === 'Química' ? '#7c3aed' : '#0f766e';
    const caja = (estado) => ({
        background: 'white', borderRadius: 14, padding: '14px 16px', marginBottom: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
        border: `2px solid ${!corregida ? '#e2e8f0' : estado === true ? '#86efac' : estado === false ? '#fca5a5' : '#fcd34d'}`,
    });
    const campo = { width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 10, border: '1.5px solid #cbd5e1', fontSize: '1rem', fontFamily: 'inherit', marginTop: 8 };
    const detalle = () => items.map((it, k) => ({
        n: k + 1, tipo: it.tipo === 'test' ? 'test' : 'problema',
        enunciado: corto(it.q.texto || it.q.enunciado, 160),
        respuesta: it.tipo === 'test' ? (resp[it.clave] !== undefined ? it.q.opciones[resp[it.clave]] || '' : '') : corto(resp[it.clave] || '', 200),
        correcta: corto(it.tipo === 'test' ? it.q.opciones[it.q.correcta] : it.q.solucion, 160),
        ok: resultado(it), autoevaluada: it.tipo === 'abierta',
    }));

    return (
        <Pantalla onSalir={onSalir}>
            <div style={{ background: 'white', borderRadius: 16, padding: '16px 18px', marginBottom: 14, borderTop: `5px solid ${color}` }}>
                <div style={{ fontSize: 12, fontWeight: 800, color, letterSpacing: 1 }}>{(hoja.area || 'Física').toUpperCase()} · HOJA INTERACTIVA</div>
                <h1 style={{ margin: '4px 0', fontSize: '1.5rem' }}>{hoja.titulo}</h1>
                {hoja.autorNombre && <div style={{ color: '#64748b', fontSize: '0.85rem' }}>Profesor/a: {hoja.autorNombre}</div>}
                {corregida ? (
                    <div style={{ marginTop: 10, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '1.4rem', fontWeight: 900, color: aciertos / Math.max(1, items.length) >= 0.5 ? '#16a34a' : '#dc2626' }}>{aciertos} / {items.length}</span>
                        {pendientes > 0 && <span style={{ color: '#b45309', fontSize: '0.88rem' }}>Marca si te han salido las {pendientes} de respuesta abierta 👇</span>}
                        <span style={{ flex: 1 }} />
                        <button onClick={() => setEnviar(true)} style={btn('linear-gradient(135deg,#f1c40f,#e67e22)')}>📤 Enviar al profesor</button>
                        <button onClick={repetir} style={btn('#64748b')}>🔄 Repetir</button>
                    </div>
                ) : <div style={{ marginTop: 6, color: '#475569', fontSize: '0.88rem' }}>Responde y pulsa «Corregir» al final. En los problemas escribe el resultado (con decimales con coma: 2,5).</div>}
            </div>

            {items.map((it, k) => {
                const est = corregida ? resultado(it) : undefined;
                const q = it.q;
                return (
                    <div key={it.clave} style={caja(est)}>
                        <div style={{ fontWeight: 700, lineHeight: 1.45 }}>
                            {k + 1}. {it.tipo === 'test' ? q.texto : q.enunciado}
                            {corregida && <span style={{ float: 'right', marginLeft: 8 }}>{est === true ? '✅' : est === false ? '❌' : '❓'}</span>}
                        </div>
                        {it.tipo === 'test' && (
                            <div style={{ display: 'grid', gap: 6, marginTop: 8 }}>
                                {q.opciones.map((o, j) => {
                                    const elegida = Number(resp[it.clave]) === j && resp[it.clave] !== undefined;
                                    const buena = corregida && j === Number(q.correcta);
                                    return (
                                        <label key={j} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '8px 10px', borderRadius: 10, cursor: corregida ? 'default' : 'pointer', background: buena ? '#dcfce7' : elegida ? (corregida ? '#fee2e2' : '#e0f2fe') : '#f8fafc', border: '1px solid #e2e8f0' }}>
                                            <input type="radio" disabled={corregida} checked={elegida} onChange={() => setResp(r => ({ ...r, [it.clave]: j }))} />
                                            <span>{LETRAS[j]}) {o}</span>
                                        </label>
                                    );
                                })}
                                {corregida && q.explicacion && <div style={{ fontSize: '0.85rem', color: '#475569' }}>💡 {q.explicacion}</div>}
                            </div>
                        )}
                        {it.tipo !== 'test' && (
                            it.tipo === 'numero'
                                ? <input value={resp[it.clave] || ''} disabled={corregida} onChange={e => setResp(r => ({ ...r, [it.clave]: e.target.value }))} placeholder={q.instruccion || 'Tu resultado (si hay varios, sepáralos con ;)'} style={campo} />
                                : <textarea value={resp[it.clave] || ''} disabled={corregida} onChange={e => setResp(r => ({ ...r, [it.clave]: e.target.value }))} rows={2} placeholder="Tu respuesta" style={campo} />
                        )}
                        {corregida && it.tipo !== 'test' && (
                            <div style={{ marginTop: 8, fontSize: '0.92rem' }}>
                                <div style={{ color: '#15803d', fontWeight: 700 }}>Solución: {q.solucion || '—'}</div>
                                {q.pasos?.length > 0 && (
                                    <>
                                        <button onClick={() => setVerPasos(v => ({ ...v, [it.clave]: !v[it.clave] }))} style={{ background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer', padding: '4px 0', fontWeight: 600 }}>{verPasos[it.clave] ? '▾ Ocultar' : '▸ Ver'} la resolución</button>
                                        {verPasos[it.clave] && <ol style={{ margin: '2px 0 0', paddingLeft: 22, lineHeight: 1.7, color: '#334155' }}>{q.pasos.map((p, j) => <li key={j}>{p}</li>)}</ol>}
                                    </>
                                )}
                                {it.tipo === 'abierta' && (
                                    <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                                        <span style={{ fontSize: '0.85rem', color: '#475569' }}>¿Te ha salido?</span>
                                        <button onClick={() => setAuto(a => ({ ...a, [it.clave]: true }))} style={{ ...btn(auto[it.clave] === true ? '#16a34a' : '#cbd5e1'), padding: '5px 12px' }}>✔ Sí</button>
                                        <button onClick={() => setAuto(a => ({ ...a, [it.clave]: false }))} style={{ ...btn(auto[it.clave] === false ? '#dc2626' : '#cbd5e1'), padding: '5px 12px' }}>✘ No</button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                );
            })}

            {!corregida
                ? <button onClick={corregir} style={{ ...btn(color), width: '100%', padding: 14, fontSize: '1.05rem' }}>✅ Corregir</button>
                : <button onClick={() => setEnviar(true)} style={{ ...btn('linear-gradient(135deg,#f1c40f,#e67e22)'), width: '100%', padding: 14, fontSize: '1.05rem' }}>📤 Enviar el resultado al profesor</button>}

            {enviar && <ModalEnviarHoja hoja={hoja} datos={{ aciertos, intentos: items.length, pendientes, detalle: detalle() }} onClose={() => setEnviar(false)} />}
        </Pantalla>
    );
}

const btn = (bg) => ({ padding: '10px 16px', borderRadius: 11, border: 'none', background: bg, color: 'white', fontWeight: 800, cursor: 'pointer', fontSize: '0.92rem' });

function Pantalla({ children, onSalir }) {
    return (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, overflowY: 'auto', background: '#f1f5f9', fontFamily: 'system-ui, Segoe UI, sans-serif', color: '#0f172a' }}>
            <div style={{ maxWidth: 760, margin: '0 auto', padding: '16px 14px 60px' }}>
                {onSalir && <button onClick={onSalir} style={{ background: 'white', border: '1px solid #cbd5e1', borderRadius: 10, padding: '6px 14px', cursor: 'pointer', marginBottom: 10, fontWeight: 600 }}>← Salir</button>}
                {children}
            </div>
        </div>
    );
}

// Enviar al profesor (patrón común de los juegos: código del profesor → informes_juegos)
function ModalEnviarHoja({ hoja, datos, onClose }) {
    const [nombre, setNombre] = useState('');
    const [curso, setCurso] = useState('');
    const [codigo, setCodigo] = useState(hoja.codigoProfesor || '');
    const [enviando, setEnviando] = useState(false);
    const [enviado, setEnviado] = useState(false);
    const [error, setError] = useState('');
    const enviarInforme = async () => {
        const code = codigo.trim().toUpperCase();
        if (!nombre.trim()) { setError('Escribe tu nombre.'); return; }
        if (!validarNombre(nombre).ok) { setError(validarNombre(nombre).mensaje); return; }
        if (!code) { setError('Escribe el código del profesor.'); return; }
        setEnviando(true); setError('');
        try {
            const snap = await getDoc(doc(db, 'codigos_profesor', code));
            if (!snap.exists()) { setError('Código no encontrado.'); setEnviando(false); return; }
            await addDoc(collection(db, 'informes_juegos'), {
                tipo: 'HOJA_FQ', modalidad: 'Individual', fecha: new Date(), codigoProfesor: code,
                titulo: hoja.titulo || 'Hoja', hojaId: hoja.id, area: hoja.area || 'Física',
                jugadores: [{
                    nombre: nombre.trim(), curso: curso.trim(),
                    aciertos: datos.aciertos, intentos: datos.intentos, sinMarcar: datos.pendientes,
                    porcentaje: Math.round((datos.aciertos / Math.max(1, datos.intentos)) * 100),
                    detalle: datos.detalle,
                }],
            });
            setEnviado(true);
        } catch (e) { setError('Error: ' + e.message); }
        setEnviando(false);
    };
    const inp = { padding: '9px 12px', borderRadius: 9, border: '1.5px solid #cbd5e1', fontSize: '0.95rem', width: '100%', boxSizing: 'border-box', fontFamily: 'inherit' };
    const lab = { fontSize: '0.78rem', color: '#64748b', fontWeight: 700, display: 'block', marginBottom: 4 };
    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.7)', zIndex: 10010, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: 14 }}>
            <div style={{ background: 'white', borderRadius: 18, width: '100%', maxWidth: 380, padding: '22px 24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                    <h3 style={{ margin: 0 }}>📤 Enviar al profesor</h3>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem', color: '#94a3b8' }}>✕</button>
                </div>
                {enviado ? (
                    <div style={{ textAlign: 'center', padding: '14px 0' }}>
                        <div style={{ fontSize: '3rem' }}>✅</div>
                        <div style={{ color: '#16a34a', fontWeight: 800 }}>¡Enviado!</div>
                        <div style={{ color: '#64748b', marginTop: 6 }}>{datos.aciertos}/{datos.intentos} correctas</div>
                        <button onClick={onClose} style={{ ...btn('#64748b'), marginTop: 14 }}>Cerrar</button>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {datos.pendientes > 0 && <div style={{ background: '#fef3c7', color: '#92400e', borderRadius: 9, padding: '7px 10px', fontSize: '0.82rem' }}>Hay {datos.pendientes} de respuesta abierta sin marcar: contarán como no hechas.</div>}
                        <div><label style={lab}>Nombre y apellido</label><input value={nombre} onChange={e => setNombre(e.target.value)} style={inp} /></div>
                        <div><label style={lab}>Curso</label><input value={curso} onChange={e => setCurso(e.target.value)} placeholder="Ej: 3º ESO B" style={inp} /></div>
                        <div><label style={lab}>Código del profesor</label><input value={codigo} onChange={e => setCodigo(e.target.value.toUpperCase())} maxLength={12} style={{ ...inp, letterSpacing: 2, fontWeight: 700 }} /></div>
                        {error && <div style={{ color: '#dc2626', fontSize: '0.82rem' }}>⚠ {error}</div>}
                        <button onClick={enviarInforme} disabled={enviando} style={{ ...btn(enviando ? '#94a3b8' : '#2563eb'), padding: 12 }}>{enviando ? 'Enviando…' : '📤 Enviar'}</button>
                    </div>
                )}
            </div>
        </div>
    );
}
