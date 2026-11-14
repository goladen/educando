// Panel del admin para revisar los nombres que escriben los alumnos en
// rankings, informes y salas en vivo. Recorre las colecciones, marca los
// nombres que el filtro (utils/filtroNombres.js) considera inapropiados o los
// que contienen un texto buscado, y permite:
//   · 🔁 cambiar el nombre por «Pikatron»
//   · 👤 quitar solo a ese jugador (si el documento tiene varios)
//   · 🗑️ eliminar el documento entero
//   · ✓ marcarlo como correcto (se recuerda en este navegador)
import { useMemo, useRef, useState } from 'react';
import { db } from '../firebase';
import {
    collection, query, orderBy, limit, startAfter, getDocs, getDoc, doc, updateDoc, deleteDoc,
    deleteField, documentId, FieldPath,
} from 'firebase/firestore';
import { nombreInapropiado } from '../utils/filtroNombres';

export const NOMBRE_SUSTITUTO = 'Pikatron';

const COLECCIONES = [
    { id: 'ranking', etiqueta: 'Ranking' },
    { id: 'informes_juegos', etiqueta: 'Informes al profe' },
    { id: 'live_games', etiqueta: 'Salas en vivo' },
    { id: 'ranking_ahorcado', etiqueta: 'Ranking Ahorcado' },
    { id: 'ranking_sopa', etiqueta: 'Ranking Sopa' },
    { id: 'ranking_wordle', etiqueta: 'Ranking Wordle' },
    { id: 'ranking_mathwordle', etiqueta: 'Ranking MathWordle' },
    { id: 'arkade_rankings', etiqueta: 'Arkade' },
    { id: 'quien_es_quien_resultados', etiqueta: '¿Quién es quién?' },
];

// Campos que guardan el nombre de un alumno
const CLAVE_NOMBRE = /^(nombre|jugador|nombrejugador|nombrealumno|alumno|playername|player|name|nombreguest|displayname|autor|usuario)$/i;
// Campos que no merece la pena recorrer (preguntas, configuración…)
const CLAVE_SALTAR = /^(preguntas|config|hojas|recurso|respuestas|respuestasRonda|bloques|escena|dibujo|imagen|texto)$/i;
// Campos de lista de jugadores: permiten «quitar solo a este jugador»
const CLAVE_LISTA = /^(jugadores|participantes|alumnos|equipos|players)$/i;

const PAGINA = 400;
const LS_OK = 'pikt_nombres_revisados_ok';

const leerOk = () => { try { return new Set(JSON.parse(localStorage.getItem(LS_OK) || '[]')); } catch { return new Set(); } };
const guardarOk = (set) => { try { localStorage.setItem(LS_OK, JSON.stringify([...set].slice(-3000))); } catch { /* sin almacenamiento */ } };

const normal = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const esPlano = (v) => v && typeof v === 'object' && (Array.isArray(v) || Object.getPrototypeOf(v) === Object.prototype);

// Todos los nombres del documento con su ruta: [{ ruta: ['jugadores', 2, 'nombre'], valor }]
function extraerNombres(data) {
    const out = [];
    const visitar = (v, ruta, prof) => {
        if (prof > 4 || !esPlano(v)) return;
        const entradas = Array.isArray(v) ? v.map((x, i) => [i, x]) : Object.entries(v);
        for (const [k, x] of entradas) {
            if (typeof k === 'string' && CLAVE_SALTAR.test(k)) continue;
            if (typeof x === 'string') {
                if (typeof k === 'string' && CLAVE_NOMBRE.test(k) && x.trim()) out.push({ ruta: [...ruta, k], valor: x });
            } else visitar(x, [...ruta, k], prof + 1);
        }
    };
    visitar(data, [], 0);
    return out;
}

// Copia el valor cambiando solo lo que hay en la ruta (el resto conserva sus referencias,
// así los Timestamp y demás tipos de Firestore no se estropean).
function conValor(obj, ruta, valor) {
    if (!ruta.length) return valor;
    const [k, ...resto] = ruta;
    if (Array.isArray(obj)) return obj.map((x, i) => (i === k ? conValor(x, resto, valor) : x));
    return { ...obj, [k]: conValor(obj?.[k], resto, valor) };
}
function sinElemento(obj, ruta) {
    const [k, ...resto] = ruta;
    if (!resto.length) return Array.isArray(obj) ? obj.filter((_, i) => i !== k) : (() => { const c = { ...obj }; delete c[k]; return c; })();
    if (Array.isArray(obj)) return obj.map((x, i) => (i === k ? sinElemento(x, resto) : x));
    return { ...obj, [k]: sinElemento(obj[k], resto) };
}

// Escribe un valor en una ruta del documento
async function escribirEnRuta(ref, data, ruta, valor) {
    const i = ruta.findIndex(p => typeof p === 'number');
    if (i === -1) return updateDoc(ref, new FieldPath(...ruta), valor);
    // Hay un array por medio: se reescribe desde el primer campo que lo contiene
    const base = ruta.slice(0, i);
    const resto = ruta.slice(i);
    const actual = base.reduce((o, k) => o?.[k], data);
    return updateDoc(ref, new FieldPath(...base), conValor(actual, resto, valor));
}

// Ruta del jugador (elemento de la lista) a partir de la ruta del nombre
function rutaJugador(ruta) {
    const i = ruta.findIndex(p => typeof p === 'string' && CLAVE_LISTA.test(p));
    if (i === -1 || ruta.length < i + 3) return null;   // lista → elemento → campo
    return ruta.slice(0, i + 2);
}

async function quitarJugador(ref, data, rJug) {
    const ultimo = rJug[rJug.length - 1];
    const tieneArray = rJug.some(p => typeof p === 'number');
    if (!tieneArray && typeof ultimo === 'string') return updateDoc(ref, new FieldPath(...rJug), deleteField());
    const i = rJug.findIndex(p => typeof p === 'number');
    const base = rJug.slice(0, i);
    const actual = base.reduce((o, k) => o?.[k], data);
    return updateDoc(ref, new FieldPath(...base), sinElemento(actual, rJug.slice(i)));
}

const fechaMs = (d) => {
    const f = d.fecha ?? d.createdAt ?? d.timestamp ?? d.ts ?? d.joinedAt;
    if (!f) return 0;
    if (f.toMillis) return f.toMillis();
    if (f.seconds) return f.seconds * 1000;
    return typeof f === 'number' ? f : new Date(f).getTime() || 0;
};
const textoFecha = (ms) => ms ? new Date(ms).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '';
const claveOk = (col, id, valor) => `${col}/${id}/${valor}`;

export default function RevisarNombresPanel({ onClose }) {
    const [elegidas, setElegidas] = useState(() => new Set(COLECCIONES.map(c => c.id)));
    const [modo, setModo] = useState('auto');          // auto | texto
    const [texto, setTexto] = useState('');
    const [revisando, setRevisando] = useState(false);
    const [progreso, setProgreso] = useState({});      // col → nº leídos
    const [hallazgos, setHallazgos] = useState(null);  // [{ col, id, data, nombres:[{ruta,valor}] }]
    const [ocupado, setOcupado] = useState(null);      // id en curso
    const [error, setError] = useState('');
    const [verOk, setVerOk] = useState(false);
    const [oks, setOks] = useState(leerOk);
    const pararRef = useRef(false);

    const coincide = (valor) => {
        if (modo === 'texto') { const t = normal(texto).trim(); return !!t && normal(valor).includes(t); }
        return valor !== NOMBRE_SUSTITUTO && nombreInapropiado(valor);
    };

    const analizar = (col, d) => {
        const data = d.data();
        const nombres = extraerNombres(data).filter(n => coincide(n.valor));
        return nombres.length ? { col, id: d.id, data, nombres } : null;
    };

    const revisar = async () => {
        if (modo === 'texto' && !texto.trim()) { setError('Escribe el texto que quieres buscar.'); return; }
        setError(''); setRevisando(true); setHallazgos([]); setProgreso({});
        pararRef.current = false;
        for (const col of COLECCIONES.filter(c => elegidas.has(c.id)).map(c => c.id)) {
            let ultimo = null;
            let leidos = 0;
            try {
                while (!pararRef.current) {
                    const q = ultimo
                        ? query(collection(db, col), orderBy(documentId()), startAfter(ultimo), limit(PAGINA))
                        : query(collection(db, col), orderBy(documentId()), limit(PAGINA));
                    const snap = await getDocs(q);
                    if (snap.empty) break;
                    const nuevos = snap.docs.map(d => analizar(col, d)).filter(Boolean);
                    if (nuevos.length) setHallazgos(h => [...h, ...nuevos]);
                    leidos += snap.size;
                    setProgreso(p => ({ ...p, [col]: leidos }));
                    ultimo = snap.docs[snap.docs.length - 1];
                    if (snap.size < PAGINA) break;
                }
            } catch (e) {
                setError(`${col}: ${e.message}`);
            }
            if (pararRef.current) break;
        }
        setRevisando(false);
    };

    // Vuelve a leer un documento tras modificarlo
    const refrescar = async (h) => {
        const snap = await getDoc(doc(db, h.col, h.id));
        setHallazgos(prev => prev.flatMap(x => {
            if (x.col !== h.col || x.id !== h.id) return [x];
            if (!snap.exists()) return [];
            const r = analizar(h.col, snap);
            return r ? [r] : [];
        }));
    };

    const accion = async (h, fn) => {
        setOcupado(`${h.col}/${h.id}`); setError('');
        try { await fn(); await refrescar(h); }
        catch (e) { setError(`No se pudo modificar ${h.col}/${h.id}: ${e.message}`); }
        setOcupado(null);
    };

    const sustituir = (h, nombres = h.nombres) => accion(h, async () => {
        // Se aplican de uno en uno releyendo, por si dos rutas comparten el mismo array
        let data = h.data;
        const ref = doc(db, h.col, h.id);
        for (const n of nombres) {
            await escribirEnRuta(ref, data, n.ruta, NOMBRE_SUSTITUTO);
            data = (await getDoc(ref)).data();
        }
    });

    const quitar = (h, n) => {
        const rJug = rutaJugador(n.ruta);
        if (!rJug) return;
        accion(h, () => quitarJugador(doc(db, h.col, h.id), h.data, rJug));
    };

    const eliminar = (h) => {
        const nJug = h.nombres.length;
        const otros = extraerNombres(h.data).length - nJug;
        const aviso = otros > 0
            ? `Este documento tiene ${otros} nombre(s) más que están bien.\n¿Eliminar el documento ENTERO de ${h.col}?`
            : `¿Eliminar este documento de ${h.col}?`;
        if (!window.confirm(aviso)) return;
        accion(h, () => deleteDoc(doc(db, h.col, h.id)));
    };

    const marcarOk = (h) => {
        const s = new Set(oks);
        h.nombres.forEach(n => s.add(claveOk(h.col, h.id, n.valor)));
        setOks(s); guardarOk(s);
    };

    const visibles = useMemo(() => (hallazgos || [])
        .map(h => ({ ...h, pendientes: h.nombres.filter(n => !oks.has(claveOk(h.col, h.id, n.valor))) }))
        .filter(h => verOk || h.pendientes.length)
        .sort((a, b) => fechaMs(b.data) - fechaMs(a.data)), [hallazgos, oks, verOk]);

    const sustituirTodos = async () => {
        const lista = visibles.filter(h => h.pendientes.length);
        if (!lista.length) return;
        if (!window.confirm(`¿Cambiar por «${NOMBRE_SUSTITUTO}» los nombres de ${lista.length} documento(s)?`)) return;
        for (const h of lista) await sustituir(h, h.pendientes);
    };

    const totalLeidos = Object.values(progreso).reduce((a, b) => a + b, 0);
    const chip = (activo) => ({ padding: '5px 11px', borderRadius: 20, border: `1.5px solid ${activo ? '#16a085' : '#cbd5e1'}`, background: activo ? '#e8f8f5' : 'white', color: activo ? '#0e6655' : '#475569', fontWeight: 700, fontSize: '0.76rem', cursor: 'pointer' });
    const btn = (bg, color = 'white') => ({ padding: '5px 10px', borderRadius: 8, border: 'none', background: bg, color, fontWeight: 700, fontSize: '0.75rem', cursor: 'pointer', whiteSpace: 'nowrap' });

    return (
        <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', zIndex: 10050, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
            <div onClick={e => e.stopPropagation()} style={{ background: '#f8fafc', borderRadius: 18, width: '100%', maxWidth: 980, maxHeight: '92vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 24px 70px rgba(0,0,0,0.35)' }}>
                <div style={{ background: 'linear-gradient(135deg,#16a085,#2c3e50)', color: 'white', padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 12 }}>
                    <h3 style={{ margin: 0, flex: 1, fontSize: '1.1rem' }}>🧹 Revisar nombres de alumnos</h3>
                    {(revisando || totalLeidos > 0) && <span style={{ fontSize: '0.8rem', opacity: 0.9 }}>{totalLeidos} documentos leídos</span>}
                    <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.22)', border: 'none', color: 'white', borderRadius: 9, padding: '6px 12px', cursor: 'pointer', fontWeight: 700 }}>✕</button>
                </div>

                {/* Opciones */}
                <div style={{ padding: '12px 20px', display: 'flex', flexDirection: 'column', gap: 10, borderBottom: '1px solid #e2e8f0', background: 'white' }}>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 700, marginRight: 4 }}>Dónde:</span>
                        {COLECCIONES.map(c => (
                            <button key={c.id} disabled={revisando} style={chip(elegidas.has(c.id))}
                                onClick={() => setElegidas(s => { const n = new Set(s); n.has(c.id) ? n.delete(c.id) : n.add(c.id); return n; })}>
                                {c.etiqueta}{progreso[c.id] != null && ` · ${progreso[c.id]}`}
                            </button>
                        ))}
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 700, marginRight: 4 }}>Qué:</span>
                        <button disabled={revisando} style={chip(modo === 'auto')} onClick={() => setModo('auto')}>🚫 Sospechosos (filtro automático)</button>
                        <button disabled={revisando} style={chip(modo === 'texto')} onClick={() => setModo('texto')}>🔎 Buscar un texto</button>
                        {modo === 'texto' && (
                            <input value={texto} onChange={e => setTexto(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !revisando) revisar(); }}
                                placeholder="Ej.: gordo, caca…" style={{ padding: '6px 10px', borderRadius: 8, border: '1.5px solid #cbd5e1', fontSize: '0.85rem', minWidth: 180 }} />
                        )}
                        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
                            {revisando
                                ? <button onClick={() => { pararRef.current = true; }} style={btn('#e67e22')}>⏹ Parar</button>
                                : <button onClick={revisar} disabled={!elegidas.size} style={btn('#16a085')}>▶ Revisar</button>}
                        </div>
                    </div>
                    <div style={{ fontSize: '0.74rem', color: '#94a3b8' }}>
                        Se leen todos los documentos de las colecciones elegidas (puede tardar y gasta lecturas de Firebase). Los nombres que marques como correctos se recuerdan en este navegador.
                    </div>
                </div>

                {error && <div style={{ background: '#fdecea', color: '#922b21', padding: '8px 20px', fontSize: '0.82rem' }}>⚠ {error}</div>}

                {hallazgos && (
                    <div style={{ padding: '8px 20px', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', background: '#f1f5f9', borderBottom: '1px solid #e2e8f0', fontSize: '0.82rem', color: '#334155' }}>
                        <b>{visibles.filter(h => h.pendientes.length).length}</b> documento(s) con nombres a revisar{revisando && ' (buscando…)'}
                        <label style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer', color: '#64748b' }}>
                            <input type="checkbox" checked={verOk} onChange={e => setVerOk(e.target.checked)} /> Ver también los marcados como correctos
                        </label>
                        {!revisando && visibles.some(h => h.pendientes.length) && (
                            <button onClick={sustituirTodos} disabled={!!ocupado} style={{ ...btn('#8e44ad'), marginLeft: 'auto' }}>🔁 Cambiar todos por «{NOMBRE_SUSTITUTO}»</button>
                        )}
                    </div>
                )}

                <div style={{ overflowY: 'auto', padding: '12px 20px 20px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {!hallazgos && (
                        <div style={{ textAlign: 'center', color: '#64748b', padding: 40 }}>
                            Elige dónde buscar y pulsa <b>▶ Revisar</b>.
                        </div>
                    )}
                    {hallazgos && !revisando && !visibles.length && (
                        <div style={{ textAlign: 'center', color: '#64748b', padding: 40 }}>✅ No hay nombres que revisar.</div>
                    )}
                    {visibles.map(h => {
                        const clave = `${h.col}/${h.id}`;
                        const enCurso = ocupado === clave;
                        const titulo = h.data.recursoTitulo || h.data.titulo || h.data.juego || h.data.tipoJuego || h.data.tipo || '';
                        const ms = fechaMs(h.data);
                        const etiqueta = COLECCIONES.find(c => c.id === h.col)?.etiqueta || h.col;
                        return (
                            <div key={clave} style={{ background: 'white', borderRadius: 12, border: '1px solid #e2e8f0', borderLeft: `5px solid ${h.pendientes.length ? '#e74c3c' : '#27ae60'}`, padding: '10px 14px', opacity: enCurso ? 0.55 : 1 }}>
                                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 6, fontSize: '0.76rem', color: '#64748b' }}>
                                    <span style={{ background: '#2c3e50', color: 'white', borderRadius: 6, padding: '2px 8px', fontWeight: 800 }}>{etiqueta}</span>
                                    {titulo && <span style={{ fontWeight: 700, color: '#334155' }}>{String(titulo).slice(0, 60)}</span>}
                                    {h.data.codigoProfesor && <span>· profe {h.data.codigoProfesor}</span>}
                                    {ms > 0 && <span>· {textoFecha(ms)}</span>}
                                    <span style={{ marginLeft: 'auto', fontFamily: 'monospace', fontSize: '0.68rem', color: '#94a3b8' }}>{h.id}</span>
                                </div>
                                {h.nombres.map((n, i) => {
                                    const ok = oks.has(claveOk(h.col, h.id, n.valor));
                                    const rJug = rutaJugador(n.ruta);
                                    return (
                                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', padding: '4px 0' }}>
                                            <span style={{ fontWeight: 800, color: ok ? '#27ae60' : '#c0392b', fontSize: '0.95rem', wordBreak: 'break-word' }}>«{n.valor}»</span>
                                            <span style={{ fontSize: '0.7rem', color: '#94a3b8', fontFamily: 'monospace' }}>{n.ruta.join('.')}</span>
                                            <div style={{ marginLeft: 'auto', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                                <button disabled={enCurso} onClick={() => sustituir(h, [n])} style={btn('#8e44ad')}>🔁 {NOMBRE_SUSTITUTO}</button>
                                                {rJug && <button disabled={enCurso} onClick={() => quitar(h, n)} style={btn('#e67e22')}>👤 Quitar jugador</button>}
                                            </div>
                                        </div>
                                    );
                                })}
                                <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', marginTop: 6, flexWrap: 'wrap' }}>
                                    {h.pendientes.length > 0 && <button disabled={enCurso} onClick={() => marcarOk(h)} style={btn('#ecf0f1', '#2c3e50')}>✓ Está bien</button>}
                                    <button disabled={enCurso} onClick={() => eliminar(h)} style={btn('#e74c3c')}>🗑️ Eliminar documento</button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
