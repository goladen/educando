// src/EditorEscritura.jsx
//
// "Trabajo de escritura" para Control de Aula.
//   - FormEscritura: el profesor configura la tarea (título, consigna, mín/máx palabras,
//     tiempo, bloquear pegar) y la lanza a todos los dispositivos de la sala.
//   - PanelEscrituraProfesor: seguimiento en vivo (palabras, entregas, intentos de pegar,
//     salidas de pestaña), lectura de cada texto, reabrir entregas, recoger y descargar .txt.
//   - EditorEscrituraAlumno: editor sin corrector/autocorrección, sin pegar ni arrastrar texto,
//     con contador de palabras, autoguardado (Firestore + localStorage) y entrega.
//
// Firestore:
//   control_rooms/{CODE}.escritura = { taskId, titulo, consigna, minPalabras, maxPalabras,
//                                      tiempo (min, 0 = sin límite), bloquearPegar, state: 'WRITING'|'FIN', startedAt }
//   control_rooms/{CODE}/students/{sid}.escritura = { taskId, texto, palabras, caracteres,
//                                      pegadosBloqueados, entregado, entregadoAt, at }

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { db } from './firebase';
import { doc, setDoc, updateDoc, onSnapshot } from 'firebase/firestore';

// Cuenta palabras (letras/números de cualquier idioma; "l'home", "bien-estar" = 1 palabra).
export const contarPalabras = (texto = '') =>
    (texto.match(/[\p{L}\p{N}]+(?:['’\-][\p{L}\p{N}]+)*/gu) || []).length;

// Tipos de inserción que nunca proceden de teclear: pegar, arrastrar y sustituciones del corrector.
const INPUT_PEGADO = new Set(['insertFromPaste', 'insertFromPasteAsQuotation', 'insertFromDrop', 'insertFromYank']);
const INPUT_CORRECTOR = 'insertReplacementText';
// Una sola pulsación no puede añadir tantos caracteres → se considera texto inyectado.
const MAX_SALTO_CARACTERES = 30;

const fmtTiempo = (ms) => {
    const s = Math.max(0, Math.ceil(ms / 1000));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

// Atributos que desactivan corrector, autocorrección, sugerencias y extensiones (Grammarly, LanguageTool).
const SIN_CORRECCION = {
    spellCheck: false,
    autoCorrect: 'off',
    autoCapitalize: 'off',
    autoComplete: 'off',
    writingsuggestions: 'false',
    'data-gramm': 'false',
    'data-gramm_editor': 'false',
    'data-enable-grammarly': 'false',
    'data-lt-active': 'false',
};

const colorPalabras = (n, min, max) => {
    if (max > 0 && n > max) return '#dc2626';
    if (min > 0 && n < min) return '#d97706';
    return '#16a34a';
};

// Id determinista del informe: uno por alumno y trabajo (reentregar lo actualiza sin perder las preguntas).
export const idInformeEscritura = (taskId, studentId) => `ESCRITURA_${taskId}_${studentId}`;

// ═════════════════════════════════════════════════════════════════════════════
// PROFESOR: preguntas sobre el texto de un alumno → informes_juegos/{id}.preguntas
// Se usa en el panel de Control de Aula y en la tarjeta ESCRITURA de InformesJuegos2.
// ═════════════════════════════════════════════════════════════════════════════
export function PreguntasTexto({ informeId, preguntasIniciales = [] }) {
    const [preguntas, setPreguntas] = useState(() => preguntasIniciales.map((p) => ({ ...p })));
    const [estado, setEstado] = useState('ok'); // 'ok' | 'sucio' | 'guardando' | 'error'

    const cambiar = (id, campo, valor) => {
        setPreguntas((ps) => ps.map((p) => (p.id === id ? { ...p, [campo]: valor } : p)));
        setEstado('sucio');
    };
    const anadir = () => {
        setPreguntas((ps) => [...ps, { id: `p_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, pregunta: '', respuesta: '' }]);
        setEstado('sucio');
    };
    const quitar = (id) => {
        setPreguntas((ps) => ps.filter((p) => p.id !== id));
        setEstado('sucio');
    };
    const guardar = async () => {
        const limpias = preguntas
            .map((p) => ({ id: p.id, pregunta: (p.pregunta || '').trim(), respuesta: (p.respuesta || '').trim() }))
            .filter((p) => p.pregunta);
        setEstado('guardando');
        try {
            await updateDoc(doc(db, 'informes_juegos', informeId), { preguntas: limpias, preguntasActualizadas: new Date() });
            setPreguntas(limpias);
            setEstado('ok');
        } catch (e) {
            console.error('Guardando preguntas', e);
            setEstado('error');
        }
    };

    return (
        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, padding: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                <div style={{ fontWeight: 800, color: '#1e293b', fontSize: '0.95rem' }}>❓ Preguntas sobre el texto ({preguntas.length})</div>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: estado === 'error' ? '#dc2626' : estado === 'sucio' ? '#d97706' : '#64748b' }}>
                    {estado === 'guardando' ? 'Guardando…' : estado === 'error' ? '⚠️ No se pudo guardar' : estado === 'sucio' ? 'Cambios sin guardar' : preguntas.length ? '✓ Guardadas' : ''}
                </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {preguntas.map((p, i) => (
                    <div key={p.id} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', background: 'white', border: '1px solid #e2e8f0', borderRadius: 10, padding: 8 }}>
                        <span style={{ fontWeight: 800, color: '#0f766e', minWidth: 20, paddingTop: 8 }}>{i + 1}.</span>
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 5 }}>
                            <input value={p.pregunta} onChange={(e) => cambiar(p.id, 'pregunta', e.target.value)}
                                placeholder="Pregunta sobre el texto" style={inp} />
                            <textarea value={p.respuesta} onChange={(e) => cambiar(p.id, 'respuesta', e.target.value)} rows={2}
                                placeholder="Respuesta esperada (opcional)" style={{ ...inp, resize: 'vertical', fontFamily: 'inherit', fontSize: '0.85rem' }} />
                        </div>
                        <button onClick={() => quitar(p.id)} title="Quitar pregunta" style={{ ...btnMini, color: '#b91c1c' }}>🗑</button>
                    </div>
                ))}
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                <button onClick={anadir} style={btnMini}>➕ Añadir pregunta</button>
                <button onClick={guardar} disabled={estado === 'ok' || estado === 'guardando'}
                    style={{ ...btnMini, background: '#0f766e', color: 'white', borderColor: '#0f766e', opacity: estado === 'ok' || estado === 'guardando' ? 0.5 : 1 }}>
                    💾 Guardar preguntas
                </button>
            </div>
        </div>
    );
}

// ═════════════════════════════════════════════════════════════════════════════
// PROFESOR: formulario de lanzamiento
// ═════════════════════════════════════════════════════════════════════════════
export function FormEscritura({ onLanzar, numConectados = 0, codigoProfesor = null }) {
    const [titulo, setTitulo] = useState('');
    const [consigna, setConsigna] = useState('');
    const [minPalabras, setMinPalabras] = useState(0);
    const [maxPalabras, setMaxPalabras] = useState(0);
    const [tiempo, setTiempo] = useState(0);
    const [bloquearPegar, setBloquearPegar] = useState(true);

    const lanzar = () => {
        const min = Math.max(0, Number(minPalabras) || 0);
        let max = Math.max(0, Number(maxPalabras) || 0);
        if (max && max < min) max = min;
        onLanzar({
            titulo: titulo.trim() || 'Trabajo de escritura',
            consigna: consigna.trim(),
            minPalabras: min,
            maxPalabras: max,
            tiempo: Number(tiempo) || 0,
            bloquearPegar,
        });
    };

    return (
        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 14, padding: 16, marginBottom: 18 }}>
            <h3 style={{ margin: '0 0 4px', color: '#1e293b', display: 'flex', alignItems: 'center', gap: 8 }}>
                ✍️ Trabajo de escritura
            </h3>
            <p style={{ margin: '0 0 12px', color: '#64748b', fontSize: '0.85rem' }}>
                Editor sin corrector ni autocorrección, con contador de palabras y opción de bloquear el pegado de texto.
            </p>

            <label style={lbl}>Título</label>
            <input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ej: Redacción — Mi lugar favorito" style={inp} />

            <label style={lblTop}>Consigna (opcional)</label>
            <textarea value={consigna} onChange={(e) => setConsigna(e.target.value)} rows={3}
                placeholder="Describe tu lugar favorito usando al menos cinco adjetivos…"
                style={{ ...inp, resize: 'vertical', fontFamily: 'inherit' }} />

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(130px,1fr))', gap: 10 }}>
                <div>
                    <label style={lblTop}>Mín. palabras</label>
                    <input type="number" min={0} value={minPalabras} onChange={(e) => setMinPalabras(e.target.value)} style={inp} />
                </div>
                <div>
                    <label style={lblTop}>Máx. palabras</label>
                    <input type="number" min={0} value={maxPalabras} onChange={(e) => setMaxPalabras(e.target.value)} style={inp} />
                </div>
                <div>
                    <label style={lblTop}>Tiempo</label>
                    <select value={tiempo} onChange={(e) => setTiempo(e.target.value)} style={inp}>
                        <option value={0}>Sin límite</option>
                        {[5, 10, 15, 20, 30, 45, 60, 90].map((m) => <option key={m} value={m}>{m} minutos</option>)}
                    </select>
                </div>
            </div>
            <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: 4 }}>0 = sin mínimo / sin máximo.</div>

            <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, fontSize: '0.88rem', color: '#334155', fontWeight: 600, cursor: 'pointer' }}>
                <input type="checkbox" checked={bloquearPegar} onChange={(e) => setBloquearPegar(e.target.checked)} />
                🚫 Bloquear pegar y arrastrar texto (se registran los intentos)
            </label>

            {codigoProfesor != null && (
                <div style={{ ...nota, marginTop: 12, ...(codigoProfesor ? { background: '#f0fdfa', borderColor: '#99f6e4', color: '#115e59' } : {}) }}>
                    {codigoProfesor
                        ? <>💾 Cada entrega se guardará en <b>Informes</b> (código {codigoProfesor}) y podrás añadir preguntas sobre el texto.</>
                        : <>⚠️ No tienes código de profesor: las entregas no se guardarán en Informes. Configúralo en la pestaña <b>Informes</b>.</>}
                </div>
            )}

            <button onClick={lanzar} style={{ ...btn('#0f766e'), marginTop: 14 }}>
                ✍️ Lanzar a los {numConectados} dispositivos
            </button>
        </div>
    );
}

// ═════════════════════════════════════════════════════════════════════════════
// PROFESOR: seguimiento en vivo
// ═════════════════════════════════════════════════════════════════════════════
export function PanelEscrituraProfesor({ tarea, alumnos, codigo, roomRef, esConectado, onCerrar }) {
    const [verId, setVerId] = useState(null);
    const [ahora, setAhora] = useState(Date.now());
    const [copiado, setCopiado] = useState(false);

    // Informe guardado (texto entregado + preguntas) del alumno que se está leyendo.
    const [informe, setInforme] = useState(undefined); // undefined = cargando · null = aún no existe
    useEffect(() => {
        setInforme(undefined);
        if (!verId || !tarea.codigoProfesor) return;
        return onSnapshot(
            doc(db, 'informes_juegos', idInformeEscritura(tarea.taskId, verId)),
            (snap) => setInforme(snap.exists() ? { id: snap.id, ...snap.data() } : null),
            () => setInforme(null),
        );
    }, [verId, tarea.taskId, tarea.codigoProfesor]);

    useEffect(() => {
        if (!tarea.tiempo) return;
        const id = setInterval(() => setAhora(Date.now()), 1000);
        return () => clearInterval(id);
    }, [tarea.tiempo]);

    const restanteMs = tarea.tiempo > 0 ? tarea.startedAt + tarea.tiempo * 60000 - ahora : null;
    const fin = tarea.state === 'FIN';

    const filas = useMemo(() => alumnos.map((a) => {
        const e = a.escritura?.taskId === tarea.taskId ? a.escritura : null;
        return {
            id: a.id,
            name: a.name || 'Alumno',
            conectado: esConectado(a),
            focusLostCount: a.focusLostCount || 0,
            texto: e?.texto || '',
            palabras: e?.palabras || 0,
            caracteres: e?.caracteres || 0,
            pegados: e?.pegadosBloqueados || 0,
            entregado: !!e?.entregado,
            empezado: !!e,
        };
    }), [alumnos, tarea.taskId, esConectado]);

    const entregados = filas.filter((f) => f.entregado).length;
    const verIdx = filas.findIndex((f) => f.id === verId);
    const ver = verIdx >= 0 ? filas[verIdx] : null;

    const terminar = async () => {
        if (!window.confirm('¿Terminar el trabajo? Se bloquearán los editores y se entregarán todos los textos.')) return;
        try { await updateDoc(roomRef, { 'escritura.state': 'FIN' }); } catch (e) { console.error(e); }
    };

    const reabrir = async (sid) => {
        try { await updateDoc(doc(db, 'control_rooms', codigo, 'students', sid), { 'escritura.entregado': false }); } catch (e) { console.error(e); }
    };

    const descargar = () => {
        const fecha = new Date().toLocaleString('es-ES');
        const partes = [
            tarea.titulo,
            tarea.consigna ? `Consigna: ${tarea.consigna}` : '',
            `Sala ${codigo} · ${fecha}`,
            tarea.minPalabras || tarea.maxPalabras ? `Palabras: mín. ${tarea.minPalabras || '—'} · máx. ${tarea.maxPalabras || '—'}` : '',
            '='.repeat(60),
        ].filter(Boolean);
        filas.filter((f) => f.empezado).forEach((f) => {
            partes.push(
                '',
                `${f.name} — ${f.palabras} palabras — ${f.entregado ? 'entregado' : 'NO entregado'}` +
                ` — pegados bloqueados: ${f.pegados} — salidas de pestaña: ${f.focusLostCount}`,
                '-'.repeat(60),
                f.texto || '(vacío)',
                '',
                '='.repeat(60),
            );
        });
        const blob = new Blob(['﻿' + partes.join('\n')], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        const slug = (tarea.titulo || 'escritura').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
        a.href = url;
        a.download = `${slug || 'escritura'}_${codigo}.txt`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    };

    const copiar = async (texto) => {
        try { await navigator.clipboard.writeText(texto); setCopiado(true); setTimeout(() => setCopiado(false), 1500); } catch { /* sin permiso */ }
    };

    return (
        <div style={{ background: '#f0fdfa', border: '1px solid #99f6e4', borderRadius: 14, padding: 16, marginBottom: 18 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
                <div style={{ minWidth: 0 }}>
                    <h3 style={{ margin: 0, color: '#115e59' }}>✍️ {tarea.titulo}</h3>
                    {tarea.consigna && <div style={{ color: '#475569', fontSize: '0.85rem', marginTop: 4, whiteSpace: 'pre-wrap' }}>{tarea.consigna}</div>}
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                        {(tarea.minPalabras > 0 || tarea.maxPalabras > 0) && (
                            <span style={chip}>📏 {tarea.minPalabras || 0}–{tarea.maxPalabras || '∞'} palabras</span>
                        )}
                        {tarea.bloquearPegar && <span style={chip}>🚫 Pegar bloqueado</span>}
                        <span style={chip}>🔕 Sin corrector</span>
                    </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                    {fin ? (
                        <div style={{ fontWeight: 800, color: '#0f766e' }}>🏁 Recogido</div>
                    ) : restanteMs != null ? (
                        <div style={{ fontWeight: 800, fontSize: '1.5rem', color: restanteMs <= 60000 ? '#dc2626' : '#0f766e' }}>
                            ⏱️ {restanteMs > 0 ? fmtTiempo(restanteMs) : 'Tiempo agotado'}
                        </div>
                    ) : (
                        <div style={{ fontWeight: 700, color: '#0f766e' }}>⏱️ Sin límite</div>
                    )}
                    <div style={{ fontSize: '0.85rem', color: '#115e59', fontWeight: 700 }}>{entregados}/{filas.length} entregados</div>
                </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12, maxHeight: 440, overflowY: 'auto' }}>
                {filas.length === 0 && <div style={{ color: '#94a3b8', fontSize: '0.9rem' }}>No hay alumnos en la sala.</div>}
                {filas.map((f) => {
                    const color = colorPalabras(f.palabras, tarea.minPalabras, tarea.maxPalabras);
                    const pct = tarea.minPalabras > 0 ? Math.min(100, (f.palabras / tarea.minPalabras) * 100) : null;
                    return (
                        <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'white', border: '1px solid #e2e8f0', borderRadius: 10, padding: '8px 12px', flexWrap: 'wrap', opacity: f.conectado || f.entregado ? 1 : 0.6 }}>
                            <div style={{ flex: '1 1 140px', minWidth: 0 }}>
                                <div style={{ fontWeight: 700, color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {f.name}{!f.conectado && <span style={{ fontWeight: 500, color: '#94a3b8', fontSize: '0.75rem' }}> · desconectado</span>}
                                </div>
                                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                                    {f.entregado ? '✅ Entregado' : f.empezado ? '✍️ Escribiendo' : '⏳ Sin empezar'}
                                </div>
                            </div>
                            <div style={{ flex: '1 1 120px' }}>
                                <div style={{ fontWeight: 800, color, fontSize: '0.95rem' }}>{f.palabras} palabras</div>
                                {pct != null && (
                                    <div style={{ height: 5, background: '#e2e8f0', borderRadius: 4, marginTop: 3, overflow: 'hidden' }}>
                                        <div style={{ width: `${pct}%`, height: '100%', background: color }} />
                                    </div>
                                )}
                            </div>
                            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                                {f.pegados > 0 && <span title="Intentos de pegar/arrastrar texto bloqueados" style={{ ...alerta, background: '#fee2e2', color: '#b91c1c' }}>🚫 ×{f.pegados}</span>}
                                {f.focusLostCount > 0 && <span title="Veces que ha salido de la pestaña" style={{ ...alerta, background: '#fef3c7', color: '#b45309' }}>👀 ×{f.focusLostCount}</span>}
                            </div>
                            <div style={{ display: 'flex', gap: 6 }}>
                                <button onClick={() => setVerId(f.id)} disabled={!f.empezado} style={{ ...btnMini, opacity: f.empezado ? 1 : 0.4 }}>👁️ Ver</button>
                                {f.entregado && !fin && (
                                    <button onClick={() => reabrir(f.id)} title="Permitir que siga escribiendo" style={btnMini}>↩️ Reabrir</button>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {!fin && <button onClick={terminar} style={btn('#dc2626')}>🏁 Terminar y recoger</button>}
                <button onClick={descargar} style={btn('#0f766e')}>⬇️ Descargar textos (.txt)</button>
                <button onClick={() => { if (window.confirm('¿Cerrar el trabajo? Descarga antes los textos: al lanzar otro trabajo se sustituirán.')) onCerrar(); }}
                    style={btn('#64748b')}>✖ Cerrar trabajo</button>
            </div>

            {/* Lectura de un texto */}
            {ver && (
                <div onClick={() => setVerId(null)} style={{ position: 'fixed', inset: 0, zIndex: 10003, background: 'rgba(15,23,42,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
                    <div onClick={(e) => e.stopPropagation()} style={{ background: 'white', borderRadius: 16, width: '100%', maxWidth: 820, maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '12px 16px', borderBottom: '1px solid #e2e8f0', flexWrap: 'wrap' }}>
                            <div>
                                <div style={{ fontWeight: 800, color: '#1e293b', fontSize: '1.1rem' }}>{ver.name}</div>
                                <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                                    <b style={{ color: colorPalabras(ver.palabras, tarea.minPalabras, tarea.maxPalabras) }}>{ver.palabras} palabras</b>
                                    {' · '}{ver.caracteres} caracteres · {ver.entregado ? '✅ entregado' : '✍️ escribiendo (en vivo)'}
                                    {ver.pegados > 0 && ` · 🚫 ${ver.pegados} pegados bloqueados`}
                                    {ver.focusLostCount > 0 && ` · 👀 ${ver.focusLostCount} salidas`}
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: 6 }}>
                                <button onClick={() => setVerId(filas[verIdx - 1]?.id ?? verId)} disabled={verIdx <= 0} style={btnMini}>◀</button>
                                <button onClick={() => setVerId(filas[verIdx + 1]?.id ?? verId)} disabled={verIdx >= filas.length - 1} style={btnMini}>▶</button>
                                <button onClick={() => copiar(ver.texto)} style={btnMini}>{copiado ? '✓ Copiado' : '📋 Copiar'}</button>
                                <button onClick={() => setVerId(null)} style={btnMini}>✖</button>
                            </div>
                        </div>
                        <div style={{ padding: '18px 22px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
                            <div style={{ whiteSpace: 'pre-wrap', fontFamily: "Georgia, 'Times New Roman', serif", fontSize: '1.08rem', lineHeight: 1.7, color: '#1e293b' }}>
                                {ver.texto || <span style={{ color: '#94a3b8' }}>(vacío)</span>}
                            </div>

                            {/* Informe guardado + preguntas del profesor asociadas al texto */}
                            {!tarea.codigoProfesor ? (
                                <div style={nota}>⚠️ Sin código de profesor: configúralo en <b>Informes</b> para que las entregas se guarden y puedas añadir preguntas.</div>
                            ) : informe ? (
                                <>
                                    <div style={{ fontSize: '0.78rem', color: '#0f766e', fontWeight: 700 }}>
                                        💾 Guardado en Informes{informe.palabras !== ver.palabras ? ` · versión entregada: ${informe.palabras} palabras` : ''}
                                    </div>
                                    <PreguntasTexto key={informe.id} informeId={informe.id} preguntasIniciales={informe.preguntas || []} />
                                </>
                            ) : informe === null ? (
                                <div style={nota}>{ver.entregado ? '💾 Guardando en Informes…' : '❓ Podrás añadir preguntas sobre el texto cuando el alumno lo entregue.'}</div>
                            ) : null}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// ═════════════════════════════════════════════════════════════════════════════
// ALUMNO: editor
// ═════════════════════════════════════════════════════════════════════════════
// Montar con key={tarea.taskId} para reiniciar el estado en cada trabajo nuevo.
export function EditorEscrituraAlumno({ tarea, codigo, studentId, nombre = '', focusLostCount = 0 }) {
    const studentRef = useMemo(() => doc(db, 'control_rooms', codigo, 'students', studentId), [codigo, studentId]);
    const lsKey = `escritura_${codigo}_${tarea.taskId}`;
    const leerLocal = () => { try { return JSON.parse(localStorage.getItem(lsKey)) || null; } catch { return null; } };

    const [texto, setTexto] = useState(() => leerLocal()?.texto || '');
    const [bloqueos, setBloqueos] = useState(0);
    const [entregado, setEntregado] = useState(false);
    const [listo, setListo] = useState(false);
    const [guardado, setGuardado] = useState('ok'); // 'ok' | 'pendiente' | 'error'
    const [aviso, setAviso] = useState('');
    const [verConsigna, setVerConsigna] = useState(true);
    const [ahora, setAhora] = useState(Date.now());

    const textareaRef = useRef(null);
    const timerGuardar = useRef(null);
    const timerAviso = useRef(null);
    const restaurado = useRef(false);
    const estadoRef = useRef({});
    estadoRef.current = { texto, bloqueos, entregado, nombre, focusLostCount };

    const fin = tarea.state === 'FIN';
    const restanteMs = tarea.tiempo > 0 ? tarea.startedAt + tarea.tiempo * 60000 - ahora : null;
    const agotado = restanteMs != null && restanteMs <= 0;
    const bloqueado = !listo || entregado || fin || agotado;
    const palabras = contarPalabras(texto);

    // Cada entrega queda en Informes (informes_juegos) con id determinista: reentregar actualiza el
    // texto con merge y conserva las preguntas que el profesor haya añadido sobre él.
    const guardarInforme = async (p, s) => {
        if (!tarea.codigoProfesor) return;
        try {
            await setDoc(doc(db, 'informes_juegos', idInformeEscritura(tarea.taskId, studentId)), {
                tipo: 'ESCRITURA',
                modalidad: 'Individual',
                fecha: new Date(),
                codigoProfesor: tarea.codigoProfesor,
                profesorUid: tarea.profesorUid || null,
                sala: codigo,
                escrituraTaskId: tarea.taskId,
                studentId,
                titulo: tarea.titulo,
                consigna: tarea.consigna || '',
                minPalabras: tarea.minPalabras || 0,
                maxPalabras: tarea.maxPalabras || 0,
                texto: p.texto,
                palabras: p.palabras,
                caracteres: p.caracteres,
                pegadosBloqueados: p.pegadosBloqueados,
                salidasPestana: s.focusLostCount || 0,
                jugadores: [{ nombre: s.nombre || 'Alumno', curso: '', palabras: p.palabras }],
            }, { merge: true });
        } catch (e) {
            console.error('Guardando informe de escritura', e);
        }
    };

    const guardar = async (over = {}) => {
        const s = { ...estadoRef.current, ...over };
        const at = Date.now();
        const payload = {
            taskId: tarea.taskId,
            texto: s.texto,
            palabras: contarPalabras(s.texto),
            caracteres: s.texto.length,
            pegadosBloqueados: s.bloqueos,
            entregado: !!s.entregado,
            at,
        };
        if (over.entregado) {
            payload.entregadoAt = at;
            guardarInforme(payload, s);
        }
        try { localStorage.setItem(lsKey, JSON.stringify({ texto: s.texto, at })); } catch { /* sin almacenamiento */ }
        try {
            // mergeFields: sustituye el mapa `escritura` entero sin tocar la presencia del alumno.
            await setDoc(studentRef, { escritura: payload }, { mergeFields: ['escritura'] });
            setGuardado('ok');
        } catch (e) {
            setGuardado('error');
        }
    };

    const programarGuardado = () => {
        setGuardado('pendiente');
        clearTimeout(timerGuardar.current);
        timerGuardar.current = setTimeout(() => { timerGuardar.current = null; guardar(); }, 1200);
    };

    // Restaurar el texto (Firestore o copia local, la más reciente) y escuchar "Reabrir" del profe.
    useEffect(() => onSnapshot(studentRef, (snap) => {
        const e = snap.data()?.escritura;
        const mia = e && e.taskId === tarea.taskId;
        if (!restaurado.current) {
            restaurado.current = true;
            if (mia) {
                const local = leerLocal();
                if (e.texto && (!local || (e.at || 0) >= (local.at || 0))) setTexto(e.texto);
                setBloqueos(e.pegadosBloqueados || 0);
            }
            setListo(true);
        }
        if (mia) setEntregado(!!e.entregado);
    }, () => { if (!restaurado.current) { restaurado.current = true; setListo(true); } }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [studentRef, tarea.taskId]);

    // Cuenta atrás.
    useEffect(() => {
        if (!tarea.tiempo) return;
        const id = setInterval(() => setAhora(Date.now()), 1000);
        return () => clearInterval(id);
    }, [tarea.tiempo]);

    // Al terminar el profe o agotarse el tiempo → entrega automática.
    useEffect(() => {
        if (!(fin || agotado) || !listo || estadoRef.current.entregado) return;
        clearTimeout(timerGuardar.current);
        timerGuardar.current = null;
        setEntregado(true);
        guardar({ entregado: true });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [fin, agotado, listo]);

    // Guardar lo pendiente al desmontar.
    useEffect(() => () => {
        clearTimeout(timerAviso.current);
        if (timerGuardar.current) { clearTimeout(timerGuardar.current); guardar(); }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const mostrarAviso = (msg) => {
        setAviso(msg);
        clearTimeout(timerAviso.current);
        timerAviso.current = setTimeout(() => setAviso(''), 2500);
    };

    const registrarBloqueo = (msg) => {
        setBloqueos((b) => b + 1);
        mostrarAviso(msg);
        programarGuardado();
    };

    // beforeinput nativo: bloquea pegar/arrastrar y las sustituciones del corrector del navegador.
    useEffect(() => {
        const el = textareaRef.current;
        if (!el) return;
        const onBeforeInput = (e) => {
            if (e.inputType === INPUT_CORRECTOR) { e.preventDefault(); return; }
            if (tarea.bloquearPegar && INPUT_PEGADO.has(e.inputType)) {
                e.preventDefault();
                registrarBloqueo('🚫 No se puede pegar texto');
            }
        };
        el.addEventListener('beforeinput', onBeforeInput);
        return () => el.removeEventListener('beforeinput', onBeforeInput);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tarea.bloquearPegar]);

    const onPaste = (e) => {
        if (!tarea.bloquearPegar) return;
        e.preventDefault();
        registrarBloqueo('🚫 No se puede pegar texto');
    };
    const onDrop = (e) => {
        if (!tarea.bloquearPegar) return;
        e.preventDefault();
        registrarBloqueo('🚫 No se puede arrastrar texto');
    };

    const onChange = (e) => {
        if (bloqueado) return;
        const nuevo = e.target.value;
        if (tarea.bloquearPegar && nuevo.length - texto.length > MAX_SALTO_CARACTERES) {
            registrarBloqueo('🚫 Inserción de texto bloqueada');
            return; // textarea controlado → se descarta el cambio
        }
        setTexto(nuevo);
        try { localStorage.setItem(lsKey, JSON.stringify({ texto: nuevo, at: Date.now() })); } catch { /* sin almacenamiento */ }
        programarGuardado();
    };

    const entregar = () => {
        if (tarea.minPalabras > 0 && palabras < tarea.minPalabras &&
            !window.confirm(`Llevas ${palabras} palabras y el mínimo es ${tarea.minPalabras}. ¿Entregar igualmente?`)) return;
        if (!window.confirm('¿Entregar el texto? Ya no podrás editarlo.')) return;
        clearTimeout(timerGuardar.current);
        timerGuardar.current = null;
        setEntregado(true);
        guardar({ entregado: true });
    };

    const colorCont = colorPalabras(palabras, tarea.minPalabras, tarea.maxPalabras);
    const limites = [
        tarea.minPalabras > 0 ? `mín. ${tarea.minPalabras}` : null,
        tarea.maxPalabras > 0 ? `máx. ${tarea.maxPalabras}` : null,
    ].filter(Boolean).join(' · ');

    return (
        <div style={{ position: 'absolute', inset: 0, overflow: 'auto', background: '#e2e8f0', padding: '14px 12px 20px', boxSizing: 'border-box' }}>
            <div style={{ maxWidth: 880, margin: '0 auto', minHeight: '100%', display: 'flex', flexDirection: 'column', gap: 10 }}>
                {/* Cabecera */}
                <div style={{ background: 'white', borderRadius: 14, padding: '12px 16px', boxShadow: '0 2px 8px rgba(15,23,42,0.08)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                        <h2 style={{ margin: 0, color: '#0f172a', fontSize: '1.2rem' }}>✍️ {tarea.titulo}</h2>
                        {tarea.consigna && (
                            <button onClick={() => setVerConsigna((v) => !v)} style={{ ...btnMini, fontSize: '0.78rem' }}>
                                {verConsigna ? 'Ocultar consigna' : 'Ver consigna'}
                            </button>
                        )}
                    </div>
                    {tarea.consigna && verConsigna && (
                        <div style={{ marginTop: 8, padding: '8px 12px', background: '#f0fdfa', borderLeft: '4px solid #14b8a6', borderRadius: 8, color: '#334155', fontSize: '0.92rem', whiteSpace: 'pre-wrap' }}>
                            {tarea.consigna}
                        </div>
                    )}
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginTop: 10 }}>
                        <span style={{ ...chip, background: 'white', border: `2px solid ${colorCont}`, color: colorCont, fontSize: '0.95rem' }}>
                            {palabras} {palabras === 1 ? 'palabra' : 'palabras'}{limites && <span style={{ fontWeight: 600, opacity: 0.8 }}> ({limites})</span>}
                        </span>
                        {restanteMs != null && (
                            <span style={{ ...chip, background: restanteMs <= 60000 ? '#fee2e2' : '#f1f5f9', color: restanteMs <= 60000 ? '#b91c1c' : '#334155', fontSize: '0.95rem' }}>
                                ⏱️ {agotado ? 'Tiempo agotado' : fmtTiempo(restanteMs)}
                            </span>
                        )}
                        {tarea.bloquearPegar && <span style={chip}>🚫 Pegar desactivado</span>}
                        <span style={{ fontSize: '0.78rem', color: guardado === 'error' ? '#dc2626' : '#64748b', marginLeft: 'auto' }}>
                            {!listo ? 'Cargando…' : guardado === 'pendiente' ? 'Guardando…' : guardado === 'error' ? '⚠️ Sin conexión (guardado en este dispositivo)' : '✓ Guardado'}
                        </span>
                    </div>
                </div>

                {(entregado || fin || agotado) && listo && (
                    <div style={{ background: entregado ? '#dcfce7' : '#fef3c7', color: entregado ? '#166534' : '#92400e', borderRadius: 12, padding: '10px 14px', fontWeight: 700, textAlign: 'center' }}>
                        {entregado ? '✅ Texto entregado. Tu profe ya puede leerlo.' : '⏳ Entregando…'}
                    </div>
                )}

                {/* Hoja */}
                <div style={{ position: 'relative', flex: 1, display: 'flex' }}>
                    <textarea
                        ref={textareaRef}
                        value={texto}
                        onChange={onChange}
                        onPaste={onPaste}
                        onDrop={onDrop}
                        onDragOver={tarea.bloquearPegar ? (e) => e.preventDefault() : undefined}
                        readOnly={bloqueado}
                        placeholder={bloqueado ? '' : 'Empieza a escribir aquí…'}
                        lang="zxx"
                        {...SIN_CORRECCION}
                        style={{
                            flex: 1, width: '100%', minHeight: 360, boxSizing: 'border-box', resize: 'none',
                            border: 'none', outline: 'none', borderRadius: 14, padding: '22px 26px',
                            background: bloqueado ? '#f8fafc' : 'white', color: '#0f172a',
                            fontFamily: "Georgia, 'Times New Roman', serif", fontSize: '1.12rem', lineHeight: 1.75,
                            boxShadow: '0 2px 10px rgba(15,23,42,0.1)',
                        }}
                    />
                    {aviso && (
                        <div style={{ position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)', background: '#7f1d1d', color: 'white', padding: '8px 18px', borderRadius: 30, fontWeight: 700, fontSize: '0.9rem', boxShadow: '0 6px 20px rgba(0,0,0,0.3)', pointerEvents: 'none', whiteSpace: 'nowrap' }}>
                            {aviso}
                        </div>
                    )}
                </div>

                {!bloqueado && (
                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                        <button onClick={entregar} style={btn('#0f766e')}>📤 Entregar</button>
                    </div>
                )}
            </div>
        </div>
    );
}

// ── estilos ──
const lbl = { display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#475569', marginBottom: 5 };
const lblTop = { ...lbl, margin: '12px 0 6px' };
const inp = { width: '100%', padding: '9px 10px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: '0.9rem', boxSizing: 'border-box' };
const chip = { display: 'inline-flex', alignItems: 'center', gap: 4, background: '#e2e8f0', color: '#334155', borderRadius: 20, padding: '4px 10px', fontSize: '0.78rem', fontWeight: 700 };
const alerta = { borderRadius: 20, padding: '2px 8px', fontSize: '0.75rem', fontWeight: 800 };
const nota = { fontSize: '0.85rem', color: '#475569', background: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: 10, padding: '10px 12px' };
const btnMini = { background: '#f1f5f9', border: '1px solid #cbd5e1', color: '#334155', borderRadius: 8, padding: '5px 10px', cursor: 'pointer', fontWeight: 700, fontSize: '0.8rem', whiteSpace: 'nowrap' };
const btn = (bg) => ({ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, background: bg, color: 'white', border: 'none', borderRadius: 12, padding: '12px 20px', cursor: 'pointer', fontWeight: 800, fontSize: '0.95rem' });
