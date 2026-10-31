import React, { useState, useEffect, useCallback } from 'react';
import { db, auth } from '../firebase';
import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { collection, query, where, getDocs, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { SALAS, ORDEN_SALAS, TEMAS_MATERIA, infoPrueba } from './bancoEscape';
import {
    TIPO_JUEGO, ETAPAS, DURACIONES, RITMOS, ZOMBIS, MAX_PRUEBAS, EMOJIS_MANUAL, PLANTILLAS,
    nuevaId, pruebaMateria, pruebaManual,
} from './constantes';
import { generarPartidaFija, partidaVigente, PREGUNTAS_POR_SALA, PREGUNTAS_BATALLA } from './partidaFija';
import { descargarPdfEscape, resumenPartida } from './FichasEscape';
import { BuscadorRecursosEscape, CuerpoPruebaRecurso, pruebaDeRecurso } from './RecursosEditor';
import { MIN_PREGUNTAS_RECURSO, MAX_PREGUNTAS_RECURSO } from './recursosEscape';

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
    const pruebas = (Array.isArray(c.pruebas) ? c.pruebas : []).slice(0, MAX_PRUEBAS).map(p => (p.tipo === 'RECURSO'
        ? {
            id: p.id || nuevaId(), tipo: 'RECURSO', recursoId: p.recursoId || '', recursoTitulo: p.recursoTitulo || 'Recurso', autor: p.autor || '',
            hojas: Array.isArray(p.hojas) ? p.hojas : null, nombre: p.nombre || '', emoji: p.emoji || '📚',
            candadoModo: ['RESPUESTAS', 'CIFRAS', 'PISTA'].includes(p.candadoModo) ? p.candadoModo : 'RESPUESTAS',
            candadoCodigo: String(p.candadoCodigo || ''), candadoPista: String(p.candadoPista || ''),
            candadoPistas: Array.isArray(p.candadoPistas) ? p.candadoPistas.map(x => String(x || '')) : [],
            preguntas: (Array.isArray(p.preguntas) ? p.preguntas : [])
                .filter(q => q && q.texto && Array.isArray(q.opciones) && q.opciones.length >= 2 && q.correcta >= 0 && q.correcta < q.opciones.length)
                .slice(0, MAX_PREGUNTAS_RECURSO)
                .map(q => ({ texto: String(q.texto), ...(q.detalle ? { detalle: String(q.detalle) } : {}), opciones: q.opciones.map(String), correcta: Number(q.correcta) })),
        }
        : p.tipo === 'MANUAL'
        ? { id: p.id || nuevaId(), tipo: 'MANUAL', nombre: p.nombre || '', emoji: p.emoji || '🗝️', texto: p.texto || '', codigo: p.codigo || '', pista: p.pista || '', imagen: p.imagen || '', materiaRetos: p.materiaRetos || null, temaRetos: p.temaRetos || 'MIX' }
        : { id: p.id || nuevaId(), tipo: 'MATERIA', materia: SALAS[p.materia] ? p.materia : 'MATES', tema: p.tema || 'MIX', nombre: p.nombre || '' }));
    return {
        etapa: c.etapa === 'PRIMARIA' ? 'PRIMARIA' : 'ESO',
        minutos: Number(c.minutos) || 30, ritmo: Number(c.ritmo) || 5, zombi: ZOMBIS[c.zombi] ? c.zombi : 'NORMAL',
        pruebas: pruebas.length ? pruebas : [pruebaMateria('MATES')],
        partida: c.partida && Array.isArray(c.partida.pruebas) && Array.isArray(c.partida.batalla) ? c.partida : null,
        modo: ['PAPEL', 'ONLINE', 'MANDOS'].includes(c.modo) ? c.modo : (c.partida ? 'PAPEL' : 'ONLINE'),
        nPreguntas: Number(c.nPreguntas) || c.partida?.nPreguntas || 6,
        nBatalla: Number(c.nBatalla) || c.partida?.nBatalla || 8,
    };
}

export const MODOS = {
    ONLINE: { emoji: '📱', nombre: 'Online con móviles', desc: 'Proyectas la mansión y cada alumno juega con su móvil (QR o código). Las preguntas cambian en cada partida.' },
    PAPEL: { emoji: '📽️', nombre: 'Pizarra + fichas en papel', desc: 'Sin móviles: proyectas las preguntas y los alumnos anotan en un cuadernillo o una hoja de respuestas en PDF.' },
    MANDOS: { emoji: '🎮', nombre: 'Con mandos micro:bit', desc: 'Sin móviles: proyectas las preguntas y cada alumno responde A-D con su micro:bit. Su avatar aparece en la mansión.' },
};

/** Modo pizarra con fichas en papel: congela preguntas y candados y saca los PDF. */
function SeccionPapel({ config, setConfig, titulo }) {
    const nPreg = config.nPreguntas || config.partida?.nPreguntas || 6;
    const nBat = config.nBatalla || config.partida?.nBatalla || 8;
    const setNPreg = (n) => setConfig(c => ({ ...c, nPreguntas: n }));
    const setNBat = (n) => setConfig(c => ({ ...c, nBatalla: n }));
    const [creando, setCreando] = useState('');
    const vigente = partidaVigente(config);
    const errores = erroresConfig(config);
    const generar = () => {
        if (errores.length) { alert(errores.join(' · ')); return; }
        if (config.partida && !window.confirm('Se crearán preguntas nuevas: las fichas que ya hayas impreso dejarán de coincidir. ¿Seguir?')) return;
        setConfig(c => ({ ...c, partida: generarPartidaFija(c, { nPreguntas: nPreg, nBatalla: nBat }) }));
    };
    const pdf = async (tipo, soluciones) => {
        setCreando(tipo + soluciones);
        try { await descargarPdfEscape(tipo, { config: limpiarConfig(config), titulo, soluciones }); }
        catch (e) { alert('No se pudo crear el PDF: ' + e.message); }
        setCreando('');
    };
    return (
        <div style={{ marginTop: 20, padding: 14, borderRadius: 14, background: 'rgba(91,33,182,.18)', border: '2px solid rgba(167,139,250,.45)' }}>
            <h4 style={{ margin: '0 0 4px' }}>📄 Preguntas fijas y fichas en PDF</h4>
            <div style={{ fontSize: '.82rem', opacity: .8 }}>Se congelan las preguntas y los candados: lo que se proyecta es exactamente lo que sale en las fichas. Si no las generas, se crean solas al empezar en la pizarra o con mandos. Guarda el escape room para conservarlas.</div>
            <div style={{ ...fila, alignItems: 'center' }}>
                <span style={{ fontSize: '.85rem' }}>Preguntas por sala:</span>
                {PREGUNTAS_POR_SALA.map(n => <button key={n} className={`eh-chip ${nPreg === n ? 'on' : ''}`} style={{ padding: '5px 10px' }} onClick={() => setNPreg(n)}>{n}</button>)}
                <span style={{ fontSize: '.85rem', marginLeft: 8 }}>Batalla:</span>
                {PREGUNTAS_BATALLA.map(n => <button key={n} className={`eh-chip ${nBat === n ? 'on' : ''}`} style={{ padding: '5px 10px' }} onClick={() => setNBat(n)}>{n}</button>)}
            </div>
            <div style={{ ...fila, alignItems: 'center', marginTop: 10 }}>
                <button className="eh-btn2" onClick={generar}>{config.partida ? '🎲 Volver a generar las preguntas' : '🎲 Generar las preguntas fijas'}</button>
                <span style={{ fontSize: '.85rem', fontWeight: 700, color: vigente ? '#86efac' : config.partida ? '#fcd34d' : '#e9d5ff' }}>
                    {vigente ? `✔ ${resumenPartida(config)}` : config.partida ? '⚠ Has cambiado las pruebas o el número de preguntas: vuelve a generarlas' : 'Aún no hay preguntas fijas'}
                </span>
            </div>
            {vigente && <>
                <div style={{ ...fila, marginTop: 10 }}>
                    <button className="eh-btn2" disabled={!!creando} onClick={() => pdf('CUADERNILLO', false)}>{creando === 'CUADERNILLOfalse' ? '⏳ Creando…' : '📘 PDF cuadernillo (preguntas + candados)'}</button>
                    <button className="eh-btn2" disabled={!!creando} onClick={() => pdf('HOJA', false)}>{creando === 'HOJAfalse' ? '⏳ Creando…' : '📝 PDF hoja de respuestas'}</button>
                </div>
                <div style={{ ...fila }}>
                    <button className="eh-btn2" disabled={!!creando} onClick={() => pdf('CUADERNILLO', true)}>{creando === 'CUADERNILLOtrue' ? '⏳ Creando…' : '✅ Cuadernillo con soluciones (profe)'}</button>
                    <button className="eh-btn2" disabled={!!creando} onClick={() => pdf('HOJA', true)}>{creando === 'HOJAtrue' ? '⏳ Creando…' : '✅ Plantilla de corrección'}</button>
                </div>
            </>}
        </div>
    );
}

export function erroresConfig(config) {
    const errores = [];
    if (!config.pruebas.length) errores.push('Añade al menos una prueba.');
    config.pruebas.forEach((p, i) => {
        if (p.tipo === 'MANUAL' && !String(p.codigo || '').trim()) errores.push(`La prueba ${i + 1} (propia) necesita un código.`);
        if (p.tipo === 'MANUAL' && !String(p.texto || '').trim()) errores.push(`La prueba ${i + 1} (propia) necesita un texto para los alumnos.`);
        if (p.tipo === 'RECURSO' && (p.preguntas?.length || 0) < MIN_PREGUNTAS_RECURSO) errores.push(`La prueba ${i + 1} (recurso) necesita al menos ${MIN_PREGUNTAS_RECURSO} preguntas.`);
        if (p.tipo === 'RECURSO' && (p.candadoModo === 'CIFRAS' || p.candadoModo === 'PISTA')) {
            const cod = String(p.candadoCodigo || '').replace(/\s+/g, '');
            if (!cod) errores.push(`La prueba ${i + 1} (recurso) necesita el código del candado.`);
            else if (cod.length > 12) errores.push(`El código del candado de la prueba ${i + 1} es demasiado largo (máx. 12).`);
            else if (p.candadoModo === 'CIFRAS' && [...cod].some((_, k) => !String(p.candadoPistas?.[k] || '').trim())) errores.push(`En la prueba ${i + 1} falta la pista de alguna cifra o letra del candado.`);
            if (p.candadoModo === 'PISTA' && !String(p.candadoPista || '').trim()) errores.push(`La prueba ${i + 1} (recurso) necesita la pista del candado.`);
        }
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

function TarjetaPruebaEditor({ prueba, idx, pruebas, onCambiar, onMover, onBorrar, onDuplicar, onCambiarRecurso }) {
    const info = infoPrueba(prueba, idx, pruebas);
    const set = (c) => onCambiar({ ...prueba, ...c });
    const manual = prueba.tipo === 'MANUAL';
    const recurso = prueba.tipo === 'RECURSO';
    return (
        <div className="eh-panel" style={{ padding: 14, borderColor: (info.color || '#ff8c1a') + '88' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 34, height: 34, borderRadius: 10, background: 'rgba(255,140,26,.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900 }}>{idx + 1}</div>
                <div style={{ fontSize: '1.5rem' }}>{info.emoji}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{info.nombre}</div>
                    <div style={{ fontSize: '.78rem', opacity: .75 }}>{manual ? `🗝️ Prueba propia${prueba.materiaRetos ? ` · antes, preguntas de ${SALAS[prueba.materiaRetos]?.materia}` : ' · solo código'}` : recurso ? `📚 ${info.materia}` : info.materia}</div>
                </div>
                <button className="eh-btn2" style={{ padding: '5px 8px' }} disabled={idx === 0} onClick={() => onMover(-1)} title="Subir">↑</button>
                <button className="eh-btn2" style={{ padding: '5px 8px' }} disabled={idx === pruebas.length - 1} onClick={() => onMover(1)} title="Bajar">↓</button>
                <button className="eh-btn2" style={{ padding: '5px 8px' }} disabled={pruebas.length >= MAX_PRUEBAS} onClick={onDuplicar} title="Duplicar">⧉</button>
                <button className="eh-btn2" style={{ padding: '5px 8px' }} disabled={pruebas.length <= 1} onClick={onBorrar} title="Quitar">🗑</button>
            </div>

            {recurso && <CuerpoPruebaRecurso prueba={prueba} onCambiar={onCambiar} onCambiarRecurso={onCambiarRecurso} />}

            {!manual && !recurso && <>
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

function Biblioteca({ usuario, onAbrir, onCerrar, modoActual }) {
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
                <button className="eh-btn2" onClick={onCerrar}>{modoActual ? '← Volver al editor' : '← Volver'}</button>
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
                                    {c.pruebas.map((p, i) => infoPrueba(p, i, c.pruebas).emoji).join(' ')} · {c.pruebas.length} pruebas · {ETAPAS.find(e => e.v === c.etapa)?.l} · {c.minutos} min{c.partida ? ' · 📄 con fichas' : ''}
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

export default function EditorEscape({ config, setConfig, usuario: usuarioProp, onCrear, onAtras, onPizarra, meta: metaExt, setMeta: setMetaExt }) {
    const [vista, setVista] = useState('EDITAR');
    const [sesion, setSesion] = useState(null);       // usuario recién logueado desde el aviso de guardar
    const usuario = usuarioProp?.uid ? usuarioProp : sesion;
    const [pedirLogin, setPedirLogin] = useState(null); // null | { comoNuevo }
    const [entrando, setEntrando] = useState(false);
    const [errorLogin, setErrorLogin] = useState('');
    // título / público / guardado viven en el padre para no perderlos al ir a la pizarra y volver
    const [metaLocal, setMetaLocal] = useState({ titulo: '', publico: true, guardado: null });
    const meta = metaExt || metaLocal, setMeta = setMetaExt || setMetaLocal;
    const { titulo, publico, guardado } = meta; // guardado: { id, local }
    const setTitulo = (v) => setMeta(m => ({ ...m, titulo: v }));
    const setPublico = (v) => setMeta(m => ({ ...m, publico: v }));
    const setGuardado = (v) => setMeta(m => ({ ...m, guardado: v }));
    const [msg, setMsg] = useState('');
    const [errores, setErrores] = useState([]);
    const [buscador, setBuscador] = useState(null);   // null | 'NUEVA' | id de la prueba a cambiar
    const elegirRecurso = (r) => {
        const destino = buscador;
        const base = destino && destino !== 'NUEVA' ? config.pruebas.find(p => p.id === destino) : null;
        const prueba = pruebaDeRecurso(r, null, base ? { ...base } : { id: nuevaId(), nombre: '', emoji: '📚', candadoModo: 'RESPUESTAS' });
        if (prueba.preguntas.length < MIN_PREGUNTAS_RECURSO) { alert('Ese recurso no tiene suficientes preguntas compatibles.'); return; }
        setBuscador(null);
        setConfig(c => ({ ...c, pruebas: base ? c.pruebas.map(p => (p.id === base.id ? prueba : p)) : [...c.pruebas, prueba] }));
    };

    const pruebas = config.pruebas;
    const setPruebas = (fn) => setConfig(c => ({ ...c, pruebas: typeof fn === 'function' ? fn(c.pruebas) : fn }));
    const aviso = (t) => { setMsg(t); setTimeout(() => setMsg(''), 3500); };

    const guardar = async (comoNuevo = false, { yo = usuario, soloNavegador = false } = {}) => {
        const t = titulo.trim();
        if (!t) { aviso('⚠ Ponle un título para guardarlo.'); return; }
        const errs = erroresConfig(config); setErrores(errs);
        if (errs.length) return;
        // sin sesión se pregunta, salvo si ya eligió guardarlo en este navegador
        if (!yo?.uid && !soloNavegador && !(guardado?.local && !comoNuevo)) { setErrorLogin(''); setPedirLogin({ comoNuevo }); return; }
        const limpia = limpiarConfig(config);
        try {
            if (yo?.uid) {
                const datos = {
                    titulo: t, tipoJuego: TIPO_JUEGO, tipo: TIPO_JUEGO, config: limpia, isPrivate: !publico, isFinished: true,
                    profesorUid: yo.uid, profesorNombre: yo.displayName || 'Profesor', fechaModificacion: new Date(),
                };
                if (guardado && !guardado.local && !comoNuevo) await updateDoc(doc(db, 'resources', guardado.id), datos);
                else { const r = await addDoc(collection(db, 'resources'), { ...datos, playCount: 0, fechaCreacion: new Date() }); setGuardado({ id: r.id, local: false }); }
                // ya está en la cuenta: fuera la copia del navegador
                if (guardado?.local) escribirLocales(leerLocales().filter(l => l.id !== guardado.id));
            } else {
                const lista = leerLocales();
                const id = guardado?.local && !comoNuevo ? guardado.id : 'local_' + nuevaId();
                escribirLocales([{ id, titulo: t, config: limpia, fecha: Date.now() }, ...lista.filter(l => l.id !== id)]);
                setGuardado({ id, local: true });
            }
            aviso('💾 ¡Guardado!');
        } catch (e) { aviso('⚠ No se pudo guardar: ' + e.message); }
    };

    /** Login con ventana emergente, sin salir del editor, y guardado en la cuenta. */
    const entrarYGuardar = async (comoNuevo = false) => {
        setErrorLogin(''); setEntrando(true);
        try {
            const { user } = await signInWithPopup(auth, new GoogleAuthProvider());
            setSesion(user); setPedirLogin(null);
            await guardar(comoNuevo, { yo: user });
        } catch (e) {
            if (e?.code === 'auth/popup-blocked') setErrorLogin('El navegador ha bloqueado la ventana de inicio de sesión. Permítela y vuelve a probar.');
            else if (!['auth/popup-closed-by-user', 'auth/cancelled-popup-request', 'auth/user-cancelled'].includes(e?.code)) setErrorLogin('No se ha podido iniciar sesión. Tu escape room sigue aquí: prueba otra vez.');
        }
        setEntrando(false);
    };

    const crear = () => {
        const errs = erroresConfig(config); setErrores(errs);
        if (errs.length) return;
        const c = { ...config, modo: 'ONLINE' };
        setConfig(c);
        onCrear(limpiarConfig(c));
    };
    // Modo pizarra: si aún no hay preguntas fijas (o han quedado viejas) se generan antes de empezar
    const jugarPizarra = (m) => {
        const errs = erroresConfig(config); setErrores(errs);
        if (errs.length) return;
        let c = { ...config, modo: m };
        if (!partidaVigente(config)) {
            if (config.partida && !window.confirm('Has cambiado las pruebas o el número de preguntas: se generarán preguntas nuevas y las fichas que hayas impreso dejarán de coincidir. ¿Seguir?')) return;
            c = { ...c, partida: generarPartidaFija(config, { nPreguntas: config.nPreguntas || 6, nBatalla: config.nBatalla || 8 }) };
        }
        setConfig(c);
        onPizarra(limpiarConfig(c), titulo);
    };
    const modo = config.modo;   // el último con el que se jugó: un guardado sigue proponiendo el suyo

    if (vista === 'ABRIR') {
        return (
            <div style={{ maxWidth: 860, margin: '30px auto', padding: '0 14px' }}>
                <Biblioteca usuario={usuario} onCerrar={() => setVista('EDITAR')} modoActual={modo}
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
                <div style={{ fontSize: '.82rem', opacity: .75, marginTop: 2 }}>Puedes repetir materia (p. ej., un escape room solo de Matemáticas), usar las preguntas de un recurso creado por otro profe o crear pruebas propias con tu texto y un código que los alumnos buscarán por el aula.</div>
                {buscador && <BuscadorRecursosEscape usuario={usuario} onElegir={elegirRecurso} onCerrar={() => setBuscador(null)} />}
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
                            onDuplicar={() => setPruebas(l => { const a = [...l]; a.splice(i + 1, 0, { ...p, id: nuevaId() }); return a; })}
                            onCambiarRecurso={() => setBuscador(p.id)} />
                    ))}
                </div>
                <div style={{ ...fila, marginTop: 12 }}>
                    <button className="eh-btn2" disabled={pruebas.length >= MAX_PRUEBAS} onClick={() => setPruebas(l => [...l, pruebaMateria('MATES')])}>➕ Prueba de una materia</button>
                    <button className="eh-btn2" disabled={pruebas.length >= MAX_PRUEBAS} onClick={() => setPruebas(l => [...l, pruebaManual()])}>🗝️ Prueba propia (texto + código)</button>
                    <button className="eh-btn2" disabled={pruebas.length >= MAX_PRUEBAS} onClick={() => setBuscador('NUEVA')}>📚 Prueba con un recurso de otro profe</button>
                    <span style={{ fontSize: '.78rem', opacity: .6, alignSelf: 'center' }}>{pruebas.length}/{MAX_PRUEBAS}</span>
                </div>

                <h4 style={{ margin: '18px 0 0' }}>⏳ Tiempo para las salas</h4>
                <div style={fila}>{DURACIONES.map(m => <button key={m} className={`eh-chip ${config.minutos === m ? 'on' : ''}`} onClick={() => setConfig(c => ({ ...c, minutos: m }))}>{m} min</button>)}</div>

                <details style={{ marginTop: 16 }}>
                <summary style={{ cursor: 'pointer', fontWeight: 800 }}>📱 Ajustes para jugar con móviles</summary>
                <h4 style={{ margin: '12px 0 0' }}>🕯️ Duración de cada sala</h4>
                <div style={fila}>{RITMOS.map(r => <button key={r.v} title={r.d} className={`eh-chip ${config.ritmo === r.v ? 'on' : ''}`} onClick={() => setConfig(c => ({ ...c, ritmo: r.v }))}>{r.l}</button>)}</div>
                <div style={{ fontSize: '.8rem', opacity: .7, marginTop: 4 }}>{RITMOS.find(r => r.v === config.ritmo)?.d} (la meta se calcula con los alumnos conectados).</div>

                <h4 style={{ margin: '16px 0 0' }}>🧟 El zombi final</h4>
                <div style={fila}>{Object.entries(ZOMBIS).map(([k, z]) => <button key={k} className={`eh-chip ${config.zombi === k ? 'on' : ''}`} onClick={() => setConfig(c => ({ ...c, zombi: k }))}>{z.l}</button>)}</div>
                </details>

                {/* abierto si ya hay preguntas fijas (un guardado con fichas las enseña como antes) */}
                <details open={!!config.partida} style={{ marginTop: 12 }}>
                    <summary style={{ cursor: 'pointer', fontWeight: 800 }}>📄 Fichas en PDF y preguntas fijas (pizarra y mandos)</summary>
                    <SeccionPapel config={config} setConfig={setConfig} titulo={titulo} />
                </details>

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
                        {!usuario?.uid && guardado?.local && !pedirLogin && <button className="eh-btn2" disabled={entrando} onClick={() => { setErrorLogin(''); setPedirLogin({ comoNuevo: false }); }}>🔐 Subirlo a mi cuenta</button>}
                    </div>
                    {guardado?.local && !usuario?.uid && !pedirLogin && <div style={{ fontSize: '.78rem', opacity: .65, marginTop: 6 }}>Guardado solo en este navegador.</div>}
                    {pedirLogin && !usuario?.uid && (
                        <div style={{ marginTop: 12, padding: 12, borderRadius: 12, background: 'rgba(250,204,21,.08)', border: '1px solid rgba(250,204,21,.35)' }}>
                            <div style={{ fontWeight: 800 }}>🔐 No has iniciado sesión</div>
                            <div style={{ fontSize: '.85rem', opacity: .85, margin: '4px 0 8px' }}>Inicia sesión para guardarlo en tu cuenta y usarlo desde cualquier ordenador. No perderás nada de lo que has preparado.</div>
                            <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, fontSize: '.88rem', cursor: 'pointer' }}>
                                <input type="checkbox" checked={publico} onChange={e => setPublico(e.target.checked)} />
                                Compartir en la biblioteca pública {publico && pruebas.some(p => p.tipo === 'MANUAL') && <span style={{ color: '#fcd34d' }}>(otros profes podrán ver tus códigos propios)</span>}
                            </label>
                            <div style={fila}>
                                <button className="eh-btn2" disabled={entrando} onClick={() => entrarYGuardar(pedirLogin.comoNuevo)}>{entrando ? '⏳ Esperando a Google…' : '🔐 Iniciar sesión con Google y guardar'}</button>
                                {(!guardado?.local || pedirLogin.comoNuevo) && <button className="eh-btn2" disabled={entrando} onClick={() => { const n = pedirLogin.comoNuevo; setPedirLogin(null); guardar(n, { soloNavegador: true }); }}>💻 Guardar solo en este navegador</button>}
                                <button className="eh-btn2" disabled={entrando} onClick={() => setPedirLogin(null)}>Cancelar</button>
                            </div>
                            {errorLogin && <div style={{ marginTop: 8, color: '#fca5a5', fontWeight: 700 }}>⚠ {errorLogin}</div>}
                        </div>
                    )}
                    {msg && <div style={{ marginTop: 8, fontWeight: 700 }}>{msg}</div>}
                </div>

                {errores.length > 0 && <div style={{ marginTop: 14, color: '#fca5a5', fontWeight: 700 }}>{errores.map((e, i) => <div key={i}>⚠ {e}</div>)}</div>}
                <h4 style={{ margin: '20px 0 0' }}>▶️ ¿Cómo vais a jugar?</h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 10, marginTop: 8 }}>
                    {Object.keys(MODOS).map(k => (
                        <div key={k} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            <button className="eh-btn" style={{ fontSize: '1.02rem' }} onClick={() => (k === 'ONLINE' ? crear() : jugarPizarra(k))}>{MODOS[k].emoji} {MODOS[k].nombre}</button>
                            <div style={{ fontSize: '.78rem', opacity: .8, lineHeight: 1.35 }}>{MODOS[k].desc}{modo === k && <b style={{ color: '#fcd34d' }}> · El de la última vez</b>}</div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
