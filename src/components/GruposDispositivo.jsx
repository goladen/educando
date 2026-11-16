// Gestor de «Mis grupos en este dispositivo»: elegir el grupo de clase con el que se trabaja todo el curso
// (desde las comunidades, «Mis grupos» o a mano), guardarlo en el dispositivo, cambiar el que está en uso,
// añadir/quitar alumnos, borrarlo y pasar los nombres a los mandos micro:bit.
// Datos: utils/gruposDispositivo.js (solo localStorage; de Firestore solo se LEE).
import React, { useState, useEffect, useMemo } from 'react';
import { onAuthStateChanged, signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { collection, query, where, getDocs, getDoc, doc } from 'firebase/firestore';
import { db, auth } from '../firebase';
import {
    useGruposDispositivo, guardarGrupoDispositivo, borrarGrupoDispositivo, setGrupoActivo,
    añadirMiembro, quitarMiembro, nombresAMandos,
} from '../utils/gruposDispositivo';

const TINTA = '#1f2937';
const FUENTE = "'Nunito', 'Segoe UI', system-ui, sans-serif";
const btn = (bg, color = 'white', extra = {}) => ({ background: bg, color, border: 'none', borderRadius: 10, padding: '8px 13px', fontWeight: 700, cursor: 'pointer', fontSize: '0.86rem', fontFamily: 'inherit', ...extra });
const chip = (activo, color) => ({ padding: '6px 12px', borderRadius: 999, border: `2px solid ${color}`, cursor: 'pointer', fontWeight: 700, fontSize: '0.82rem', background: activo ? color : 'white', color: activo ? 'white' : color, fontFamily: 'inherit' });
const inp = { padding: '8px 11px', borderRadius: 10, border: '1.5px solid #d1d5db', fontFamily: 'inherit', fontSize: '0.92rem', boxSizing: 'border-box' };
const titulo = { fontWeight: 800, fontSize: '0.85rem', color: '#475569', margin: '14px 0 6px' };
const ordenarNombres = (arr) => [...arr].sort((a, b) => a.localeCompare(b, 'es'));

// ─────────────────────────── Fuentes en la nube (solo lectura) ───────────────────────────
function useFuentesNube(uid) {
    const [misGrupos, setMisGrupos] = useState(null);
    const [comunidades, setComunidades] = useState(null);
    const [error, setError] = useState('');
    useEffect(() => {
        if (!uid) { setMisGrupos(null); setComunidades(null); return undefined; }
        let vivo = true;
        getDocs(query(collection(db, 'grupos_profesor'), where('profesorUid', '==', uid)))
            .then(s => vivo && setMisGrupos(s.docs.map(d => ({ id: d.id, ...d.data() })).filter(g => (g.alumnos || []).length).sort((a, b) => String(a.nombre).localeCompare(String(b.nombre), 'es'))))
            .catch(e => { if (vivo) { setMisGrupos([]); setError(e.message); } });
        getDocs(query(collection(db, 'comunidades'), where('miembros', 'array-contains', uid)))
            .then(async s => {
                const coms = await Promise.all(s.docs.map(async d => {
                    let cursos = []; let centro = [];
                    try {
                        const cs = await getDocs(collection(db, 'comunidades', d.id, 'cursos'));
                        cursos = cs.docs.map(c => ({ id: c.id, ...c.data() })).sort((a, b) => (a.orden ?? 999) - (b.orden ?? 999) || String(a.nombre).localeCompare(String(b.nombre), 'es'));
                    } catch { /* sin permiso */ }
                    try {
                        const gc = await getDocs(collection(db, 'comunidades', d.id, 'grupos_centro'));
                        centro = gc.docs.map(x => ({ id: x.id, ...x.data() })).filter(x => (x.grupos || []).length);
                    } catch { /* reglas sin publicar */ }
                    return { id: d.id, nombre: d.data().nombre || 'Comunidad', cursos, centro };
                }));
                if (vivo) setComunidades(coms.filter(c => c.cursos.length || c.centro.length));
            })
            .catch(e => { if (vivo) { setComunidades([]); setError(e.message); } });
        return () => { vivo = false; };
    }, [uid]);
    return { misGrupos, comunidades, error };
}

// ─────────────────────────── Gestor (modal) ───────────────────────────
export default function GestorGruposDispositivo({ onClose, onUsar }) {
    const { grupos, activo } = useGruposDispositivo();
    const [user, setUser] = useState(() => auth.currentUser);
    useEffect(() => onAuthStateChanged(auth, u => setUser(u)), []);
    const nube = useFuentesNube(user?.uid);
    const [abierto, setAbierto] = useState(() => activo?.id || null);
    const [nuevoMiembro, setNuevoMiembro] = useState('');
    const [pestaña, setPestaña] = useState('comunidad'); // comunidad | mano
    const [vista, setVista] = useState(null); // { nombre, curso, origen, alumnos:[{nombre, sub}] }
    const [sub, setSub] = useState('');
    const [nombreNuevo, setNombreNuevo] = useState('');
    const [texto, setTexto] = useState('');
    const [cargando, setCargando] = useState('');
    const [aviso, setAviso] = useState('');

    const avisar = (t) => { setAviso(t); setTimeout(() => setAviso(''), 2600); };

    const verCurso = async (com, curso) => {
        setCargando(curso.id);
        try {
            const s = await getDoc(doc(db, 'comunidades', com.id, 'cursos', curso.id, 'privado', 'data'));
            const listado = ((s.exists() && s.data().listado) || []).filter(a => a?.nombre);
            setVista({ nombre: curso.nombre, curso: curso.nombre, comunidad: com.nombre, origen: { tipo: 'comunidad', comId: com.id, cursoId: curso.id }, alumnos: listado.map(a => ({ nombre: String(a.nombre).trim(), sub: String(a.grupo || '').trim() })) });
            setSub(''); setNombreNuevo(curso.nombre);
        } catch (e) { avisar('⚠ No se pudo leer el listado: ' + e.message); }
        setCargando('');
    };
    const verCentro = (com, gc, i) => {
        const g = gc.grupos[i];
        const nom = `${gc.nombre || 'Grupos del centro'} · ${g.nombre || `Grupo ${i + 1}`}`;
        setVista({ nombre: nom, comunidad: com.nombre, origen: { tipo: 'centro', comId: com.id, docId: gc.id, indice: i }, alumnos: (g.alumnos || []).filter(a => a?.nombre).map(a => ({ nombre: String(a.nombre).trim(), sub: a.cursoNombre || '' })) });
        setSub(''); setNombreNuevo(nom);
    };
    const verMiGrupo = (g) => {
        setVista({ nombre: g.nombre, curso: g.nombre, origen: { tipo: 'grupo', grupoId: g.id }, alumnos: (g.alumnos || []).filter(a => a?.nombre).map(a => ({ nombre: String(a.nombre).trim(), sub: String(a.grupo || '').trim() })) });
        setSub(''); setNombreNuevo(g.nombre);
    };

    const subgrupos = useMemo(() => [...new Set((vista?.alumnos || []).map(a => a.sub).filter(Boolean))].sort(), [vista]);
    const alumnosVista = (vista?.alumnos || []).filter(a => !sub || a.sub === sub).map(a => a.nombre);

    const guardarVista = () => {
        if (!alumnosVista.length) return;
        const g = guardarGrupoDispositivo({ nombre: nombreNuevo || vista.nombre, curso: vista.curso || nombreNuevo, origen: { ...vista.origen, sub: sub || undefined }, alumnos: alumnosVista }, { activar: true });
        setVista(null); setAbierto(g.id);
        avisar(`✔ «${g.nombre}» guardado en este dispositivo y en uso.`);
    };
    const guardarAMano = () => {
        const alumnos = texto.split(/\n|,|;/).map(s => s.trim()).filter(Boolean);
        if (!alumnos.length) return;
        const g = guardarGrupoDispositivo({ nombre: nombreNuevo, curso: nombreNuevo, origen: { tipo: 'manual' }, alumnos }, { activar: true });
        setTexto(''); setNombreNuevo(''); setAbierto(g.id);
        avisar(`✔ «${g.nombre}» guardado en este dispositivo y en uso.`);
    };
    const yaGuardado = (origen) => grupos.some(g => g.origen && origen && JSON.stringify({ ...g.origen, sub: undefined }) === JSON.stringify({ ...origen, sub: undefined }));

    return (
        <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 2147482000, background: 'rgba(15,23,42,0.55)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', overflowY: 'auto', padding: '24px 12px', fontFamily: FUENTE }}>
            <div onClick={e => e.stopPropagation()} style={{ background: 'white', borderRadius: 20, width: 'min(760px, 100%)', padding: 18, position: 'relative', boxSizing: 'border-box', color: TINTA }}>
                <button onClick={onClose} style={{ position: 'absolute', top: 10, right: 12, background: 'none', border: 'none', fontSize: '1.4rem', cursor: 'pointer', color: '#6b7280' }}>✕</button>
                <div style={{ fontWeight: 900, fontSize: '1.3rem' }}>👥 Mis grupos en este dispositivo</div>
                <div style={{ fontSize: '0.86rem', color: '#6b7280', marginTop: 2 }}>
                    Guarda aquí el grupo con el que trabajas en esta clase. Sus nombres aparecerán en la ruleta, el creador de grupos, los sorteos de los juegos, al enviar resultados al profe y en los mandos micro:bit. Solo se guarda en este navegador.
                </div>
                {aviso && <div style={{ marginTop: 10, background: '#ecfdf5', color: '#065f46', borderRadius: 10, padding: '8px 12px', fontWeight: 700, fontSize: '0.88rem' }}>{aviso}</div>}

                {/* ── Grupos guardados ── */}
                <div style={titulo}>📱 Guardados en este dispositivo</div>
                {grupos.length === 0 && <div style={{ fontSize: '0.86rem', color: '#9ca3af' }}>Todavía no hay ninguno. Añade uno abajo.</div>}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {grupos.map(g => {
                        const enUso = activo?.id === g.id;
                        const abiertoG = abierto === g.id;
                        return (
                            <div key={g.id} style={{ border: `2px solid ${enUso ? '#0d9488' : '#e5e7eb'}`, borderRadius: 14, padding: '10px 12px', background: enUso ? '#f0fdfa' : 'white' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                    <button onClick={() => setGrupoActivo(enUso ? '' : g.id)} title={enUso ? 'Dejar de usar' : 'Usar este grupo'} style={{ ...chip(enUso, '#0d9488'), padding: '4px 10px' }}>{enUso ? '✔ En uso' : 'Usar'}</button>
                                    <div style={{ flex: 1, minWidth: 140 }}>
                                        <div style={{ fontWeight: 800 }}>{g.nombre}</div>
                                        <div style={{ fontSize: '0.76rem', color: '#6b7280' }}>{g.alumnos.length} alumnos{g.origen?.tipo === 'comunidad' ? ' · de la comunidad' : g.origen?.tipo === 'centro' ? ' · grupos del centro' : g.origen?.tipo === 'grupo' ? ' · Mis grupos' : ''}</div>
                                    </div>
                                    {onUsar && <button onClick={() => { setGrupoActivo(g.id); onUsar(g); onClose?.(); }} style={btn('#2563eb')}>Cargar aquí</button>}
                                    <button onClick={() => setAbierto(abiertoG ? null : g.id)} style={btn('#f1f5f9', TINTA)}>{abiertoG ? '▴ Cerrar' : '✏️ Alumnos'}</button>
                                    <button onClick={() => { if (window.confirm(`¿Quitar «${g.nombre}» de este dispositivo? (No se borra de la comunidad)`)) borrarGrupoDispositivo(g.id); }} title="Eliminar del dispositivo" style={btn('#fef2f2', '#b91c1c')}>🗑</button>
                                </div>
                                {abiertoG && (
                                    <div style={{ marginTop: 10 }}>
                                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                            {g.alumnos.map(n => (
                                                <span key={n} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#f8fafc', border: '1px solid #e5e7eb', borderRadius: 8, padding: '4px 4px 4px 9px', fontSize: '0.86rem' }}>
                                                    {n}
                                                    <button onClick={() => quitarMiembro(g.id, n)} title="Quitar" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: '0.8rem' }}>✕</button>
                                                </span>
                                            ))}
                                        </div>
                                        <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                                            <input value={nuevoMiembro} onChange={e => setNuevoMiembro(e.target.value)} data-nombres-grupo="no"
                                                onKeyDown={e => { if (e.key === 'Enter' && nuevoMiembro.trim()) { añadirMiembro(g.id, nuevoMiembro); setNuevoMiembro(''); } }}
                                                placeholder="Añadir alumno/a…" style={{ ...inp, flex: '1 1 180px' }} />
                                            <button onClick={() => { if (nuevoMiembro.trim()) { añadirMiembro(g.id, nuevoMiembro); setNuevoMiembro(''); } }} style={btn('#0d9488')}>➕ Añadir</button>
                                            <button onClick={() => guardarGrupoDispositivo({ ...g, alumnos: ordenarNombres(g.alumnos) })} style={btn('#f1f5f9', TINTA)}>🔤 Ordenar</button>
                                            <button onClick={() => {
                                                if (!window.confirm(`Los mandos micro:bit se llamarán así: mando 1 = ${g.alumnos[0] || '—'}, mando 2 = ${g.alumnos[1] || '—'}… ¿Seguimos?`)) return;
                                                nombresAMandos(g.alumnos); avisar('🎮 Nombres puestos a los mandos (mando 1 = primer alumno de la lista).');
                                            }} style={btn('#f5f3ff', '#6d28d9')}>🎮 Nombres a los mandos</button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>

                {/* ── Añadir ── */}
                <div style={titulo}>➕ Añadir un grupo</div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                    <button onClick={() => setPestaña('comunidad')} style={chip(pestaña === 'comunidad', '#b45309')}>🏫 De mis comunidades</button>
                    <button onClick={() => { setPestaña('mano'); setVista(null); }} style={chip(pestaña === 'mano', '#2563eb')}>✍️ Escribir la lista</button>
                </div>

                {pestaña === 'mano' && (
                    <div>
                        <input value={nombreNuevo} onChange={e => setNombreNuevo(e.target.value)} data-nombres-grupo="no" placeholder="Nombre del grupo (ej.: 2º ESO B)" style={{ ...inp, width: '100%', marginBottom: 6 }} />
                        <textarea value={texto} onChange={e => setTexto(e.target.value)} rows={6} placeholder={'Un alumno por línea (o separados por comas)\nAna\nBruno…'} style={{ ...inp, width: '100%' }} />
                        <button onClick={guardarAMano} disabled={!texto.trim()} style={btn(texto.trim() ? '#0d9488' : '#9ca3af', 'white', { marginTop: 6 })}>💾 Guardar en este dispositivo</button>
                    </div>
                )}

                {pestaña === 'comunidad' && !user?.uid && (
                    <div style={{ background: '#f8fafc', borderRadius: 12, padding: 12, fontSize: '0.88rem' }}>
                        🔒 Inicia sesión para ver los cursos de tus comunidades y tus grupos.
                        <div><button onClick={() => signInWithPopup(auth, new GoogleAuthProvider()).catch(() => {})} style={btn('#2563eb', 'white', { marginTop: 8 })}>Iniciar sesión con Google</button></div>
                    </div>
                )}

                {pestaña === 'comunidad' && user?.uid && !vista && (
                    <div>
                        {nube.comunidades === null ? <div style={{ fontSize: '0.86rem', color: '#9ca3af' }}>Cargando comunidades…</div>
                            : nube.comunidades.length === 0 ? <div style={{ fontSize: '0.86rem', color: '#9ca3af' }}>No perteneces a ninguna comunidad con cursos.</div>
                                : nube.comunidades.map(com => (
                                    <div key={com.id} style={{ marginBottom: 10 }}>
                                        <div style={{ fontSize: '0.82rem', fontWeight: 800, color: '#b45309', marginBottom: 4 }}>🏫 {com.nombre}</div>
                                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                            {com.cursos.map(c => (
                                                <button key={c.id} onClick={() => verCurso(com, c)} disabled={cargando === c.id} style={chip(false, '#b45309')}>
                                                    {cargando === c.id ? '…' : c.nombre}{yaGuardado({ tipo: 'comunidad', comId: com.id, cursoId: c.id }) ? ' 📱' : ''}
                                                </button>
                                            ))}
                                        </div>
                                        {com.centro.map(gc => (
                                            <div key={gc.id} style={{ marginTop: 6 }}>
                                                <div style={{ fontSize: '0.76rem', color: '#92400e', fontWeight: 700 }}>Grupos del centro · {gc.nombre || 'Sin nombre'}</div>
                                                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 3 }}>
                                                    {gc.grupos.map((g, i) => <button key={i} onClick={() => verCentro(com, gc, i)} style={chip(false, '#d97706')}>{g.nombre || `Grupo ${i + 1}`} · {(g.alumnos || []).length}</button>)}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ))}
                        {nube.misGrupos && nube.misGrupos.length > 0 && (
                            <>
                                <div style={{ fontSize: '0.82rem', fontWeight: 800, color: '#7c3aed', margin: '8px 0 4px' }}>👩‍🏫 Mis grupos (panel del profesor)</div>
                                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                    {nube.misGrupos.map(g => <button key={g.id} onClick={() => verMiGrupo(g)} style={chip(false, '#7c3aed')}>{g.nombre} · {g.alumnos.length}</button>)}
                                </div>
                            </>
                        )}
                        {nube.error && <div style={{ color: '#dc2626', fontSize: '0.8rem', marginTop: 6 }}>⚠ {nube.error}</div>}
                    </div>
                )}

                {pestaña === 'comunidad' && vista && (
                    <div style={{ border: '2px solid #fcd34d', borderRadius: 14, padding: 12, background: '#fffbeb' }}>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                            <button onClick={() => setVista(null)} style={btn('white', TINTA)}>← Volver</button>
                            <div style={{ fontWeight: 800, flex: 1 }}>{vista.nombre}{vista.comunidad ? <span style={{ fontWeight: 600, color: '#92400e' }}> · {vista.comunidad}</span> : null}</div>
                        </div>
                        {subgrupos.length > 1 && (
                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                                <button onClick={() => { setSub(''); setNombreNuevo(vista.nombre); }} style={chip(!sub, '#334155')}>Todos</button>
                                {subgrupos.map(s => <button key={s} onClick={() => { setSub(s); setNombreNuevo(`${vista.nombre} ${s}`); }} style={chip(sub === s, '#334155')}>{s}</button>)}
                            </div>
                        )}
                        <div style={{ fontSize: '0.84rem', color: '#4b5563', margin: '8px 0' }}>{alumnosVista.length} alumnos: {alumnosVista.join(', ') || '—'}</div>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            <input value={nombreNuevo} onChange={e => setNombreNuevo(e.target.value)} data-nombres-grupo="no" placeholder="Nombre en este dispositivo" style={{ ...inp, flex: '1 1 200px' }} />
                            <button onClick={guardarVista} disabled={!alumnosVista.length} style={btn(alumnosVista.length ? '#0d9488' : '#9ca3af')}>💾 Guardar en este dispositivo y usarlo</button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

// ─────────────────────────── Botón para herramientas ───────────────────────────
// Muestra el grupo en uso y permite cargarlo con un clic (onUsar(grupo)) o abrir el gestor.
export function BotonGrupoDispositivo({ onUsar, style, compacto = false }) {
    const { activo } = useGruposDispositivo();
    const [ver, setVer] = useState(false);
    return (
        <span style={{ display: 'inline-flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', ...style }}>
            {activo && onUsar && (
                <button onClick={() => onUsar(activo)} style={btn('#0d9488')} title="Cargar los nombres del grupo en uso">
                    👥 Usar «{activo.nombre}» ({activo.alumnos.length})
                </button>
            )}
            <button onClick={() => setVer(true)} style={btn(activo && onUsar ? '#f0fdfa' : '#0d9488', activo && onUsar ? '#0f766e' : 'white')}>
                {activo && onUsar ? (compacto ? '⚙️' : '⚙️ Mis grupos') : activo ? `👥 ${activo.nombre} · Mis grupos` : '👥 Mis grupos del dispositivo'}
            </button>
            {ver && <GestorGruposDispositivo onClose={() => setVer(false)} onUsar={onUsar} />}
        </span>
    );
}
