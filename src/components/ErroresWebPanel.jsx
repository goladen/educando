// Panel del admin con los fallos que sufren los usuarios (colección
// errores_web, la rellena src/utils/reportarError.js). Agrupa los avisos por
// firma (servicio + mensaje normalizado) y permite marcarlos como resueltos
// (errores_resueltos/{firma}: si el fallo vuelve después, reaparece) o borrarlos.
import { useEffect, useMemo, useState } from 'react';
import { db } from '../firebase';
import {
    collection, query, orderBy, limit, onSnapshot, doc, setDoc, deleteDoc, getDoc, writeBatch,
} from 'firebase/firestore';
import { nombreUsuario } from './AdminUsuariosPanel';

const MAX_AVISOS = 1000;

const fechaMs = (f) => !f ? 0 : f.toMillis ? f.toMillis() : f.seconds ? f.seconds * 1000 : new Date(f).getTime() || 0;
const haceCuanto = (ms) => {
    const s = Math.round((Date.now() - ms) / 1000);
    if (s < 60) return 'ahora';
    if (s < 3600) return `hace ${Math.round(s / 60)} min`;
    if (s < 86400) return `hace ${Math.round(s / 3600)} h`;
    return `hace ${Math.round(s / 86400)} d`;
};
const fechaLarga = (ms) => new Date(ms).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

// "Chrome 153 · Windows" a partir del userAgent
function navegadorCorto(ua = '') {
    const nav = /Edg\/(\d+)/.exec(ua) ? `Edge ${/Edg\/(\d+)/.exec(ua)[1]}`
        : /OPR\/(\d+)/.exec(ua) ? `Opera ${/OPR\/(\d+)/.exec(ua)[1]}`
        : /Firefox\/(\d+)/.exec(ua) ? `Firefox ${/Firefox\/(\d+)/.exec(ua)[1]}`
        : /Chrome\/(\d+)/.exec(ua) ? `Chrome ${/Chrome\/(\d+)/.exec(ua)[1]}`
        : /Version\/(\d+).*Safari/.exec(ua) ? `Safari ${/Version\/(\d+).*Safari/.exec(ua)[1]}`
        : 'Otro';
    const so = /Android/.test(ua) ? 'Android' : /iPhone|iPad|iPod/.test(ua) ? 'iOS' : /Windows/.test(ua) ? 'Windows'
        : /CrOS/.test(ua) ? 'ChromeOS' : /Mac OS/.test(ua) ? 'macOS' : /Linux/.test(ua) ? 'Linux' : '';
    return so ? `${nav} · ${so}` : nav;
}

const COLORES = { js: '#c0392b', promesa: '#d35400', cloudinary: '#2980b9' };
const colorServicio = (s) => COLORES[s] || (s.startsWith('api/') ? '#8e44ad' : '#16a085');

export default function ErroresWebPanel({ onClose }) {
    const [avisos, setAvisos] = useState(null);
    const [resueltos, setResueltos] = useState({});
    const [filtro, setFiltro] = useState('todos');
    const [verResueltos, setVerResueltos] = useState(false);
    const [abierto, setAbierto] = useState(null);       // firma desplegada
    const [nombres, setNombres] = useState({});         // uid → nombre
    const [error, setError] = useState('');
    const [copiado, setCopiado] = useState(null);

    useEffect(() => {
        const q = query(collection(db, 'errores_web'), orderBy('fecha', 'desc'), limit(MAX_AVISOS));
        const off1 = onSnapshot(q, s => setAvisos(s.docs.map(d => ({ id: d.id, ...d.data(), ms: fechaMs(d.data().fecha) || Date.now() }))),
            e => setError('No se pudieron leer los errores: ' + e.message + ' (¿están publicadas las reglas de errores_web?)'));
        const off2 = onSnapshot(collection(db, 'errores_resueltos'), s => {
            const r = {};
            s.docs.forEach(d => { r[d.id] = d.data().fecha || 0; });
            setResueltos(r);
        }, () => {});
        return () => { off1(); off2(); };
    }, []);

    const grupos = useMemo(() => {
        const m = new Map();
        for (const a of avisos || []) {
            let g = m.get(a.firma);
            if (!g) { g = { firma: a.firma, servicio: a.servicio, mensaje: a.mensaje, avisos: [], uids: new Set(), anonimos: 0, primera: a.ms, ultima: a.ms }; m.set(a.firma, g); }
            g.avisos.push(a);
            if (a.uid) g.uids.add(a.uid); else g.anonimos++;
            g.primera = Math.min(g.primera, a.ms);
            g.ultima = Math.max(g.ultima, a.ms);
        }
        return [...m.values()]
            .map(g => ({ ...g, resuelto: resueltos[g.firma] && g.ultima <= resueltos[g.firma] }))
            .sort((a, b) => b.ultima - a.ultima);
    }, [avisos, resueltos]);

    const servicios = useMemo(() => {
        const c = {};
        grupos.filter(g => !g.resuelto).forEach(g => { c[g.servicio] = (c[g.servicio] || 0) + g.avisos.length; });
        return Object.entries(c).sort((a, b) => b[1] - a[1]);
    }, [grupos]);

    const visibles = grupos.filter(g => (verResueltos || !g.resuelto) && (filtro === 'todos' || g.servicio === filtro));
    const nResueltos = grupos.filter(g => g.resuelto).length;

    // Nombres de los usuarios afectados del grupo desplegado
    useEffect(() => {
        const g = grupos.find(x => x.firma === abierto);
        if (!g) return;
        const faltan = [...g.uids].filter(u => !(u in nombres)).slice(0, 20);
        if (!faltan.length) return;
        Promise.all(faltan.map(uid => getDoc(doc(db, 'users', uid))
            .then(s => [uid, s.exists() ? `${nombreUsuario(s.data())}${s.data().role === 'alumno' ? ' (alumno)' : ''}` : null])
            .catch(() => [uid, null])))
            .then(pares => setNombres(n => ({ ...n, ...Object.fromEntries(pares) })));
    }, [abierto, grupos]); // eslint-disable-line react-hooks/exhaustive-deps

    const marcarResuelto = async (g, si) => {
        try {
            if (si) await setDoc(doc(db, 'errores_resueltos', g.firma), { fecha: Date.now(), servicio: g.servicio, mensaje: g.mensaje.slice(0, 300) });
            else await deleteDoc(doc(db, 'errores_resueltos', g.firma));
        } catch (e) { setError(e.message); }
    };

    const borrar = async (g) => {
        if (!window.confirm(`¿Borrar los ${g.avisos.length} avisos de este error?`)) return;
        try {
            for (let i = 0; i < g.avisos.length; i += 400) {
                const b = writeBatch(db);
                g.avisos.slice(i, i + 400).forEach(a => b.delete(doc(db, 'errores_web', a.id)));
                await b.commit();
            }
            await deleteDoc(doc(db, 'errores_resueltos', g.firma)).catch(() => {});
        } catch (e) { setError(e.message); }
    };

    // Resumen en texto para pegárselo a Claude (o a quien vaya a arreglarlo)
    const copiar = async (g) => {
        const ej = g.avisos.slice(0, 3).map((a, i) => [
            `--- Ejemplo ${i + 1} (${fechaLarga(a.ms)})`,
            `Ruta: ${a.ruta}`, `Navegador: ${a.navegador}`,
            Object.keys(a.contexto || {}).length ? `Contexto: ${JSON.stringify(a.contexto)}` : '',
            a.mensaje !== g.mensaje ? `Mensaje: ${a.mensaje}` : '',
            a.stack ? `Stack:\n${a.stack}` : '',
        ].filter(Boolean).join('\n')).join('\n');
        const txt = `Error en pikt.es — servicio «${g.servicio}»\nMensaje: ${g.mensaje}\n`
            + `${g.avisos.length} avisos · ${g.uids.size} usuarios con sesión + ${g.anonimos} sin sesión · desde ${fechaLarga(g.primera)} hasta ${fechaLarga(g.ultima)}\n\n${ej}`;
        try { await navigator.clipboard.writeText(txt); setCopiado(g.firma); setTimeout(() => setCopiado(null), 1800); }
        catch { window.prompt('Copia el resumen:', txt); }
    };

    const chip = (activo, color = '#34495e') => ({
        border: `1.5px solid ${color}`, background: activo ? color : 'white', color: activo ? 'white' : color,
        borderRadius: 999, padding: '4px 11px', fontSize: '0.76rem', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap',
    });
    const boton = { border: '1.5px solid #d9e2ec', background: 'white', borderRadius: 8, padding: '5px 10px', fontSize: '0.76rem', fontWeight: 700, cursor: 'pointer' };

    return (
        <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', zIndex: 10050, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
            <div onClick={e => e.stopPropagation()} style={{ background: '#f8fafc', borderRadius: 18, width: '100%', maxWidth: 980, maxHeight: '92vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 24px 70px rgba(0,0,0,0.35)' }}>
                <div style={{ background: 'linear-gradient(135deg,#c0392b,#8e44ad)', color: 'white', padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 12 }}>
                    <h3 style={{ margin: 0, flex: 1, fontSize: '1.1rem' }}>🐞 Fallos de los usuarios</h3>
                    <span style={{ fontSize: '0.8rem', opacity: 0.9 }}>{avisos ? `${avisos.length}${avisos.length >= MAX_AVISOS ? '+' : ''} avisos` : 'Cargando…'}</span>
                    <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.22)', border: 'none', color: 'white', borderRadius: 9, padding: '6px 12px', cursor: 'pointer', fontWeight: 700 }}>✕</button>
                </div>

                <div style={{ padding: '10px 20px', display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', borderBottom: '1px solid #e2e8f0', background: 'white' }}>
                    <button onClick={() => setFiltro('todos')} style={chip(filtro === 'todos')}>Todos</button>
                    {servicios.map(([s, n]) => (
                        <button key={s} onClick={() => setFiltro(s)} style={chip(filtro === s, colorServicio(s))}>{s} · {n}</button>
                    ))}
                    <label style={{ marginLeft: 'auto', fontSize: '0.78rem', color: '#475569', display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer' }}>
                        <input type="checkbox" checked={verResueltos} onChange={e => setVerResueltos(e.target.checked)} />
                        Ver resueltos ({nResueltos})
                    </label>
                </div>

                {error && <div style={{ background: '#fdecea', color: '#922b21', padding: '8px 20px', fontSize: '0.82rem' }}>{error}</div>}

                <div style={{ overflowY: 'auto', padding: '12px 20px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {avisos && !visibles.length && (
                        <div style={{ textAlign: 'center', color: '#64748b', padding: 40 }}>
                            {grupos.length ? '✅ Nada pendiente con este filtro.' : '✅ Ningún fallo registrado todavía.'}
                        </div>
                    )}
                    {visibles.map(g => {
                        const abiertoG = abierto === g.firma;
                        const color = colorServicio(g.servicio);
                        const navs = [...new Set(g.avisos.map(a => navegadorCorto(a.navegador)))];
                        const rutas = [...new Set(g.avisos.map(a => a.ruta.split('?')[0]))];
                        return (
                            <div key={g.firma} style={{ background: 'white', borderRadius: 12, border: `1px solid ${g.resuelto ? '#d5f5e3' : '#e2e8f0'}`, borderLeft: `5px solid ${g.resuelto ? '#27ae60' : color}`, opacity: g.resuelto ? 0.7 : 1 }}>
                                <div onClick={() => setAbierto(abiertoG ? null : g.firma)} style={{ padding: '10px 14px', cursor: 'pointer' }}>
                                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 4 }}>
                                        <span style={{ background: color, color: 'white', borderRadius: 6, padding: '2px 8px', fontSize: '0.72rem', fontWeight: 800 }}>{g.servicio}</span>
                                        {g.resuelto && <span style={{ color: '#27ae60', fontSize: '0.74rem', fontWeight: 800 }}>✔ resuelto</span>}
                                        <span style={{ fontSize: '0.76rem', color: '#475569' }}>
                                            <b>{g.avisos.length}</b> {g.avisos.length === 1 ? 'vez' : 'veces'} · <b>{g.uids.size}</b> con sesión{g.anonimos ? ` + ${g.anonimos} sin sesión` : ''}
                                        </span>
                                        <span style={{ marginLeft: 'auto', fontSize: '0.74rem', color: '#64748b' }} title={`Primera vez: ${fechaLarga(g.primera)}`}>{haceCuanto(g.ultima)}</span>
                                    </div>
                                    <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: '0.82rem', color: '#1e293b', wordBreak: 'break-word', whiteSpace: abiertoG ? 'pre-wrap' : 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{g.mensaje}</div>
                                    {!abiertoG && <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{rutas.slice(0, 3).join(' · ')} — {navs.slice(0, 3).join(' · ')}</div>}
                                </div>

                                {abiertoG && (
                                    <div style={{ borderTop: '1px solid #eef2f7', padding: '10px 14px 12px', fontSize: '0.78rem', color: '#334155' }}>
                                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
                                            <button onClick={() => marcarResuelto(g, !g.resuelto)} style={{ ...boton, borderColor: '#27ae60', color: '#27ae60' }}>{g.resuelto ? '↺ Reabrir' : '✅ Marcar resuelto'}</button>
                                            <button onClick={() => copiar(g)} style={boton}>{copiado === g.firma ? '✔ Copiado' : '📋 Copiar resumen'}</button>
                                            <button onClick={() => borrar(g)} style={{ ...boton, borderColor: '#e74c3c', color: '#e74c3c' }}>🗑️ Borrar avisos</button>
                                        </div>
                                        <div style={{ marginBottom: 6 }}><b>Primera vez:</b> {fechaLarga(g.primera)} · <b>Última:</b> {fechaLarga(g.ultima)}</div>
                                        <div style={{ marginBottom: 6 }}><b>Navegadores:</b> {navs.join(' · ')}</div>
                                        <div style={{ marginBottom: 6 }}><b>Páginas:</b> {rutas.slice(0, 8).join(' · ')}</div>
                                        {g.uids.size > 0 && (
                                            <div style={{ marginBottom: 8 }}><b>Usuarios:</b> {[...g.uids].slice(0, 20).map(u => nombres[u] || `${u.slice(0, 6)}…`).join(' · ')}{g.uids.size > 20 ? ' …' : ''}</div>
                                        )}
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                            {g.avisos.slice(0, 5).map(a => (
                                                <details key={a.id} style={{ background: '#f8fafc', borderRadius: 8, padding: '6px 10px' }}>
                                                    <summary style={{ cursor: 'pointer' }}>{fechaLarga(a.ms)} · {a.ruta} · {navegadorCorto(a.navegador)}</summary>
                                                    {a.mensaje !== g.mensaje && <div style={{ marginTop: 6, fontFamily: 'ui-monospace, monospace', whiteSpace: 'pre-wrap' }}>{a.mensaje}</div>}
                                                    {Object.keys(a.contexto || {}).length > 0 && <div style={{ marginTop: 6 }}><b>Contexto:</b> <code>{JSON.stringify(a.contexto)}</code></div>}
                                                    {a.stack && <pre style={{ marginTop: 6, fontSize: '0.7rem', whiteSpace: 'pre-wrap', wordBreak: 'break-all', color: '#64748b' }}>{a.stack}</pre>}
                                                </details>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
