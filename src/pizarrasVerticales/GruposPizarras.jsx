// Formar grupos aleatorios para las pizarras verticales.
// Fuentes de alumnos:
//  · Listas guardadas en este dispositivo (las que se crean aquí se guardan solas al formar grupos).
//  · Con sesión: «Mis grupos» (grupos_profesor) y los cursos de las comunidades de las que es miembro
//    (comunidades/{id}/cursos/{cursoId}/privado/data → listado). Solo lectura: no se escribe en Firestore.
import React, { useState, useEffect, useMemo } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, query, where, getDocs, getDoc, doc } from 'firebase/firestore';
import { db, auth } from '../firebase';

const LS_LISTAS = 'pv_listas_v1';
const LS_ANTIGUO = 'pv_alumnos_v1';   // versión anterior: un único textarea
const LS_ULTIMA = 'pv_lista_sel_v1';

const leerLS = (k, def) => { try { const v = JSON.parse(localStorage.getItem(k)); return v ?? def; } catch { return def; } };
const guardarLS = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* sin almacenamiento */ } };
const nuevoId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const aLineas = t => String(t || '').split('\n').map(s => s.trim()).filter(Boolean);

function leerListas() {
    const listas = leerLS(LS_LISTAS, null);
    if (Array.isArray(listas)) return listas;
    const antiguo = aLineas(leerLS(LS_ANTIGUO, ''));
    const migradas = antiguo.length ? [{ id: nuevoId(), nombre: 'Mi lista', alumnos: antiguo, fecha: new Date().toISOString() }] : [];
    guardarLS(LS_LISTAS, migradas);
    return migradas;
}

// Grupos de 3; si sobran 1 o 2 alumnos se reparten creando grupos de 4 (con 5 alumnos: 3 + 2).
export function formarGrupos(nombres) {
    const a = [...nombres];
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    const n = a.length;
    if (n <= 4) return n ? [a] : [];
    const resto = n % 3;
    const nGrupos = Math.floor(n / 3);
    const grupos = Array.from({ length: nGrupos }, (_, i) => a.slice(i * 3, i * 3 + 3));
    const sobran = a.slice(nGrupos * 3);
    if (resto === 2 && nGrupos < 2) grupos.push(sobran);
    else sobran.forEach((x, r) => grupos[r % nGrupos].push(x));
    return grupos;
}

const TINTA = '#1f2937';
const btn = (bg, color = 'white', extra = {}) => ({
    background: bg, color, border: 'none', borderRadius: 10, padding: '9px 14px', fontWeight: 700,
    cursor: 'pointer', fontSize: '0.88rem', fontFamily: 'inherit', ...extra,
});
const chip = (activo, color) => ({
    padding: '6px 12px', borderRadius: 999, border: `2px solid ${color}`, cursor: 'pointer', fontWeight: 700,
    fontSize: '0.82rem', background: activo ? color : 'white', color: activo ? 'white' : color, fontFamily: 'inherit',
});
const tituloFuente = { fontWeight: 800, fontSize: '0.85rem', color: '#475569', margin: '12px 0 6px' };

export default function GruposPizarras({ grupos, setGrupos }) {
    // ── Usuario (funciona igual dentro de la app y en la ruta pública) ──
    const [user, setUser] = useState(() => auth.currentUser);
    useEffect(() => onAuthStateChanged(auth, u => setUser(u)), []);

    // ── Listas del dispositivo ──
    const [listas, setListas] = useState(leerListas);
    const guardarListas = l => { setListas(l); guardarLS(LS_LISTAS, l); };

    // ── Fuentes en la nube ──
    const [misGrupos, setMisGrupos] = useState(null);       // null = cargando / sin sesión
    const [comunidades, setComunidades] = useState(null);   // [{ id, nombre, cursos:[{id,nombre}] }]
    const [errorNube, setErrorNube] = useState('');
    const [cargandoCurso, setCargandoCurso] = useState('');

    useEffect(() => {
        if (!user?.uid) { setMisGrupos(null); setComunidades(null); return undefined; }
        let vivo = true;
        setErrorNube('');
        getDocs(query(collection(db, 'grupos_profesor'), where('profesorUid', '==', user.uid)))
            .then(s => {
                if (!vivo) return;
                const gs = s.docs.map(d => ({ id: d.id, ...d.data() }))
                    .filter(g => (g.alumnos || []).length)
                    .sort((a, b) => String(a.nombre).localeCompare(String(b.nombre), 'es'));
                setMisGrupos(gs);
            })
            .catch(e => { if (vivo) { setMisGrupos([]); setErrorNube(e.message); } });
        getDocs(query(collection(db, 'comunidades'), where('miembros', 'array-contains', user.uid)))
            .then(async s => {
                const coms = await Promise.all(s.docs.map(async d => {
                    let cursos = [];
                    try {
                        const cs = await getDocs(collection(db, 'comunidades', d.id, 'cursos'));
                        cursos = cs.docs.map(c => ({ id: c.id, ...c.data() }))
                            .sort((a, b) => (a.orden ?? 999) - (b.orden ?? 999) || String(a.nombre).localeCompare(String(b.nombre), 'es'));
                    } catch { /* sin permiso */ }
                    return { id: d.id, nombre: d.data().nombre || 'Comunidad', cursos };
                }));
                if (vivo) setComunidades(coms.filter(c => c.cursos.length));
            })
            .catch(e => { if (vivo) { setComunidades([]); setErrorNube(e.message); } });
        return () => { vivo = false; };
    }, [user?.uid]);

    // ── Lista seleccionada ──
    // sel = { clave, origen: 'dispositivo'|'grupo'|'comunidad'|'nueva'|'numero', nombre, alumnos:[{nombre, sub}], listaId? }
    const [sel, setSel] = useState(null);
    const [ausentes, setAusentes] = useState(() => new Set());
    const [subgrupo, setSubgrupo] = useState('');
    const [texto, setTexto] = useState('');
    const [nombreLista, setNombreLista] = useState('');
    const [numero, setNumero] = useState(24);
    const [aviso, setAviso] = useState('');

    const elegir = (s) => {
        setSel(s); setAusentes(new Set()); setSubgrupo(''); setAviso('');
        if (s.origen === 'dispositivo' || s.origen === 'nueva') {
            setTexto(s.alumnos.map(a => a.nombre).join('\n'));
            setNombreLista(s.nombre || '');
        }
        if (s.clave) guardarLS(LS_ULTIMA, s.clave);
    };

    const elegirDispositivo = l => elegir({ clave: `d:${l.id}`, origen: 'dispositivo', listaId: l.id, nombre: l.nombre, alumnos: l.alumnos.map(n => ({ nombre: n })) });
    const elegirGrupo = g => elegir({
        clave: `g:${g.id}`, origen: 'grupo', nombre: g.nombre,
        alumnos: (g.alumnos || []).filter(a => a?.nombre).map(a => ({ nombre: a.nombre, sub: (a.grupo || '').trim() })),
    });
    const elegirCurso = async (com, curso) => {
        setCargandoCurso(curso.id); setErrorNube('');
        try {
            const s = await getDoc(doc(db, 'comunidades', com.id, 'cursos', curso.id, 'privado', 'data'));
            const listado = ((s.exists() && s.data().listado) || []).filter(a => a?.nombre);
            elegir({
                clave: `c:${com.id}:${curso.id}`, origen: 'comunidad', nombre: `${curso.nombre} · ${com.nombre}`,
                alumnos: listado.map(a => ({ nombre: a.nombre, sub: (a.grupo || '').trim() })),
            });
        } catch (e) { setErrorNube('No se pudo leer el listado: ' + e.message); }
        setCargandoCurso('');
    };

    // Reabrir la última lista del dispositivo usada (las de la nube se vuelven a elegir a mano)
    useEffect(() => {
        const ultima = leerLS(LS_ULTIMA, '');
        const l = ultima.startsWith('d:') && listas.find(x => `d:${x.id}` === ultima);
        if (l) elegirDispositivo(l);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const editable = sel && (sel.origen === 'dispositivo' || sel.origen === 'nueva');
    const subgrupos = useMemo(() => [...new Set((sel?.alumnos || []).map(a => a.sub).filter(Boolean))].sort(), [sel]);
    const alumnosSel = useMemo(() => {
        if (!sel) return [];
        if (editable) return aLineas(texto).map(nombre => ({ nombre }));
        return sel.alumnos.filter(a => !subgrupo || a.sub === subgrupo);
    }, [sel, editable, texto, subgrupo]);
    const presentes = alumnosSel.filter((_, i) => !ausentes.has(i)).map(a => a.nombre);

    // Guarda la lista que se está escribiendo (nueva o del dispositivo) y devuelve su id
    const guardarEnDispositivo = (nombres = aLineas(texto), nombre = nombreLista) => {
        if (!nombres.length) return null;
        const nom = nombre.trim() || `Lista ${new Date().toLocaleDateString('es-ES')}`;
        const fecha = new Date().toISOString();
        if (sel?.origen === 'dispositivo' && sel.listaId) {
            guardarListas(listas.map(l => (l.id === sel.listaId ? { ...l, nombre: nom, alumnos: nombres, fecha } : l)));
            setSel(s => ({ ...s, nombre: nom }));
            return sel.listaId;
        }
        const id = nuevoId();
        guardarListas([...listas, { id, nombre: nom, alumnos: nombres, fecha }]);
        setSel({ clave: `d:${id}`, origen: 'dispositivo', listaId: id, nombre: nom, alumnos: nombres.map(n => ({ nombre: n })) });
        setNombreLista(nom);
        guardarLS(LS_ULTIMA, `d:${id}`);
        return id;
    };

    const copiarAlDispositivo = () => {
        const nombres = alumnosSel.map(a => a.nombre);
        const nom = subgrupo ? `${sel.nombre} (${subgrupo})` : sel.nombre;
        const id = nuevoId();
        guardarListas([...listas, { id, nombre: nom, alumnos: nombres, fecha: new Date().toISOString() }]);
        setAviso(`📱 Copia guardada en este dispositivo como «${nom}».`);
    };

    const borrarLista = (l) => {
        if (!window.confirm(`¿Borrar la lista «${l.nombre}» de este dispositivo?`)) return;
        guardarListas(listas.filter(x => x.id !== l.id));
        if (sel?.listaId === l.id) setSel(null);
    };

    const generar = () => {
        let lista;
        if (sel?.origen === 'numero') lista = Array.from({ length: Math.max(1, Number(numero) || 1) }, (_, i) => `Alumno ${i + 1}`);
        else {
            lista = presentes;
            if (editable && aLineas(texto).length) {
                // Lo que se escribe aquí se guarda solo en el dispositivo
                guardarEnDispositivo();
                setAviso('📱 Lista guardada en este dispositivo.');
            }
        }
        setGrupos(formarGrupos(lista));
    };

    const toggleAusente = i => setAusentes(prev => { const n = new Set(prev); if (n.has(i)) n.delete(i); else n.add(i); return n; });

    const activo = clave => sel?.clave === clave;

    return (
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 16px 40px', color: TINTA }}>
            <div style={{ background: 'white', borderRadius: 18, padding: 18, marginBottom: 16 }}>
                <h3 style={{ marginTop: 0, marginBottom: 4 }}>👥 Grupos aleatorios visibles</h3>
                <p style={{ marginTop: 0, fontSize: '0.9rem', color: '#4b5563' }}>Hazlo delante de la clase y cambia los grupos en cada tarea. Grupos de 3; si sobran alumnos, algunos grupos serán de 4.</p>

                {/* ── Fuentes ── */}
                <div style={tituloFuente}>📱 Guardadas en este dispositivo</div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                    {listas.map(l => (
                        <span key={l.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                            <button onClick={() => elegirDispositivo(l)} style={chip(activo(`d:${l.id}`), '#0d9488')}>{l.nombre} · {l.alumnos.length}</button>
                            <button onClick={() => borrarLista(l)} title="Borrar del dispositivo" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: '0.85rem' }}>✕</button>
                        </span>
                    ))}
                    <button onClick={() => elegir({ clave: 'nueva', origen: 'nueva', nombre: '', alumnos: [] })} style={chip(activo('nueva'), '#2563eb')}>✍️ Nueva lista</button>
                    <button onClick={() => elegir({ clave: 'numero', origen: 'numero', nombre: '', alumnos: [] })} style={chip(activo('numero'), '#64748b')}>🔢 Solo número de alumnos</button>
                </div>

                {!user?.uid && (
                    <div style={{ marginTop: 12, fontSize: '0.84rem', color: '#6b7280', background: '#f8fafc', borderRadius: 10, padding: '8px 12px' }}>
                        🔒 Inicia sesión para ver aquí tus grupos y los cursos de las comunidades de las que eres miembro.
                    </div>
                )}

                {user?.uid && (
                    <>
                        <div style={tituloFuente}>👩‍🏫 Mis grupos</div>
                        {misGrupos === null
                            ? <div style={{ fontSize: '0.84rem', color: '#9ca3af' }}>Cargando…</div>
                            : misGrupos.length === 0
                                ? <div style={{ fontSize: '0.84rem', color: '#9ca3af' }}>No tienes grupos con alumnos (se crean en la pestaña Grupos del panel).</div>
                                : <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                    {misGrupos.map(g => <button key={g.id} onClick={() => elegirGrupo(g)} style={chip(activo(`g:${g.id}`), '#7c3aed')}>{g.nombre} · {g.alumnos.length}</button>)}
                                </div>}

                        <div style={tituloFuente}>🏫 Mis comunidades</div>
                        {comunidades === null
                            ? <div style={{ fontSize: '0.84rem', color: '#9ca3af' }}>Cargando…</div>
                            : comunidades.length === 0
                                ? <div style={{ fontSize: '0.84rem', color: '#9ca3af' }}>No perteneces a ninguna comunidad con cursos.</div>
                                : comunidades.map(com => (
                                    <div key={com.id} style={{ marginBottom: 8 }}>
                                        <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#b45309', marginBottom: 4 }}>{com.nombre}</div>
                                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                            {com.cursos.map(c => (
                                                <button key={c.id} onClick={() => elegirCurso(com, c)} disabled={cargandoCurso === c.id} style={chip(activo(`c:${com.id}:${c.id}`), '#b45309')}>
                                                    {cargandoCurso === c.id ? '…' : c.nombre}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                        {errorNube && <div style={{ color: '#dc2626', fontSize: '0.8rem', marginTop: 6 }}>⚠ {errorNube}</div>}
                    </>
                )}
            </div>

            {/* ── Lista elegida ── */}
            {sel && (
                <div style={{ background: 'white', borderRadius: 18, padding: 18, marginBottom: 16 }}>
                    {sel.origen === 'numero' ? (
                        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                            <label style={{ fontWeight: 700 }}>Número de alumnos</label>
                            <input type="number" min={1} value={numero} onChange={e => setNumero(e.target.value)} style={{ padding: '9px 12px', borderRadius: 10, border: '1.5px solid #d1d5db', width: 110, fontSize: '1rem' }} />
                        </div>
                    ) : editable ? (
                        <>
                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 8 }}>
                                <input value={nombreLista} onChange={e => setNombreLista(e.target.value)} placeholder="Nombre de la lista (ej.: 1º ESO B)" style={{ padding: '9px 12px', borderRadius: 10, border: '1.5px solid #d1d5db', fontFamily: 'inherit', flex: '1 1 220px' }} />
                                <button onClick={() => { if (guardarEnDispositivo()) setAviso('📱 Lista guardada en este dispositivo.'); }} disabled={!aLineas(texto).length} style={btn(aLineas(texto).length ? '#0d9488' : '#9ca3af')}>💾 Guardar en este dispositivo</button>
                            </div>
                            <textarea value={texto} onChange={e => { setTexto(e.target.value); setAusentes(new Set()); }} rows={7} placeholder={'Un nombre por línea\nAna\nBruno\nCarla…'} style={{ width: '100%', boxSizing: 'border-box', borderRadius: 10, border: '1.5px solid #d1d5db', padding: 10, fontFamily: 'inherit', fontSize: '0.92rem' }} />
                            <div style={{ fontSize: '0.78rem', color: '#6b7280', marginTop: 4 }}>Se guarda en este dispositivo al pulsar «Guardar» o al formar los grupos.</div>
                        </>
                    ) : (
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                            <div style={{ fontWeight: 800, flex: 1 }}>{sel.origen === 'grupo' ? '👩‍🏫' : '🏫'} {sel.nombre}</div>
                            {alumnosSel.length > 0 && <button onClick={copiarAlDispositivo} style={btn('#e0f2f1', '#0f766e', { padding: '6px 12px' })}>📱 Guardar copia en el dispositivo</button>}
                        </div>
                    )}

                    {!editable && subgrupos.length > 1 && (
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
                            <button onClick={() => { setSubgrupo(''); setAusentes(new Set()); }} style={chip(!subgrupo, '#334155')}>Todos</button>
                            {subgrupos.map(s => <button key={s} onClick={() => { setSubgrupo(s); setAusentes(new Set()); }} style={chip(subgrupo === s, '#334155')}>{s}</button>)}
                        </div>
                    )}

                    {sel.origen !== 'numero' && alumnosSel.length > 0 && (
                        <>
                            <div style={{ fontSize: '0.8rem', color: '#6b7280', margin: '12px 0 6px' }}>Toca a un alumno para marcarlo <b>ausente</b> (no entra en los grupos). {presentes.length}/{alumnosSel.length} presentes.</div>
                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                {alumnosSel.map((a, i) => {
                                    const aus = ausentes.has(i);
                                    return (
                                        <button key={i} onClick={() => toggleAusente(i)} style={{
                                            padding: '5px 10px', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.84rem',
                                            border: '1px solid #e5e7eb', background: aus ? '#f3f4f6' : '#f0fdf4',
                                            color: aus ? '#9ca3af' : TINTA, textDecoration: aus ? 'line-through' : 'none',
                                        }}>{a.nombre}</button>
                                    );
                                })}
                            </div>
                        </>
                    )}
                    {sel.origen !== 'numero' && !editable && alumnosSel.length === 0 && (
                        <div style={{ fontSize: '0.85rem', color: '#9ca3af', marginTop: 8 }}>Esta lista no tiene alumnos.</div>
                    )}

                    <div style={{ display: 'flex', gap: 10, marginTop: 14, alignItems: 'center', flexWrap: 'wrap' }}>
                        <button onClick={generar} disabled={sel.origen !== 'numero' && presentes.length === 0} style={btn(sel.origen !== 'numero' && presentes.length === 0 ? '#9ca3af' : '#2563eb')}>
                            🎲 {grupos.length ? 'Volver a sortear' : 'Formar grupos'}
                        </button>
                        {aviso && <span style={{ fontSize: '0.84rem', color: '#0f766e', fontWeight: 700 }}>{aviso}</span>}
                    </div>
                </div>
            )}

            {grupos.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
                    {grupos.map((g, i) => (
                        <div key={i} style={{ background: 'white', borderRadius: 14, padding: '12px 16px', borderTop: '5px solid #f59e0b' }}>
                            <div style={{ fontWeight: 900, fontSize: '1.15rem', color: '#b45309' }}>Pizarra {i + 1}</div>
                            {g.map((n, k) => <div key={k} style={{ fontSize: '1.05rem' }}>{n}</div>)}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
