import React, { useState, useEffect, useCallback } from 'react';
import { db } from '../firebase';
import { collection, query, where, getDocs, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { SALAS, ORDEN_SALAS, TEMAS_MATERIA, infoPrueba } from './bancoEscape';
import {
    TIPO_JUEGO, ETAPAS, DURACIONES, RITMOS, ZOMBIS, MAX_PRUEBAS, EMOJIS_MANUAL, PLANTILLAS,
    nuevaId, pruebaMateria, pruebaManual,
} from './constantes';

/**
 *  Editor del escape room (profesor): pruebas en orden (de materia con su tema o propias con texto + código),
 *  ajustes de la partida y guardado:
 *   · con sesión → colección `resources` (tipoJuego ESCAPE_HALLOWEEN, privada o pública en la biblioteca);
 *   · sin sesión → en este navegador (localStorage).
 */

const CLAVE_LOCAL = 'pikt_escape_guardados';
const leerLocales = () => { try { return JSON.parse(localStorage.getItem(CLAVE_LOCAL) || '[]'); } catch { return []; } };
const escribirLocales = (l) => { try { localStorage.setItem(CLAVE_LOCAL, JSON.stringify(l.slice(0, 30))); } catch { /* lleno o bloqueado */ } };

/** Normaliza una configuración que viene de Firestore / localStorage. */
export function limpiarConfig(c = {}) {
    const pruebas = (Array.isArray(c.pruebas) ? c.pruebas : []).slice(0, MAX_PRUEBAS).map(p => (p.tipo === 'MANUAL'
        ? { id: p.id || nuevaId(), tipo: 'MANUAL', nombre: p.nombre || '', emoji: p.emoji || '🗝️', texto: p.texto || '', codigo: p.codigo || '', pista: p.pista || '', imagen: p.imagen || '', materiaRetos: p.materiaRetos || null, temaRetos: p.temaRetos || 'MIX' }
        : { id: p.id || nuevaId(), tipo: 'MATERIA', materia: SALAS[p.materia] ? p.materia : 'MATES', tema: p.tema || 'MIX', nombre: p.nombre || '' }));
    return {
        etapa: c.etapa === 'PRIMARIA' ? 'PRIMARIA' : 'ESO',
        minutos: Number(c.minutos) || 30, ritmo: Number(c.ritmo) || 5, zombi: ZOMBIS[c.zombi] ? c.zombi : 'NORMAL',
        pruebas: pruebas.length ? pruebas : [pruebaMateria('MATES')],
    };
}

export function erroresConfig(config) {
    const errores = [];
    if (!config.pruebas.length) errores.push('Añade al menos una prueba.');
    config.pruebas.forEach((p, i) => {
        if (p.tipo === 'MANUAL' && !String(p.codigo || '').trim()) errores.push(`La prueba ${i + 1} (propia) necesita un código.`);
        if (p.tipo === 'MANUAL' && !String(p.texto || '').trim()) errores.push(`La prueba ${i + 1} (propia) necesita un texto para los alumnos.`);
    });
    return errores;
}

const campo = { width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 10, border: '2px solid rgba(255,255,255,.2)', background: 'rgba(0,0,0,.35)', color: '#fff', fontFamily: 'inherit', fontSize: '.95rem', outline: 'none' };
const etiqueta = { fontWeight: 700, fontSize: '.82rem', opacity: .85, display: 'block', margin: '10px 0 4px' };
const fila = { display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 };

function SelectorMateria({ materia, tema, onChange, permitirNinguna = false }) {
    return (
        <>
            <div style={fila}>
                {permitirNinguna && <button className={`eh-chip ${!materia ? 'on' : ''}`} style={{ padding: '6px 10px', fontSize: '.82rem' }} onClick={() => onChange(null, 'MIX')}>🚫 Sin preguntas</button>}
                {ORDEN_SALAS.map(id => (
                    <button key={id} className={`eh-chip ${materia === id ? 'on' : ''}`} style={{ padding: '6px 10px', fontSize: '.82rem' }} onClick={() => onChange(id, 'MIX')}>
                        {SALAS[id].emoji} {SALAS[id].materia}
                    </button>
                ))}
            </div>
            {materia && (
                <div style={fila}>
                    {(TEMAS_MATERIA[materia] || []).map(t => (
                        <button key={t.v} className={`eh-chip ${tema === t.v ? 'on' : ''}`} style={{ padding: '5px 9px', fontSize: '.78rem' }} onClick={() => onChange(materia, t.v)}>{t.l}</button>
                    ))}
                </div>
            )}
        </>
    );
}

function TarjetaPruebaEditor({ prueba, idx, pruebas, onCambiar, onMover, onBorrar, onDuplicar }) {
    const info = infoPrueba(prueba, idx, pruebas);
    const set = (c) => onCambiar({ ...prueba, ...c });
    const manual = prueba.tipo === 'MANUAL';
    return (
        <div className="eh-panel" style={{ padding: 14, borderColor: (info.color || '#ff8c1a') + '88' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 34, height: 34, borderRadius: 10, background: 'rgba(255,140,26,.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900 }}>{idx + 1}</div>
                <div style={{ fontSize: '1.5rem' }}>{info.emoji}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{info.nombre}</div>
                    <div style={{ fontSize: '.78rem', opacity: .75 }}>{manual ? `🗝️ Prueba propia${prueba.materiaRetos ? ` · antes, preguntas de ${SALAS[prueba.materiaRetos]?.materia}` : ' · solo código'}` : info.materia}</div>
                </div>
                <button className="eh-btn2" style={{ padding: '5px 8px' }} disabled={idx === 0} onClick={() => onMover(-1)} title="Subir">↑</button>
                <button className="eh-btn2" style={{ padding: '5px 8px' }} disabled={idx === pruebas.length - 1} onClick={() => onMover(1)} title="Bajar">↓</button>
                <button className="eh-btn2" style={{ padding: '5px 8px' }} disabled={pruebas.length >= MAX_PRUEBAS} onClick={onDuplicar} title="Duplicar">⧉</button>
                <button className="eh-btn2" style={{ padding: '5px 8px' }} disabled={pruebas.length <= 1} onClick={onBorrar} title="Quitar">🗑</button>
            </div>

            {!manual && <>
                <SelectorMateria materia={prueba.materia} tema={prueba.tema} onChange={(m, t) => set({ materia: m || 'MATES', tema: t })} />
                <label style={etiqueta}>Nombre de la sala (opcional)</label>
                <input style={campo} value={prueba.nombre} maxLength={50} placeholder={infoPrueba({ ...prueba, nombre: '' }, idx, pruebas).nombre} onChange={e => set({ nombre: e.target.value })} />
            </>}

            {manual && <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8 }}>
                    <div>
                        <label style={etiqueta}>Nombre de la sala</label>
                        <input style={campo} value={prueba.nombre} maxLength={50} placeholder="La habitación secreta" onChange={e => set({ nombre: e.target.value })} />
                    </div>
                    <div>
                        <label style={etiqueta}>Icono</label>
                        <select style={{ ...campo, width: 74, fontSize: '1.2rem', padding: '7px' }} value={prueba.emoji} onChange={e => set({ emoji: e.target.value })}>
                            {EMOJIS_MANUAL.map(e => <option key={e} value={e} style={{ background: '#1a0b2e' }}>{e}</option>)}
                        </select>
                    </div>
                </div>
                <label style={etiqueta}>Texto que verán los alumnos (el reto, el acertijo o dónde buscar)</label>
                <textarea style={{ ...campo, minHeight: 80, resize: 'vertical' }} value={prueba.texto} maxLength={800}
                    placeholder="Ej.: El fantasma ha escondido el código en un sobre dentro de un libro de la biblioteca del aula. ¡Encontradlo!"
                    onChange={e => set({ texto: e.target.value })} />
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 8 }}>
                    <div>
                        <label style={etiqueta}>🔐 Código que abre la puerta</label>
                        <input style={{ ...campo, letterSpacing: 2, fontWeight: 800 }} value={prueba.codigo} maxLength={60} placeholder="Ej.: 1031 o CALABAZA" onChange={e => set({ codigo: e.target.value })} />
                        <div style={{ fontSize: '.72rem', opacity: .65, marginTop: 3 }}>Da igual mayúsculas y tildes. Varias respuestas válidas: sepáralas con |</div>
                    </div>
                    <div>
                        <label style={etiqueta}>💡 Pista (opcional)</label>
                        <input style={campo} value={prueba.pista} maxLength={200} placeholder="Ej.: Mirad bajo el reloj" onChange={e => set({ pista: e.target.value })} />
                    </div>
                </div>
                <label style={etiqueta}>🖼️ Imagen (enlace, opcional)</label>
                <input style={campo} value={prueba.imagen} maxLength={500} placeholder="https://…" onChange={e => set({ imagen: e.target.value.trim() })} />
                <label style={etiqueta}>¿Antes del código, preguntas para cargar la puerta?</label>
                <SelectorMateria permitirNinguna materia={prueba.materiaRetos} tema={prueba.temaRetos} onChange={(m, t) => set({ materiaRetos: m, temaRetos: t })} />
            </>}
        </div>
    );
}

function Biblioteca({ usuario, onAbrir, onCerrar }) {
    const [pestana, setPestana] = useState('MIOS');
    const [lista, setLista] = useState(null);
    const [error, setError] = useState('');

    const cargar = useCallback(async () => {
        setLista(null); setError('');
        try {
            if (pestana === 'MIOS') {
                const locales = leerLocales().map(l => ({ ...l, local: true }));
                let nube = [];
                if (usuario?.uid) {
                    const s = await getDocs(query(collection(db, 'resources'), where('profesorUid', '==', usuario.uid), where('tipoJuego', '==', TIPO_JUEGO)));
                    nube = s.docs.map(d => ({ id: d.id, ...d.data(), mio: true }));
                }
                setLista([...nube, ...locales]);
            } else {
                const s = await getDocs(query(collection(db, 'resources'), where('tipoJuego', '==', TIPO_JUEGO), where('isPrivate', '==', false)));
                setLista(s.docs.map(d => ({ id: d.id, ...d.data(), mio: d.data().profesorUid === usuario?.uid })));
            }
        } catch (e) { setError('No se pudo cargar: ' + e.message); setLista([]); }
    }, [pestana, usuario]);
    useEffect(() => { cargar(); }, [cargar]);

    const borrar = async (r) => {
        if (!window.confirm(`¿Borrar «${r.titulo}»?`)) return;
        try {
            if (r.local) escribirLocales(leerLocales().filter(l => l.id !== r.id));
            else await deleteDoc(doc(db, 'resources', r.id));
            cargar();
        } catch (e) { alert('No se pudo borrar: ' + e.message); }
    };

    const fecha = (r) => { const f = r.fechaModificacion || r.fechaCreacion || r.fecha; const d = f?.toDate ? f.toDate() : f ? new Date(f) : null; return d && !isNaN(d) ? d.toLocaleDateString() : ''; };

    return (
        <div className="eh-panel eh-aparece" style={{ padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <button className="eh-btn2" onClick={onCerrar}>← Volver al editor</button>
                <div style={{ flex: 1 }} />
                <button className={`eh-chip ${pestana === 'MIOS' ? 'on' : ''}`} onClick={() => setPestana('MIOS')}>📂 Mis escape rooms</button>
                <button className={`eh-chip ${pestana === 'PUBLICOS' ? 'on' : ''}`} onClick={() => setPestana('PUBLICOS')}>🌍 Biblioteca</button>
            </div>
            {!usuario?.uid && pestana === 'MIOS' && <p style={{ fontSize: '.85rem', opacity: .75 }}>Sin sesión iniciada, los escape rooms se guardan solo en este navegador.</p>}
            {error && <p style={{ color: '#fca5a5' }}>{error}</p>}
            {lista === null && <p>🕯️ Cargando…</p>}
            {lista?.length === 0 && <p style={{ opacity: .7 }}>{pestana === 'MIOS' ? 'Todavía no has guardado ningún escape room.' : 'Aún no hay escape rooms públicos.'}</p>}
            <div style={{ display: 'grid', gap: 8, marginTop: 10 }}>
                {lista?.map(r => {
                    const c = limpiarConfig(r.config);
                    return (
                        <div key={(r.local ? 'l' : 'n') + r.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 12, borderRadius: 14, background: 'rgba(0,0,0,.3)', border: '1px solid rgba(255,255,255,.12)' }}>
                            <div style={{ fontSize: '1.6rem' }}>🎃</div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontWeight: 800 }}>{r.titulo || 'Sin título'} {r.local ? <span style={{ fontSize: '.7rem', opacity: .7 }}>(este navegador)</span> : r.isPrivate === false ? <span style={{ fontSize: '.7rem', opacity: .7 }}>(público)</span> : null}</div>
                                <div style={{ fontSize: '.8rem', opacity: .75 }}>
                                    {c.pruebas.map((p, i) => infoPrueba(p, i, c.pruebas).emoji).join(' ')} · {c.pruebas.length} pruebas · {ETAPAS.find(e => e.v === c.etapa)?.l} · {c.minutos} min
                                    {pestana === 'PUBLICOS' && r.profesorNombre ? ` · ${r.profesorNombre}` : ''} {fecha(r) && `· ${fecha(r)}`}
                                </div>
                            </div>
                            <button className="eh-btn" style={{ padding: '8px 14px', fontSize: '.9rem' }} onClick={() => onAbrir(r, c)}>Abrir</button>
                            {(r.mio || r.local) && <button className="eh-btn2" style={{ padding: '6px 9px' }} onClick={() => borrar(r)}>🗑</button>}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

export default function EditorEscape({ config, setConfig, usuario, onCrear, onAtras }) {
    const [vista, setVista] = useState('EDITAR');
    const [titulo, setTitulo] = useState('');
    const [publico, setPublico] = useState(false);
    const [guardado, setGuardado] = useState(null); // { id, local }
    const [msg, setMsg] = useState('');
    const [errores, setErrores] = useState([]);

    const pruebas = config.pruebas;
    const setPruebas = (fn) => setConfig(c => ({ ...c, pruebas: typeof fn === 'function' ? fn(c.pruebas) : fn }));
    const aviso = (t) => { setMsg(t); setTimeout(() => setMsg(''), 3500); };

    const guardar = async (comoNuevo = false) => {
        const t = titulo.trim();
        if (!t) { aviso('⚠ Ponle un título para guardarlo.'); return; }
        const errs = erroresConfig(config); setErrores(errs);
        if (errs.length) return;
        const limpia = limpiarConfig(config);
        try {
            if (usuario?.uid) {
                const datos = {
                    titulo: t, tipoJuego: TIPO_JUEGO, tipo: TIPO_JUEGO, config: limpia, isPrivate: !publico, isFinished: true,
                    profesorUid: usuario.uid, profesorNombre: usuario.displayName || 'Profesor', fechaModificacion: new Date(),
                };
                if (guardado && !guardado.local && !comoNuevo) await updateDoc(doc(db, 'resources', guardado.id), datos);
                else { const r = await addDoc(collection(db, 'resources'), { ...datos, playCount: 0, fechaCreacion: new Date() }); setGuardado({ id: r.id, local: false }); }
            } else {
                const lista = leerLocales();
                const id = guardado?.local && !comoNuevo ? guardado.id : 'local_' + nuevaId();
                escribirLocales([{ id, titulo: t, config: limpia, fecha: Date.now() }, ...lista.filter(l => l.id !== id)]);
                setGuardado({ id, local: true });
            }
            aviso('💾 ¡Guardado!');
        } catch (e) { aviso('⚠ No se pudo guardar: ' + e.message); }
    };

    const crear = () => {
        const errs = erroresConfig(config); setErrores(errs);
        if (!errs.length) onCrear(limpiarConfig(config));
    };

    if (vista === 'ABRIR') {
        return (
            <div style={{ maxWidth: 860, margin: '30px auto', padding: '0 14px' }}>
                <Biblioteca usuario={usuario} onCerrar={() => setVista('EDITAR')}
                    onAbrir={(r, c) => {
                        setConfig(c); setTitulo(r.titulo || ''); setPublico(r.isPrivate === false);
                        setGuardado(r.local ? { id: r.id, local: true } : r.mio ? { id: r.id, local: false } : null);
                        setVista('EDITAR'); aviso(r.mio || r.local ? '📂 Abierto. Los cambios se guardan sobre el mismo.' : '📂 Abierto. Al guardarlo se creará una copia tuya.');
                    }} />
            </div>
        );
    }

    return (
        <div style={{ maxWidth: 860, margin: '24px auto', padding: '0 14px 40px', position: 'relative', zIndex: 1 }}>
            <div className="eh-panel eh-aparece" style={{ padding: 22 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <button className="eh-btn2" onClick={onAtras}>← Atrás</button>
                    <div style={{ flex: 1 }} />
                    <button className="eh-btn2" onClick={() => setVista('ABRIR')}>📂 Abrir guardado</button>
                </div>
                <h2 className="eh-titulo" style={{ fontSize: '2.2rem', marginTop: 10 }}>Preparar la mansión</h2>

                <h4 style={{ margin: '14px 0 0' }}>🎓 Etapa</h4>
                <div style={fila}>{ETAPAS.map(e => <button key={e.v} className={`eh-chip ${config.etapa === e.v ? 'on' : ''}`} onClick={() => setConfig(c => ({ ...c, etapa: e.v }))}>{e.l}</button>)}</div>

                <h4 style={{ margin: '18px 0 0' }}>🚪 Pruebas (salas), en orden</h4>
                <div style={{ fontSize: '.82rem', opacity: .75, marginTop: 2 }}>Puedes repetir materia (p. ej., un escape room solo de Matemáticas) o crear pruebas propias con tu texto y un código que los alumnos buscarán por el aula.</div>
                <div style={fila}>
                    <span style={{ fontSize: '.82rem', opacity: .8, alignSelf: 'center' }}>Plantillas:</span>
                    {PLANTILLAS.map(p => <button key={p.id} className="eh-chip" style={{ padding: '6px 10px', fontSize: '.82rem' }} onClick={() => setPruebas(p.crear(config.etapa))}>{p.l}</button>)}
                </div>
                <div style={{ display: 'grid', gap: 10, marginTop: 12 }}>
                    {pruebas.map((p, i) => (
                        <TarjetaPruebaEditor key={p.id} prueba={p} idx={i} pruebas={pruebas}
                            onCambiar={(n) => setPruebas(l => l.map(x => (x.id === p.id ? n : x)))}
                            onMover={(d) => setPruebas(l => { const a = [...l]; const j = i + d; [a[i], a[j]] = [a[j], a[i]]; return a; })}
                            onBorrar={() => setPruebas(l => l.filter(x => x.id !== p.id))}
                            onDuplicar={() => setPruebas(l => { const a = [...l]; a.splice(i + 1, 0, { ...p, id: nuevaId() }); return a; })} />
                    ))}
                </div>
                <div style={{ ...fila, marginTop: 12 }}>
                    <button className="eh-btn2" disabled={pruebas.length >= MAX_PRUEBAS} onClick={() => setPruebas(l => [...l, pruebaMateria('MATES')])}>➕ Prueba de una materia</button>
                    <button className="eh-btn2" disabled={pruebas.length >= MAX_PRUEBAS} onClick={() => setPruebas(l => [...l, pruebaManual()])}>🗝️ Prueba propia (texto + código)</button>
                    <span style={{ fontSize: '.78rem', opacity: .6, alignSelf: 'center' }}>{pruebas.length}/{MAX_PRUEBAS}</span>
                </div>

                <h4 style={{ margin: '18px 0 0' }}>⏳ Tiempo para las salas</h4>
                <div style={fila}>{DURACIONES.map(m => <button key={m} className={`eh-chip ${config.minutos === m ? 'on' : ''}`} onClick={() => setConfig(c => ({ ...c, minutos: m }))}>{m} min</button>)}</div>

                <h4 style={{ margin: '16px 0 0' }}>🕯️ Duración de cada sala</h4>
                <div style={fila}>{RITMOS.map(r => <button key={r.v} title={r.d} className={`eh-chip ${config.ritmo === r.v ? 'on' : ''}`} onClick={() => setConfig(c => ({ ...c, ritmo: r.v }))}>{r.l}</button>)}</div>
                <div style={{ fontSize: '.8rem', opacity: .7, marginTop: 4 }}>{RITMOS.find(r => r.v === config.ritmo)?.d} (la meta se calcula con los alumnos conectados).</div>

                <h4 style={{ margin: '16px 0 0' }}>🧟 El zombi final</h4>
                <div style={fila}>{Object.entries(ZOMBIS).map(([k, z]) => <button key={k} className={`eh-chip ${config.zombi === k ? 'on' : ''}`} onClick={() => setConfig(c => ({ ...c, zombi: k }))}>{z.l}</button>)}</div>

                <div style={{ marginTop: 20, padding: 14, borderRadius: 14, background: 'rgba(0,0,0,.28)', border: '1px dashed rgba(255,255,255,.2)' }}>
                    <h4 style={{ margin: '0 0 8px' }}>💾 Guardar este escape room</h4>
                    <input style={campo} value={titulo} maxLength={80} placeholder="Título, p. ej.: Halloween 2.º ESO · Matemáticas" onChange={e => setTitulo(e.target.value)} />
                    {usuario?.uid && (
                        <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, fontSize: '.88rem', cursor: 'pointer' }}>
                            <input type="checkbox" checked={publico} onChange={e => setPublico(e.target.checked)} />
                            Compartir en la biblioteca pública {publico && pruebas.some(p => p.tipo === 'MANUAL') && <span style={{ color: '#fcd34d' }}>(otros profes podrán ver tus códigos propios)</span>}
                        </label>
                    )}
                    <div style={{ ...fila, marginTop: 10 }}>
                        <button className="eh-btn2" onClick={() => guardar(false)}>💾 {guardado ? 'Guardar cambios' : 'Guardar'}</button>
                        {guardado && <button className="eh-btn2" onClick={() => guardar(true)}>⧉ Guardar como nuevo</button>}
                        {!usuario?.uid && <span style={{ fontSize: '.78rem', opacity: .65, alignSelf: 'center' }}>Sin sesión: se guarda en este navegador.</span>}
                    </div>
                    {msg && <div style={{ marginTop: 8, fontWeight: 700 }}>{msg}</div>}
                </div>

                {errores.length > 0 && <div style={{ marginTop: 14, color: '#fca5a5', fontWeight: 700 }}>{errores.map((e, i) => <div key={i}>⚠ {e}</div>)}</div>}
                <button className="eh-btn" style={{ width: '100%', marginTop: 18, fontSize: '1.15rem' }} onClick={crear}>🎃 Crear la sala y mostrar el QR</button>
            </div>
        </div>
    );
}
