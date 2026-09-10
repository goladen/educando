import React, { useState, useEffect, useCallback } from 'react';
import { db } from '../firebase';
import {
    collection, query, where, getDocs, getDoc, doc,
    addDoc, updateDoc, deleteDoc, onSnapshot, serverTimestamp
} from 'firebase/firestore';
import {
    Trophy, Plus, Search, X, RefreshCw, ChevronLeft, Trash2, Pencil, Eye,
    Users, GraduationCap, UserPlus, Image as ImageIcon, Video, Gamepad2,
    ExternalLink, Medal, ArrowUpDown
} from 'lucide-react';

const AZUL = '#1565C0';
const nid = () => Math.random().toString(36).slice(2, 9);
const norm = (s) => (s || '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

// ─── Modal: añadir participantes (mis grupos / comunidad / manual) ─────────────
function ModalParticipantes({ usuario, onClose, onAdd }) {
    const [tab, setTab]         = useState('grupos');
    const [grupos, setGrupos]   = useState([]);
    const [comunidades, setComunidades] = useState([]);
    const [comSel, setComSel]   = useState('');
    const [cursos, setCursos]   = useState([]);
    const [cursoSel, setCursoSel] = useState('');
    const [listado, setListado] = useState([]);
    const [sel, setSel]         = useState(new Set());
    const [manual, setManual]   = useState('');
    const [cargando, setCargando] = useState(false);

    useEffect(() => {
        getDocs(query(collection(db, 'grupos_profesor'), where('profesorUid', '==', usuario.uid)))
            .then(s => setGrupos(s.docs.map(d => ({ id: d.id, ...d.data() })))).catch(() => {});
        getDocs(query(collection(db, 'comunidades'), where('miembros', 'array-contains', usuario.uid)))
            .then(s => setComunidades(s.docs.map(d => ({ id: d.id, ...d.data() })))).catch(() => {});
    }, [usuario.uid]);

    // Al elegir comunidad → cargar sus cursos
    useEffect(() => {
        if (!comSel) { setCursos([]); setCursoSel(''); return; }
        getDocs(collection(db, 'comunidades', comSel, 'cursos'))
            .then(s => setCursos(s.docs.map(d => ({ id: d.id, ...d.data() })))).catch(() => {});
    }, [comSel]);
    // Al elegir curso → cargar su listado (privado, solo miembros)
    useEffect(() => {
        if (!comSel || !cursoSel) { setListado([]); return; }
        setCargando(true);
        getDoc(doc(db, 'comunidades', comSel, 'cursos', cursoSel, 'privado', 'data'))
            .then(s => setListado(s.exists() ? (s.data().listado || []) : []))
            .catch(() => {}).finally(() => setCargando(false));
    }, [comSel, cursoSel]);

    const toggle = (id) => setSel(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
    const addLista = (alumnos, marcados) => {
        const elegidos = marcados ? alumnos.filter(a => sel.has(a.id)) : alumnos;
        onAdd(elegidos.map(a => ({ id: nid(), nombre: a.nombre })));
    };

    const tabBtn = (id, lbl) => (
        <button onClick={() => { setTab(id); setSel(new Set()); }} style={{ padding: '8px 14px', border: 'none', background: 'none', cursor: 'pointer', fontSize: '0.86rem', borderBottom: tab === id ? `3px solid ${AZUL}` : '3px solid transparent', color: tab === id ? AZUL : '#7f8c8d', fontWeight: tab === id ? 700 : 500 }}>{lbl}</button>
    );

    return (
        <div style={s.overlay} onClick={onClose}>
            <div style={{ ...s.panel, maxWidth: 520 }} onClick={e => e.stopPropagation()}>
                <div style={s.header}><div style={s.hTitle}><UserPlus size={19} color={AZUL} /> Añadir participantes</div><button onClick={onClose} style={s.closeBtn}><X size={18} /></button></div>
                <div style={{ display: 'flex', gap: 4, borderBottom: '2px solid #e0e4f0', marginBottom: 14, flexWrap: 'wrap' }}>
                    {tabBtn('grupos', '👥 Mis grupos')}
                    {tabBtn('comunidad', '🏫 Comunidad')}
                    {tabBtn('manual', '✏️ Manual')}
                </div>

                {tab === 'grupos' && (
                    grupos.length === 0 ? <div style={s.vacio}>No tienes grupos. Créalos en Informes → Grupos.</div> : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {grupos.map(g => (
                                <div key={g.id} style={s.fila}>
                                    <Users size={15} color={AZUL} />
                                    <span style={{ flex: 1 }}>{g.nombre} <span style={{ color: '#95a5a6', fontSize: '0.8rem' }}>({g.alumnos?.length || 0})</span></span>
                                    <button onClick={() => addLista(g.alumnos || [], false)} style={s.btnMini}><Plus size={13} /> Añadir todos</button>
                                </div>
                            ))}
                        </div>
                    )
                )}

                {tab === 'comunidad' && (
                    <div>
                        <select value={comSel} onChange={e => setComSel(e.target.value)} style={s.input}>
                            <option value="">Elige una comunidad…</option>
                            {comunidades.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                        </select>
                        {comSel && (
                            <select value={cursoSel} onChange={e => setCursoSel(e.target.value)} style={s.input}>
                                <option value="">Elige un curso…</option>
                                {cursos.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                            </select>
                        )}
                        {cargando ? <div style={s.loader}><RefreshCw size={20} style={{ animation: 'spin 1s linear infinite' }} /></div>
                            : cursoSel && (listado.length === 0 ? <div style={s.vacio}>Ese curso no tiene listado.</div> : (
                                <>
                                    <div style={{ maxHeight: 260, overflowY: 'auto', border: '1px solid #e0e4f0', borderRadius: 8, marginBottom: 10 }}>
                                        {listado.map(a => (
                                            <label key={a.id} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '6px 10px', borderBottom: '1px solid #f3f3f3', cursor: 'pointer' }}>
                                                <input type="checkbox" checked={sel.has(a.id)} onChange={() => toggle(a.id)} /> {a.nombre}
                                            </label>
                                        ))}
                                    </div>
                                    <div style={s.btnRow}>
                                        <button onClick={() => addLista(listado, false)} style={s.btnSec}>Añadir todos</button>
                                        <button onClick={() => addLista(listado, true)} disabled={sel.size === 0} style={s.btnPrimary}>Añadir {sel.size || ''} seleccionados</button>
                                    </div>
                                </>
                            ))}
                    </div>
                )}

                {tab === 'manual' && (
                    <div>
                        <div style={{ fontSize: '0.82rem', color: '#7f8c8d', marginBottom: 8 }}>Escribe un nombre por línea.</div>
                        <textarea value={manual} onChange={e => setManual(e.target.value)} rows={5} placeholder={'Ana García\nLuis Pérez'} style={{ ...s.input, resize: 'vertical' }} />
                        <div style={s.btnRow}>
                            <button onClick={() => { const ns = manual.split(/\r?\n/).map(x => x.trim()).filter(Boolean); if (ns.length) onAdd(ns.map(n => ({ id: nid(), nombre: n }))); }} disabled={!manual.trim()} style={s.btnPrimary}><Plus size={14} /> Añadir</button>
                        </div>
                    </div>
                )}
                <style>{spin}</style>
            </div>
        </div>
    );
}

// ─── Modal: elegir un recurso/juego de pikt.es ────────────────────────────────
function ModalRecurso({ usuario, onClose, onElegir }) {
    const [propios, setPropios] = useState([]);
    const [publicos, setPublicos] = useState(null);
    const [q, setQ] = useState('');
    const [cargando, setCargando] = useState(true);

    useEffect(() => {
        getDocs(query(collection(db, 'resources'), where('profesorUid', '==', usuario.uid)))
            .then(s => setPropios(s.docs.map(d => ({ id: d.id, ...d.data() }))))
            .catch(() => {}).finally(() => setCargando(false));
    }, [usuario.uid]);

    const buscarPublicos = async () => {
        setCargando(true);
        try { const s = await getDocs(query(collection(db, 'resources'), where('isPrivate', '==', false))); setPublicos(s.docs.map(d => ({ id: d.id, ...d.data() }))); }
        catch (_) {}
        setCargando(false);
    };

    const base = publicos || propios;
    const filtro = norm(q);
    const lista = base.filter(r => !filtro || norm(r.titulo).includes(filtro) || norm(r.tipoJuego).includes(filtro)).slice(0, 80);

    return (
        <div style={s.overlay} onClick={onClose}>
            <div style={{ ...s.panel, maxWidth: 520 }} onClick={e => e.stopPropagation()}>
                <div style={s.header}><div style={s.hTitle}><Gamepad2 size={19} color={AZUL} /> Asignar juego / recurso</div><button onClick={onClose} style={s.closeBtn}><X size={18} /></button></div>
                <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                    <input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar por título…" style={{ ...s.input, marginBottom: 0, flex: 1 }} />
                    {!publicos && <button onClick={buscarPublicos} style={s.btnSec}>Buscar en biblioteca</button>}
                </div>
                <div style={{ fontSize: '0.75rem', color: '#95a5a6', marginBottom: 8 }}>{publicos ? 'Biblioteca pública' : 'Tus recursos'}</div>
                {cargando ? <div style={s.loader}><RefreshCw size={20} style={{ animation: 'spin 1s linear infinite' }} /></div>
                    : lista.length === 0 ? <div style={s.vacio}>Sin resultados.</div> : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 340, overflowY: 'auto' }}>
                            {lista.map(r => (
                                <button key={r.id} onClick={() => onElegir({ recursoId: r.id, recursoTitulo: r.titulo || 'Recurso' })} style={s.fila}>
                                    <Gamepad2 size={14} color={AZUL} />
                                    <span style={{ flex: 1, textAlign: 'left' }}>{r.titulo || 'Recurso'}</span>
                                    <span style={{ fontSize: '0.72rem', color: '#95a5a6' }}>{r.tipoJuego}</span>
                                </button>
                            ))}
                        </div>
                    )}
                <style>{spin}</style>
            </div>
        </div>
    );
}

// ─── Modal: editar categoría (foto, título, descripción, vídeo, recurso) ───────
function ModalCategoria({ usuario, categoria, onClose, onGuardar }) {
    const [c, setC] = useState(categoria || { id: nid(), titulo: '', descripcion: '', fotoUrl: '', videoUrl: '', recursoId: '', recursoTitulo: '' });
    const [modalRec, setModalRec] = useState(false);
    return (
        <div style={s.overlay} onClick={onClose}>
            <div style={{ ...s.panel, maxWidth: 480 }} onClick={e => e.stopPropagation()}>
                <div style={s.header}><div style={s.hTitle}><Medal size={19} color={AZUL} /> {categoria ? 'Editar' : 'Nueva'} prueba/categoría</div><button onClick={onClose} style={s.closeBtn}><X size={18} /></button></div>
                <div style={s.label}>Título</div>
                <input autoFocus value={c.titulo} onChange={e => setC({ ...c, titulo: e.target.value })} placeholder="Ej: Prueba de velocidad" style={s.input} />
                <div style={s.label}>Foto (URL)</div>
                <input value={c.fotoUrl} onChange={e => setC({ ...c, fotoUrl: e.target.value })} placeholder="https://…/foto.jpg" style={s.input} />
                {c.fotoUrl && <img src={c.fotoUrl} alt="" onError={e => { e.currentTarget.style.display = 'none'; }} style={{ width: '100%', maxHeight: 120, objectFit: 'cover', borderRadius: 8, marginBottom: 10 }} />}
                <div style={s.label}>Descripción</div>
                <textarea value={c.descripcion} onChange={e => setC({ ...c, descripcion: e.target.value })} rows={3} placeholder="En qué consiste la prueba…" style={{ ...s.input, resize: 'vertical' }} />
                <div style={s.label}>Vídeo (URL, opcional)</div>
                <input value={c.videoUrl} onChange={e => setC({ ...c, videoUrl: e.target.value })} placeholder="https://youtu.be/…" style={s.input} />
                <div style={s.label}>Juego / recurso de pikt.es (opcional)</div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
                    <button onClick={() => setModalRec(true)} style={s.btnSec}><Gamepad2 size={14} /> {c.recursoId ? 'Cambiar' : 'Asignar'}</button>
                    {c.recursoId && <span style={{ fontSize: '0.82rem', color: '#2c3e50', flex: 1 }}>{c.recursoTitulo} <button onClick={() => setC({ ...c, recursoId: '', recursoTitulo: '' })} style={{ background: 'none', border: 'none', color: '#e74c3c', cursor: 'pointer' }}><X size={13} /></button></span>}
                </div>
                <div style={s.btnRow}>
                    <button onClick={onClose} style={s.btnSec}>Cancelar</button>
                    <button onClick={() => { if (c.titulo.trim()) onGuardar({ ...c, titulo: c.titulo.trim() }); }} disabled={!c.titulo.trim()} style={s.btnPrimary}>Guardar</button>
                </div>
                {modalRec && <ModalRecurso usuario={usuario} onClose={() => setModalRec(false)} onElegir={(r) => { setC({ ...c, ...r }); setModalRec(false); }} />}
            </div>
        </div>
    );
}

// ─── Modal: ver categoría (foto, descripción, vídeo, recurso) ─────────────────
function ModalVerCategoria({ categoria, onClose }) {
    const c = categoria;
    const yt = (c.videoUrl || '').match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/))([\w-]{11})/);
    return (
        <div style={s.overlay} onClick={onClose}>
            <div style={{ ...s.panel, maxWidth: 560 }} onClick={e => e.stopPropagation()}>
                <div style={s.header}><div style={s.hTitle}><Medal size={19} color={AZUL} /> {c.titulo}</div><button onClick={onClose} style={s.closeBtn}><X size={18} /></button></div>
                {c.fotoUrl && <img src={c.fotoUrl} alt="" onError={e => { e.currentTarget.style.display = 'none'; }} style={{ width: '100%', maxHeight: 220, objectFit: 'cover', borderRadius: 10, marginBottom: 12 }} />}
                {c.descripcion && <p style={{ color: '#555', fontSize: '0.9rem', lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>{c.descripcion}</p>}
                {yt && <div style={{ position: 'relative', paddingBottom: '56.25%', height: 0, margin: '12px 0', borderRadius: 10, overflow: 'hidden' }}><iframe title="vídeo" src={`https://www.youtube.com/embed/${yt[1]}`} allowFullScreen style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 0 }} /></div>}
                {c.videoUrl && !yt && <a href={c.videoUrl} target="_blank" rel="noreferrer" style={s.chipLink}><Video size={14} /> Ver vídeo <ExternalLink size={11} /></a>}
                {c.recursoId && <a href={`/?r=${c.recursoId}`} target="_blank" rel="noreferrer" style={{ ...s.chipLink, marginLeft: c.videoUrl ? 8 : 0 }}><Gamepad2 size={14} /> {c.recursoTitulo || 'Abrir juego'} <ExternalLink size={11} /></a>}
            </div>
        </div>
    );
}

// ─── Editor de una competición (hoja de cálculo) ──────────────────────────────
function CompeticionEditor({ usuario, compId, onBack }) {
    const [comp, setComp]   = useState(null);
    const [parts, setParts] = useState([]);
    const [addPart, setAddPart] = useState(false);
    const [catEdit, setCatEdit] = useState(null);   // categoria a editar (o {} nueva) o null
    const [catVer, setCatVer]   = useState(null);
    const [ordenar, setOrdenar] = useState(false);
    const [copiado, setCopiado] = useState(false);
    const ref = doc(db, 'competiciones', compId);

    useEffect(() => onSnapshot(ref, sn => setComp(sn.exists() ? { id: sn.id, ...sn.data() } : null), () => {}), [compId]);
    useEffect(() => onSnapshot(collection(db, 'competiciones', compId, 'participantes'), sn => {
        const d = sn.docs.map(x => ({ id: x.id, ...x.data() }));
        d.sort((a, b) => (a.fecha?.seconds || 0) - (b.fecha?.seconds || 0));
        setParts(d);
    }, () => {}), [compId]);

    if (!comp) return <div style={s.loader}><RefreshCw size={24} style={{ animation: 'spin 1s linear infinite' }} /></div>;

    const categorias = comp.categorias || [];
    const puntos = comp.puntos || {};
    const aceptados = parts.filter(p => p.estado !== 'pendiente');
    const pendientes = parts.filter(p => p.estado === 'pendiente');
    const publicUrl = `${window.location.origin}/competicion/${compId}`;
    const total = (pid) => categorias.reduce((acc, c) => acc + (Number(puntos[`${pid}_${c.id}`]) || 0), 0);
    const filas = ordenar ? [...aceptados].sort((a, b) => total(b.id) - total(a.id)) : aceptados;

    const guardar = (campos) => updateDoc(ref, campos).catch(e => alert('Error: ' + e.message));
    const addParticipantes = async (nuevos) => {
        try { await Promise.all(nuevos.map(nv => addDoc(collection(db, 'competiciones', compId, 'participantes'), { nombre: nv.nombre, estado: 'aceptada', origen: 'creador', fecha: serverTimestamp() }))); }
        catch (e) { alert('Error: ' + e.message); }
        setAddPart(false);
    };
    const delParticipante = async (id) => {
        const p2 = {}; Object.keys(puntos).forEach(k => { if (!k.startsWith(id + '_')) p2[k] = puntos[k]; });
        try { await deleteDoc(doc(db, 'competiciones', compId, 'participantes', id)); await updateDoc(ref, { puntos: p2 }); }
        catch (e) { alert('Error: ' + e.message); }
    };
    const aprobar = (id) => updateDoc(doc(db, 'competiciones', compId, 'participantes', id), { estado: 'aceptada' }).catch(() => {});
    const rechazar = (id) => deleteDoc(doc(db, 'competiciones', compId, 'participantes', id)).catch(() => {});
    const copiarLink = async () => { try { await navigator.clipboard.writeText(publicUrl); } catch { window.prompt('Enlace público:', publicUrl); } setCopiado(true); setTimeout(() => setCopiado(false), 2000); };
    const upsertCategoria = (cat) => {
        const existe = categorias.some(c => c.id === cat.id);
        guardar({ categorias: existe ? categorias.map(c => c.id === cat.id ? cat : c) : [...categorias, cat] });
        setCatEdit(null);
    };
    const delCategoria = (id) => {
        const p2 = {}; Object.keys(puntos).forEach(k => { if (!k.endsWith('_' + id)) p2[k] = puntos[k]; });
        guardar({ categorias: categorias.filter(c => c.id !== id), puntos: p2 });
    };
    const setPunto = (pid, cid, val) => {
        const key = `${pid}_${cid}`;
        updateDoc(ref, { [`puntos.${key}`]: val === '' ? 0 : Number(val) }).catch(() => {});
    };

    return (
        <div>
            <button onClick={onBack} style={s.backBtn}><ChevronLeft size={16} /> Competiciones</button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
                <h2 style={{ margin: 0, color: '#2c3e50', display: 'flex', alignItems: 'center', gap: 8 }}><Trophy size={24} color="#f39c12" /> {comp.nombre}</h2>
                <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <button onClick={() => setOrdenar(v => !v)} style={{ ...s.btnSec, ...(ordenar ? { color: AZUL, borderColor: '#cdd6ea' } : {}) }}><ArrowUpDown size={15} /> {ordenar ? 'Orden por puntos' : 'Ordenar por puntos'}</button>
                    <button onClick={() => setAddPart(true)} style={s.btnSec}><UserPlus size={15} /> Participantes</button>
                    <button onClick={() => setCatEdit({})} style={s.btnPrimary}><Plus size={15} /> Prueba</button>
                </div>
            </div>

            {/* Inscripción + enlace público */}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12, padding: '10px 12px', background: '#f8f9fb', borderRadius: 10 }}>
                <span style={{ fontSize: '0.82rem', color: '#7f8c8d', fontWeight: 600 }}>Inscripción:</span>
                {[['creador', 'Solo el creador'], ['auto', 'Automática'], ['aprobacion', 'Con aprobación']].map(([id, lbl]) => {
                    const activo = (comp.inscripcion || 'creador') === id;
                    return <button key={id} onClick={() => guardar({ inscripcion: id })} style={{ padding: '5px 12px', borderRadius: 20, border: `1.5px solid ${activo ? AZUL : '#e0e4f0'}`, background: activo ? AZUL : 'white', color: activo ? 'white' : '#555', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 700 }}>{lbl}</button>;
                })}
                <div style={{ display: 'flex', gap: 6, marginLeft: 'auto', alignItems: 'center', flexWrap: 'wrap' }}>
                    <button onClick={copiarLink} style={s.btnSec}>{copiado ? '✅ Copiado' : '🔗 Enlace público'}</button>
                    <a href={publicUrl} target="_blank" rel="noreferrer" style={{ ...s.btnSec, textDecoration: 'none' }}><ExternalLink size={14} /> Ver página</a>
                </div>
            </div>

            {pendientes.length > 0 && (
                <div style={{ marginBottom: 14 }}>
                    <h3 style={{ color: '#c15600', fontSize: '0.95rem', margin: '0 0 8px' }}>Inscripciones pendientes ({pendientes.length})</h3>
                    {pendientes.map(p => (
                        <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', border: '1px solid #ffe0c2', background: '#fff8f0', borderRadius: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                            <div style={{ flex: 1, minWidth: 140 }}><strong>{p.nombre}</strong>{p.email ? <span style={{ color: '#95a5a6', fontSize: '0.8rem' }}> · {p.email}</span> : ''}{p.extra ? <div style={{ fontSize: '0.78rem', color: '#7f8c8d' }}>{p.extra}</div> : null}</div>
                            <button onClick={() => aprobar(p.id)} style={{ ...s.btnMini, color: '#27ae60', borderColor: '#b6e2c1' }}>Aceptar</button>
                            <button onClick={() => rechazar(p.id)} style={{ ...s.btnMini, color: '#e74c3c', borderColor: '#f3c9c4' }}>Rechazar</button>
                        </div>
                    ))}
                </div>
            )}

            {aceptados.length === 0 && categorias.length === 0 ? (
                <div style={s.vacio}>Añade participantes y crea pruebas/categorías para empezar.</div>
            ) : (
                <div style={{ overflowX: 'auto', border: '1px solid #e0e4f0', borderRadius: 10 }}>
                    <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: '0.86rem' }}>
                        <thead>
                            <tr style={{ background: '#f4f6f8' }}>
                                <th style={{ ...s.th, position: 'sticky', left: 0, background: '#f4f6f8', minWidth: 150 }}>Participante</th>
                                {categorias.map(c => (
                                    <th key={c.id} style={{ ...s.th, minWidth: 120, textAlign: 'center' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'center', flexWrap: 'wrap' }}>
                                            <button onClick={() => setCatVer(c)} title="Ver" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#2c3e50', fontWeight: 700, fontSize: '0.82rem', padding: 0 }}>{c.titulo}</button>
                                            {(c.fotoUrl || c.videoUrl || c.recursoId) && <Eye size={12} color="#95a5a6" />}
                                            <button onClick={() => setCatEdit(c)} title="Editar" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#f39c12', padding: 0 }}><Pencil size={12} /></button>
                                            <button onClick={() => delCategoria(c.id)} title="Eliminar" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#e74c3c', padding: 0 }}><Trash2 size={12} /></button>
                                        </div>
                                    </th>
                                ))}
                                <th style={{ ...s.th, textAlign: 'center', minWidth: 70 }}>Total</th>
                                <th style={s.th}></th>
                            </tr>
                        </thead>
                        <tbody>
                            {filas.map((p, i) => (
                                <tr key={p.id} style={{ background: i % 2 ? '#fafafa' : 'white' }}>
                                    <td style={{ ...s.td, position: 'sticky', left: 0, background: i % 2 ? '#fafafa' : 'white', fontWeight: 600, color: '#2c3e50' }}>
                                        {ordenar && i < 3 && <span style={{ marginRight: 5 }}>{['🥇', '🥈', '🥉'][i]}</span>}{p.nombre}
                                    </td>
                                    {categorias.map(c => (
                                        <td key={c.id} style={{ ...s.td, textAlign: 'center' }}>
                                            <input type="number" defaultValue={puntos[`${p.id}_${c.id}`] ?? ''} onBlur={e => setPunto(p.id, c.id, e.target.value)}
                                                style={{ width: 60, padding: '4px 6px', borderRadius: 6, border: '1.5px solid #e0e4f0', textAlign: 'center', fontFamily: 'inherit', outline: 'none' }} />
                                        </td>
                                    ))}
                                    <td style={{ ...s.td, textAlign: 'center', fontWeight: 800, color: AZUL }}>{total(p.id)}</td>
                                    <td style={s.td}><button onClick={() => delParticipante(p.id)} title="Quitar" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#e74c3c', padding: 2 }}><Trash2 size={14} /></button></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {addPart && <ModalParticipantes usuario={usuario} onClose={() => setAddPart(false)} onAdd={addParticipantes} />}
            {catEdit && <ModalCategoria usuario={usuario} categoria={catEdit.id ? catEdit : null} onClose={() => setCatEdit(null)} onGuardar={upsertCategoria} />}
            {catVer && <ModalVerCategoria categoria={catVer} onClose={() => setCatVer(null)} />}
            <style>{spin}</style>
        </div>
    );
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function CompeticionesTab({ usuario }) {
    const [comps, setComps]   = useState([]);
    const [cargando, setCargando] = useState(true);
    const [abierta, setAbierta] = useState(null);
    const [nueva, setNueva]   = useState('');
    const [creando, setCreando] = useState(false);
    const [confirmarBorrar, setConfirmarBorrar] = useState(null);

    const cargar = useCallback(async () => {
        setCargando(true);
        try {
            const snap = await getDocs(query(collection(db, 'competiciones'), where('profesorUid', '==', usuario.uid)));
            const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            docs.sort((a, b) => (b.fechaCreacion?.seconds || 0) - (a.fechaCreacion?.seconds || 0));
            setComps(docs);
        } catch (e) { console.error(e); }
        setCargando(false);
    }, [usuario.uid]);
    useEffect(() => { cargar(); }, [cargar]);

    const crear = async () => {
        const n = nueva.trim(); if (!n) return;
        setCreando(true);
        try {
            const r = await addDoc(collection(db, 'competiciones'), {
                nombre: n, profesorUid: usuario.uid, creadorNombre: usuario.displayName || 'Profesor/a',
                categorias: [], puntos: {}, inscripcion: 'creador', fechaCreacion: serverTimestamp(),
            });
            setNueva(''); setAbierta(r.id);
        } catch (e) { alert('No se pudo crear: ' + e.message); }
        setCreando(false);
    };
    const borrar = async (id) => {
        try { await deleteDoc(doc(db, 'competiciones', id)); setComps(cs => cs.filter(c => c.id !== id)); }
        catch (e) { alert('Error: ' + e.message); }
        setConfirmarBorrar(null);
    };

    if (abierta) return <CompeticionEditor usuario={usuario} compId={abierta} onBack={() => { setAbierta(null); cargar(); }} />;

    return (
        <div style={{ maxWidth: 1000, margin: '0 auto', padding: '10px 4px' }}>
            <h2 style={{ margin: '0 0 16px', color: '#2c3e50', display: 'flex', alignItems: 'center', gap: 10 }}><Trophy size={28} color="#f39c12" /> Competiciones</h2>
            <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
                <input value={nueva} onChange={e => setNueva(e.target.value)} onKeyDown={e => e.key === 'Enter' && crear()} placeholder="Nombre de la competición (ej: Olimpiadas de aula)" style={{ ...s.input, marginBottom: 0, flex: 1 }} />
                <button onClick={crear} disabled={creando || !nueva.trim()} style={s.btnPrimary}><Plus size={16} /> Crear</button>
            </div>

            {cargando ? <div style={s.loader}><RefreshCw size={26} style={{ animation: 'spin 1s linear infinite' }} /></div>
                : comps.length === 0 ? <div style={s.vacio}>No tienes competiciones. Crea la primera arriba.</div>
                : (
                    <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))' }}>
                        {comps.map(c => (
                            <div key={c.id} style={s.card}>
                                <div style={{ fontWeight: 700, color: '#2c3e50', display: 'flex', alignItems: 'center', gap: 6 }}><Trophy size={17} color="#f39c12" /> {c.nombre}</div>
                                <div style={{ fontSize: '0.75rem', color: '#95a5a6' }}>{c.categorias?.length || 0} pruebas · inscripción {({ creador: 'manual', auto: 'automática', aprobacion: 'con aprobación' }[c.inscripcion] || 'manual')}</div>
                                <div style={{ display: 'flex', gap: 6, marginTop: 'auto' }}>
                                    <button onClick={() => setAbierta(c.id)} style={{ ...s.btnPrimary, flex: 1, justifyContent: 'center' }}><Eye size={15} /> Abrir</button>
                                    {confirmarBorrar === c.id ? (
                                        <>
                                            <button onClick={() => borrar(c.id)} style={{ ...s.btnMini, color: 'white', background: '#e74c3c', borderColor: '#e74c3c' }}>Sí</button>
                                            <button onClick={() => setConfirmarBorrar(null)} style={s.btnMini}>No</button>
                                        </>
                                    ) : <button onClick={() => setConfirmarBorrar(c.id)} style={{ ...s.btnMini, color: '#e74c3c', borderColor: '#f3c9c4' }}><Trash2 size={13} /></button>}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            <style>{spin}</style>
        </div>
    );
}

const spin = `@keyframes spin{100%{transform:rotate(360deg)}}`;
const s = {
    overlay: { position: 'fixed', inset: 0, zIndex: 4000, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 },
    panel: { background: 'white', borderRadius: 20, width: '100%', padding: 26, boxShadow: '0 20px 50px rgba(0,0,0,0.25)', maxHeight: '90vh', overflowY: 'auto' },
    header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 },
    hTitle: { fontWeight: 700, color: '#2c3e50', fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: 8 },
    closeBtn: { background: 'none', border: 'none', cursor: 'pointer', color: '#95a5a6', padding: 4 },
    label: { fontSize: '0.76rem', fontWeight: 700, color: '#7f8c8d', textTransform: 'uppercase', letterSpacing: .5, marginBottom: 6, marginTop: 4 },
    input: { padding: '9px 12px', borderRadius: 8, border: '1.5px solid #e0e4f0', fontSize: '0.9rem', outline: 'none', width: '100%', boxSizing: 'border-box', fontFamily: 'inherit', marginBottom: 12, background: 'white' },
    btnRow: { display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 },
    btnPrimary: { display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', borderRadius: 9, border: 'none', background: AZUL, color: 'white', fontWeight: 700, cursor: 'pointer', fontSize: '0.86rem' },
    btnSec: { display: 'flex', alignItems: 'center', gap: 6, padding: '9px 14px', borderRadius: 9, border: '1.5px solid #e0e4f0', background: 'white', color: '#7f8c8d', fontWeight: 600, cursor: 'pointer', fontSize: '0.86rem' },
    btnMini: { display: 'flex', alignItems: 'center', gap: 4, padding: '6px 10px', borderRadius: 7, border: '1.5px solid #cdd6ea', background: 'white', color: '#555', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600 },
    backBtn: { display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', color: AZUL, cursor: 'pointer', fontWeight: 600, fontSize: '0.9rem', marginBottom: 14, padding: 0 },
    fila: { display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderRadius: 9, border: '1.5px solid #e0e4f0', background: 'white', cursor: 'pointer', fontSize: '0.88rem', width: '100%' },
    card: { background: 'white', borderRadius: 14, padding: 14, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', display: 'flex', flexDirection: 'column', gap: 8 },
    th: { padding: '9px 10px', textAlign: 'left', fontWeight: 700, fontSize: '0.78rem', color: '#2c3e50', borderBottom: '2px solid #e6e9f0' },
    td: { padding: '6px 10px', borderBottom: '1px solid #f0f0f0' },
    vacio: { textAlign: 'center', padding: 30, color: '#bdc3c7', fontSize: '0.9rem', background: 'white', borderRadius: 12 },
    loader: { textAlign: 'center', padding: 30, color: '#95a5a6' },
    chipLink: { display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: '0.82rem', background: '#e8f0fe', color: AZUL, padding: '6px 12px', borderRadius: 20, textDecoration: 'none', fontWeight: 600 },
};
