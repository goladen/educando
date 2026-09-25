import React, { useState, useEffect, useCallback } from 'react';
import { db } from '../firebase';
import {
    collection, query, where, getDocs, getDoc, doc,
    addDoc, setDoc, updateDoc, deleteDoc, onSnapshot, serverTimestamp
} from 'firebase/firestore';
import {
    Trophy, Plus, Search, X, RefreshCw, ChevronLeft, Trash2, Pencil, Eye,
    Users, GraduationCap, UserPlus, Image as ImageIcon, Video, Gamepad2,
    ExternalLink, Medal, ArrowUpDown, Wrench, EyeOff, UsersRound
} from 'lucide-react';
import ModalElegirHerramienta from './ModalElegirHerramienta';
import { enlaceAbsoluto } from '../utils/retoLink';

const AZUL = '#1565C0';
const nid = () => Math.random().toString(36).slice(2, 9);
const norm = (s) => (s || '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

// ─── Alias públicos ───────────────────────────────────────────────────────────
// En la parte pública se muestra SIEMPRE el alias; el nombre real solo lo ve el
// organizador dentro de su hoja de puntuaciones.
const ALIAS_PALABRAS = [
    'Águila', 'Tigre', 'Cometa', 'Rayo', 'Halcón', 'Puma', 'Delfín', 'Lince',
    'Titán', 'Cóndor', 'Dragón', 'Orca', 'Búho', 'Lobo', 'Zorro', 'Pantera',
    'Meteoro', 'Trueno', 'Galaxia', 'Nova', 'Fénix', 'Kraken', 'Bisonte', 'Glaciar',
];
export const aliasAuto = (usados) => {
    const ocupados = new Set([...(usados || [])].map(a => norm(a)));
    for (let i = 0; i < 200; i++) {
        const cand = `${ALIAS_PALABRAS[Math.floor(Math.random() * ALIAS_PALABRAS.length)]} ${Math.floor(Math.random() * 90) + 10}`;
        if (!ocupados.has(norm(cand))) return cand;
    }
    return `Participante ${Math.floor(Math.random() * 9000) + 1000}`;
};
export const aliasDe = (p) => (p?.alias || '').trim() || 'Sin alias';

// Clave de 4 dígitos para los participantes que añade el organizador
const claveAuto = () => String(Math.floor(1000 + Math.random() * 9000));

// ─── Modal: añadir participantes (mis grupos / comunidad / manual) ─────────────
// Permite añadirlos uno a uno o crear un participante "de equipo": una sola fila
// en la clasificación formada por varios alumnos.
function ModalParticipantes({ usuario, comunidadId, comunidadNombre, onClose, onAdd }) {
    const [tab, setTab]         = useState(comunidadId ? 'comunidad' : 'grupos');
    const [grupos, setGrupos]   = useState([]);
    const [grupoSel, setGrupoSel] = useState('');
    const [comunidades, setComunidades] = useState([]);
    const [comSel, setComSel]   = useState(comunidadId || '');
    const [fuentes, setFuentes] = useState([]);     // cursos + grupos compartidos de la comunidad
    const [fuenteSel, setFuenteSel] = useState('');
    const [listado, setListado] = useState([]);
    const [sel, setSel]         = useState(new Set());
    const [manual, setManual]   = useState('');
    const [equipo, setEquipo]   = useState('');     // nombre del equipo (vacío = añadir uno a uno)
    const [cargando, setCargando] = useState(false);

    useEffect(() => {
        getDocs(query(collection(db, 'grupos_profesor'), where('profesorUid', '==', usuario.uid)))
            .then(s => setGrupos(s.docs.map(d => ({ id: d.id, ...d.data() })))).catch(() => {});
        getDocs(query(collection(db, 'comunidades'), where('miembros', 'array-contains', usuario.uid)))
            .then(s => setComunidades(s.docs.map(d => ({ id: d.id, ...d.data() })))).catch(() => {});
    }, [usuario.uid]);

    // Al elegir comunidad → cargar sus cursos y sus grupos compartidos
    useEffect(() => {
        setFuentes([]); setFuenteSel(''); setListado([]); setSel(new Set());
        if (!comSel) return;
        (async () => {
            const fs = [];
            try {
                const cs = await getDocs(collection(db, 'comunidades', comSel, 'cursos'));
                cs.docs.forEach(d => fs.push({ id: `curso:${d.id}`, nombre: d.data().nombre || 'Curso', tipo: 'curso' }));
            } catch (_) {}
            try {
                const gs = await getDocs(collection(db, 'comunidades', comSel, 'grupos_compartidos'));
                gs.docs.forEach(d => fs.push({ id: `grupo:${d.id}`, nombre: `${d.data().nombre || 'Grupo'} (compartido)`, tipo: 'grupo', alumnos: d.data().alumnos || [] }));
            } catch (_) {}
            setFuentes(fs);
        })();
    }, [comSel]);

    // Al elegir curso/grupo → cargar su listado
    useEffect(() => {
        setSel(new Set());
        if (!comSel || !fuenteSel) { setListado([]); return; }
        const f = fuentes.find(x => x.id === fuenteSel);
        if (f?.tipo === 'grupo') { setListado(f.alumnos.map(a => ({ id: a.id || nid(), nombre: a.nombre }))); return; }
        setCargando(true);
        getDoc(doc(db, 'comunidades', comSel, 'cursos', fuenteSel.replace('curso:', ''), 'privado', 'data'))
            .then(s => setListado(s.exists() ? (s.data().listado || []) : []))
            .catch(() => setListado([])).finally(() => setCargando(false));
    }, [comSel, fuenteSel]); // eslint-disable-line react-hooks/exhaustive-deps

    // Listado que se está mostrando (grupo propio o curso/grupo de la comunidad)
    const alumnosActuales = tab === 'grupos'
        ? ((grupos.find(g => g.id === grupoSel)?.alumnos || []).map(a => ({ id: a.id || nid(), nombre: a.nombre })))
        : listado;

    const toggle = (id) => setSel(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
    const todos  = () => setSel(new Set(alumnosActuales.map(a => a.id)));
    const ninguno = () => setSel(new Set());

    // Añade los alumnos marcados: uno a uno, o como un único participante de equipo
    const anadir = (alumnos) => {
        const nombres = alumnos.map(a => a.nombre).filter(Boolean);
        if (nombres.length === 0) return;
        if (equipo.trim()) onAdd([{ id: nid(), nombre: equipo.trim(), miembros: nombres }]);
        else onAdd(nombres.map(n => ({ id: nid(), nombre: n })));
    };
    const anadirMarcados = () => anadir(alumnosActuales.filter(a => sel.has(a.id)));
    const anadirTodos    = () => anadir(alumnosActuales);

    const tabBtn = (id, lbl) => (
        <button onClick={() => { setTab(id); setSel(new Set()); }} style={{ padding: '8px 14px', border: 'none', background: 'none', cursor: 'pointer', fontSize: '0.86rem', borderBottom: tab === id ? `3px solid ${AZUL}` : '3px solid transparent', color: tab === id ? AZUL : '#7f8c8d', fontWeight: tab === id ? 700 : 500 }}>{lbl}</button>
    );

    // Bloque común: lista con casillas + pie con las acciones
    const listaConAcciones = () => (
        <>
            <div style={{ maxHeight: 240, overflowY: 'auto', border: '1px solid #e0e4f0', borderRadius: 8, marginBottom: 8 }}>
                {alumnosActuales.map(a => (
                    <label key={a.id} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '6px 10px', borderBottom: '1px solid #f3f3f3', cursor: 'pointer', fontSize: '0.88rem' }}>
                        <input type="checkbox" checked={sel.has(a.id)} onChange={() => toggle(a.id)} /> {a.nombre}
                    </label>
                ))}
            </div>
            <div style={{ display: 'flex', gap: 10, marginBottom: 10, fontSize: '0.78rem' }}>
                <button onClick={todos} style={{ background: 'none', border: 'none', color: AZUL, cursor: 'pointer', fontWeight: 600, padding: 0 }}>Marcar todos</button>
                <button onClick={ninguno} style={{ background: 'none', border: 'none', color: '#95a5a6', cursor: 'pointer', padding: 0 }}>Ninguno</button>
                <span style={{ marginLeft: 'auto', color: '#95a5a6' }}>{sel.size} de {alumnosActuales.length}</span>
            </div>
            {pieEquipo()}
            <div style={s.btnRow}>
                <button onClick={anadirTodos} style={s.btnSec}>{equipo.trim() ? 'Equipo con todos' : 'Añadir todos'}</button>
                <button onClick={anadirMarcados} disabled={sel.size === 0} style={s.btnPrimary}>
                    <Plus size={14} /> {equipo.trim() ? `Crear equipo (${sel.size})` : `Añadir ${sel.size || ''} seleccionados`}
                </button>
            </div>
        </>
    );

    // Pie: convertir la selección en un solo participante (equipo)
    const pieEquipo = () => (
        <div style={{ background: '#f8f9fb', borderRadius: 10, padding: '10px 12px', marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <UsersRound size={15} color={AZUL} />
                <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#2c3e50' }}>Participante de equipo</span>
            </div>
            <input value={equipo} onChange={e => setEquipo(e.target.value)} placeholder="Nombre del equipo (dejar vacío = añadir uno a uno)"
                style={{ ...s.input, marginBottom: 4, fontSize: '0.84rem' }} />
            <div style={{ fontSize: '0.75rem', color: '#95a5a6' }}>
                Si escribes un nombre, los alumnos elegidos se añaden como <strong>un solo participante</strong> con una única puntuación.
            </div>
        </div>
    );

    return (
        <div style={s.overlay} onClick={onClose}>
            <div style={{ ...s.panel, maxWidth: 520 }} onClick={e => e.stopPropagation()}>
                <div style={s.header}><div style={s.hTitle}><UserPlus size={19} color={AZUL} /> Añadir participantes</div><button onClick={onClose} style={s.closeBtn}><X size={18} /></button></div>
                <div style={{ display: 'flex', gap: 4, borderBottom: '2px solid #e0e4f0', marginBottom: 14, flexWrap: 'wrap' }}>
                    {tabBtn('grupos', '👥 Mis grupos')}
                    {tabBtn('comunidad', comunidadId ? `🏫 ${comunidadNombre || 'Comunidad'}` : '🏫 Comunidad')}
                    {tabBtn('manual', '✏️ Manual')}
                </div>

                {tab === 'grupos' && (
                    grupos.length === 0 ? <div style={s.vacio}>No tienes grupos. Créalos en Informes → Grupos.</div> : (
                        <div>
                            <select value={grupoSel} onChange={e => { setGrupoSel(e.target.value); setSel(new Set()); }} style={s.input}>
                                <option value="">Elige un grupo…</option>
                                {grupos.map(g => <option key={g.id} value={g.id}>{g.nombre} ({g.alumnos?.length || 0})</option>)}
                            </select>
                            {grupoSel && (alumnosActuales.length === 0
                                ? <div style={s.vacio}>Ese grupo no tiene alumnos.</div>
                                : listaConAcciones())}
                        </div>
                    )
                )}

                {tab === 'comunidad' && (
                    <div>
                        {comunidadId ? (
                            <div style={{ fontSize: '0.8rem', color: '#7f8c8d', marginBottom: 10 }}>
                                Competición de <strong>{comunidadNombre || 'la comunidad'}</strong>: puedes usar los listados de sus grupos.
                            </div>
                        ) : (
                            <select value={comSel} onChange={e => setComSel(e.target.value)} style={s.input}>
                                <option value="">Elige una comunidad…</option>
                                {comunidades.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                            </select>
                        )}
                        {comSel && (
                            <select value={fuenteSel} onChange={e => setFuenteSel(e.target.value)} style={s.input}>
                                <option value="">Elige un grupo o curso…</option>
                                {fuentes.map(f => <option key={f.id} value={f.id}>{f.nombre}</option>)}
                            </select>
                        )}
                        {cargando ? <div style={s.loader}><RefreshCw size={20} style={{ animation: 'spin 1s linear infinite' }} /></div>
                            : fuenteSel && (alumnosActuales.length === 0
                                ? <div style={s.vacio}>Ese grupo no tiene listado (solo lo ven los profes miembros).</div>
                                : listaConAcciones())}
                    </div>
                )}

                {tab === 'manual' && (
                    <div>
                        <div style={{ fontSize: '0.82rem', color: '#7f8c8d', marginBottom: 8 }}>Escribe un nombre por línea.</div>
                        <textarea value={manual} onChange={e => setManual(e.target.value)} rows={5} placeholder={'Ana García\nLuis Pérez'} style={{ ...s.input, resize: 'vertical' }} />
                        {pieEquipo()}
                        <div style={s.btnRow}>
                            <button onClick={() => { const ns = manual.split(/\r?\n/).map(x => x.trim()).filter(Boolean); if (ns.length) anadir(ns.map(n => ({ id: nid(), nombre: n }))); }}
                                disabled={!manual.trim()} style={s.btnPrimary}>
                                <Plus size={14} /> {equipo.trim() ? 'Crear equipo' : 'Añadir'}
                            </button>
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
function ModalCategoria({ usuario, categoria, compId, onClose, onGuardar }) {
    const [c, setC] = useState(categoria || { id: nid(), titulo: '', descripcion: '', fotoUrl: '', videoUrl: '', recursoId: '', recursoTitulo: '' });
    const [modalRec, setModalRec] = useState(false);
    const [modalHerr, setModalHerr] = useState(false);
    const quitarHerramienta = () => setC(prev => ({ ...prev, herramientaId: '', herramientaTitulo: '', herramientaRuta: '', herramientaResumen: [], herramientaConfig: null }));
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

                <div style={s.label}>Herramienta configurada (opcional)</div>
                <div style={{ fontSize: '0.76rem', color: '#95a5a6', marginBottom: 8 }}>
                    Cálculo Mental y demás herramientas de Math World, con una configuración fija igual para todos los participantes.
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6, flexWrap: 'wrap' }}>
                    <button onClick={() => setModalHerr(true)} style={s.btnSec}><Wrench size={14} /> {c.herramientaId ? 'Cambiar configuración' : 'Añadir herramienta'}</button>
                    {c.herramientaId && (
                        <span style={{ fontSize: '0.82rem', color: '#2c3e50', display: 'flex', alignItems: 'center', gap: 6 }}>
                            {c.herramientaTitulo}
                            <a href={enlaceAbsoluto(c.herramientaRuta)} target="_blank" rel="noreferrer" style={{ color: AZUL }} title="Probar"><ExternalLink size={13} /></a>
                            <button onClick={quitarHerramienta} style={{ background: 'none', border: 'none', color: '#e74c3c', cursor: 'pointer' }}><X size={13} /></button>
                        </span>
                    )}
                </div>
                {c.herramientaId && (c.herramientaResumen || []).length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 12 }}>
                        {c.herramientaResumen.map((r, i) => <span key={i} style={{ ...s.chipLink, cursor: 'default', fontSize: '0.76rem', padding: '3px 10px' }}>{r}</span>)}
                    </div>
                )}
                <div style={s.btnRow}>
                    <button onClick={onClose} style={s.btnSec}>Cancelar</button>
                    <button onClick={() => { if (c.titulo.trim()) onGuardar({ ...c, titulo: c.titulo.trim() }); }} disabled={!c.titulo.trim()} style={s.btnPrimary}>Guardar</button>
                </div>
                {modalRec && <ModalRecurso usuario={usuario} onClose={() => setModalRec(false)} onElegir={(r) => { setC({ ...c, ...r }); setModalRec(false); }} />}
                {modalHerr && (
                    <ModalElegirHerramienta
                        tituloReto={c.titulo || 'Prueba de la competición'}
                        herramientaInicial={c.herramientaId || null}
                        compId={compId}
                        catId={c.id}
                        configInicial={c.herramientaConfig || null}
                        onClose={() => setModalHerr(false)}
                        onElegir={(h) => { setC(prev => ({ ...prev, ...h })); setModalHerr(false); }}
                    />
                )}
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
                {c.herramientaId && (
                    <div style={{ marginTop: 10 }}>
                        <a href={enlaceAbsoluto(c.herramientaRuta)} target="_blank" rel="noreferrer" style={s.chipLink}><Wrench size={14} /> {c.herramientaTitulo} <ExternalLink size={11} /></a>
                        {(c.herramientaResumen || []).length > 0 && (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 8 }}>
                                {c.herramientaResumen.map((r, i) => <span key={i} style={{ background: '#f4f6f8', color: '#7f8c8d', borderRadius: 20, padding: '3px 10px', fontSize: '0.76rem', fontWeight: 600 }}>{r}</span>)}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

// ─── Editor de una competición (hoja de cálculo) ──────────────────────────────
export function CompeticionEditor({ usuario, compId, onBack }) {
    const [comp, setComp]   = useState(null);
    const [parts, setParts] = useState([]);
    const [addPart, setAddPart] = useState(false);
    const [catEdit, setCatEdit] = useState(null);   // categoria a editar (o {} nueva) o null
    const [catVer, setCatVer]   = useState(null);
    const [ordenar, setOrdenar] = useState(false);
    const [copiado, setCopiado] = useState(false);
    const [copiadoIns, setCopiadoIns] = useState(false);
    const [claves, setClaves] = useState({});       // pid → clave (solo las ve el organizador)
    const [verClaves, setVerClaves] = useState(false);
    const [resultados, setResultados] = useState([]); // envíos de los alumnos desde las pruebas
    const ref = doc(db, 'competiciones', compId);

    useEffect(() => onSnapshot(ref, sn => setComp(sn.exists() ? { id: sn.id, ...sn.data() } : null), () => {}), [compId]);
    useEffect(() => onSnapshot(collection(db, 'competiciones', compId, 'participantes'), sn => {
        const d = sn.docs.map(x => ({ id: x.id, ...x.data() }));
        d.sort((a, b) => (a.fecha?.seconds || 0) - (b.fecha?.seconds || 0));
        setParts(d);
    }, () => {}), [compId]);
    useEffect(() => onSnapshot(collection(db, 'competiciones', compId, 'claves'), sn => {
        const m = {}; sn.docs.forEach(d => { m[d.id] = d.data().clave || ''; });
        setClaves(m);
    }, () => {}), [compId]);
    useEffect(() => onSnapshot(collection(db, 'competiciones', compId, 'resultados'), sn => {
        const d = sn.docs.map(x => ({ id: x.id, ...x.data() }));
        d.sort((a, b) => (b.fecha?.seconds || 0) - (a.fecha?.seconds || 0));
        setResultados(d);
    }, () => {}), [compId]);

    // Los resultados que llegan de las pruebas se vuelcan en su casilla (se queda
    // la mejor marca) y se marcan como aplicados para no repetirse.
    useEffect(() => {
        if (!comp) return;
        const pendientesAplicar = resultados.filter(r => !r.aplicado && r.participanteId && r.catId);
        if (pendientesAplicar.length === 0) return;
        const actuales = { ...(comp.puntos || {}) };
        const cambios = {};
        pendientesAplicar.forEach(r => {
            const key = `${r.participanteId}_${r.catId}`;
            const previo = Number(cambios[`puntos.${key}`] ?? actuales[key] ?? 0);
            if ((Number(r.puntos) || 0) > previo) cambios[`puntos.${key}`] = Number(r.puntos) || 0;
        });
        (async () => {
            try {
                if (Object.keys(cambios).length > 0) await updateDoc(ref, cambios);
                await Promise.all(pendientesAplicar.map(r => updateDoc(doc(db, 'competiciones', compId, 'resultados', r.id), { aplicado: true })));
            } catch (_) {}
        })();
    }, [resultados, comp]); // eslint-disable-line react-hooks/exhaustive-deps

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
        const usados = new Set(parts.map(p => p.alias).filter(Boolean));
        try {
            await Promise.all(nuevos.map(async (nv) => {
                const alias = (nv.alias || '').trim() || aliasAuto(usados);
                usados.add(alias);
                const r = await addDoc(collection(db, 'competiciones', compId, 'participantes'), { nombre: nv.nombre, alias, miembros: nv.miembros || [], estado: 'aceptada', origen: 'creador', fecha: serverTimestamp() });
                // Clave para que pueda enviar sus resultados desde las pruebas
                await setDoc(doc(db, 'competiciones', compId, 'claves', r.id), { clave: claveAuto(), alias, fecha: serverTimestamp() });
            }));
        } catch (e) { alert('Error: ' + e.message); }
        setAddPart(false);
    };
    const setAlias = (id, alias) => updateDoc(doc(db, 'competiciones', compId, 'participantes', id), { alias: (alias || '').trim() }).catch(() => {});
    const aliasSugerido = () => aliasAuto(new Set(parts.map(p => p.alias).filter(Boolean)));
    const setClave = (id, clave) => {
        const v = (clave || '').trim();
        if (v.length < 4 || v.length > 8) { alert('La contraseña debe tener entre 4 y 8 caracteres.'); return; }
        setDoc(doc(db, 'competiciones', compId, 'claves', id), { clave: v, alias: parts.find(p => p.id === id)?.alias || '', fecha: serverTimestamp() })
            .catch(e => alert('Error: ' + e.message));
    };
    const delParticipante = async (id) => {
        const p2 = {}; Object.keys(puntos).forEach(k => { if (!k.startsWith(id + '_')) p2[k] = puntos[k]; });
        try {
            await deleteDoc(doc(db, 'competiciones', compId, 'participantes', id));
            await deleteDoc(doc(db, 'competiciones', compId, 'claves', id)).catch(() => {});
            await updateDoc(ref, { puntos: p2 });
        }
        catch (e) { alert('Error: ' + e.message); }
    };
    const aprobar = (id) => {
        const p = parts.find(x => x.id === id);
        const campos = { estado: 'aceptada' };
        if (!(p?.alias || '').trim()) campos.alias = aliasSugerido();
        updateDoc(doc(db, 'competiciones', compId, 'participantes', id), campos).catch(() => {});
        // Si se inscribió sin clave (alta antigua), se le genera una
        if (!claves[id]) setDoc(doc(db, 'competiciones', compId, 'claves', id), { clave: claveAuto(), alias: campos.alias || p?.alias || '', fecha: serverTimestamp() }).catch(() => {});
    };
    const rechazar = (id) => {
        deleteDoc(doc(db, 'competiciones', compId, 'participantes', id)).catch(() => {});
        deleteDoc(doc(db, 'competiciones', compId, 'claves', id)).catch(() => {});
    };
    const inscripcionUrl = publicUrl + '?inscribir=1';
    const copiarLinkInscripcion = async () => {
        try { await navigator.clipboard.writeText(inscripcionUrl); } catch { window.prompt('Enlace de inscripción:', inscripcionUrl); }
        setCopiadoIns(true); setTimeout(() => setCopiadoIns(false), 2000);
    };
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

                {/* Visibilidad de la inscripción en la página pública */}
                {(comp.inscripcion || 'creador') !== 'creador' && (
                    <div style={{ width: '100%', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', borderTop: '1px solid #e6e9f0', paddingTop: 8, marginTop: 2 }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: '0.82rem', color: '#2c3e50', cursor: 'pointer', fontWeight: 600 }}>
                            <input type="checkbox" checked={comp.mostrarInscripcion !== false}
                                onChange={e => guardar({ mostrarInscripcion: e.target.checked })} />
                            Mostrar el botón de inscripción en la página pública
                        </label>
                        <span style={{ fontSize: '0.76rem', color: '#95a5a6', flex: 1, minWidth: 180 }}>
                            {comp.mostrarInscripcion !== false
                                ? 'Cualquiera que abra la página puede apuntarse.'
                                : 'La página solo muestra resultados; para apuntarse hace falta el enlace de inscripción.'}
                        </span>
                        <button onClick={copiarLinkInscripcion} style={s.btnSec}>{copiadoIns ? '✅ Copiado' : '🔗 Enlace de inscripción'}</button>
                    </div>
                )}
            </div>

            {/* Estado + comunidad */}
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12, padding: '10px 12px', background: '#f8f9fb', borderRadius: 10 }}>
                <span style={{ fontSize: '0.82rem', color: '#7f8c8d', fontWeight: 600 }}>Estado:</span>
                {[[true, '🟢 Abierta'], [false, '⚪ Cerrada']].map(([val, lbl]) => {
                    const activo = (comp.abierta !== false) === val;
                    return <button key={String(val)} onClick={() => guardar({ abierta: val })} style={{ padding: '5px 12px', borderRadius: 20, border: `1.5px solid ${activo ? AZUL : '#e0e4f0'}`, background: activo ? AZUL : 'white', color: activo ? 'white' : '#555', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 700 }}>{lbl}</button>;
                })}
                <span style={{ fontSize: '0.78rem', color: '#95a5a6' }}>
                    {comp.comunidadId
                        ? (comp.abierta !== false
                            ? <>Visible en la página pública de <strong>{comp.comunidadNombre || 'la comunidad'}</strong> con los alias de los participantes.</>
                            : <>No aparece en la página pública de la comunidad.</>)
                        : 'Competición sin comunidad: solo accesible por su enlace público.'}
                </span>
            </div>

            {pendientes.length > 0 && (
                <div style={{ marginBottom: 14 }}>
                    <h3 style={{ color: '#c15600', fontSize: '0.95rem', margin: '0 0 8px' }}>Inscripciones pendientes ({pendientes.length})</h3>
                    {pendientes.map(p => (
                        <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', border: '1px solid #ffe0c2', background: '#fff8f0', borderRadius: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                            <div style={{ flex: 1, minWidth: 140 }}><strong>{p.nombre}</strong>{p.alias ? <span style={{ color: '#7f8c8d', fontSize: '0.8rem' }}> · alias: {p.alias}</span> : ''}{p.email ? <span style={{ color: '#95a5a6', fontSize: '0.8rem' }}> · {p.email}</span> : ''}{p.extra ? <div style={{ fontSize: '0.78rem', color: '#7f8c8d' }}>{p.extra}</div> : null}</div>
                            <button onClick={() => aprobar(p.id)} style={{ ...s.btnMini, color: '#27ae60', borderColor: '#b6e2c1' }}>Aceptar</button>
                            <button onClick={() => rechazar(p.id)} style={{ ...s.btnMini, color: '#e74c3c', borderColor: '#f3c9c4' }}>Rechazar</button>
                        </div>
                    ))}
                </div>
            )}

            {resultados.length > 0 && (
                <details style={{ marginBottom: 14, background: '#f8f9fb', borderRadius: 10, padding: '10px 12px' }}>
                    <summary style={{ cursor: 'pointer', fontWeight: 700, color: '#2c3e50', fontSize: '0.88rem' }}>
                        📥 Resultados recibidos de las pruebas ({resultados.length})
                    </summary>
                    <div style={{ fontSize: '0.76rem', color: '#95a5a6', margin: '8px 0 10px' }}>
                        Llegan cuando un participante termina el juego de una prueba y lo envía con su alias y contraseña.
                        Se vuelcan solos en la casilla correspondiente (se queda la mejor marca).
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 5, maxHeight: 220, overflowY: 'auto' }}>
                        {resultados.slice(0, 50).map(r => {
                            const cat = categorias.find(c => c.id === r.catId);
                            return (
                                <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.82rem', background: 'white', borderRadius: 8, padding: '6px 10px', flexWrap: 'wrap' }}>
                                    <span style={{ fontWeight: 700, color: '#2c3e50' }}>{r.alias || '—'}</span>
                                    <span style={{ color: '#7f8c8d' }}>{cat ? cat.titulo : 'prueba eliminada'}</span>
                                    {r.juego && <span style={{ color: '#bdc3c7' }}>· {r.juego}</span>}
                                    <span style={{ marginLeft: 'auto', fontWeight: 800, color: AZUL }}>{r.puntos} pts</span>
                                    <button onClick={() => deleteDoc(doc(db, 'competiciones', compId, 'resultados', r.id)).catch(() => {})}
                                        title="Borrar este envío" style={{ background: 'none', border: 'none', color: '#e74c3c', cursor: 'pointer', padding: 2 }}><Trash2 size={13} /></button>
                                </div>
                            );
                        })}
                    </div>
                </details>
            )}

            {aceptados.length === 0 && categorias.length === 0 ? (
                <div style={s.vacio}>Añade participantes y crea pruebas/categorías para empezar.</div>
            ) : (
                <div style={{ overflowX: 'auto', border: '1px solid #e0e4f0', borderRadius: 10 }}>
                    <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: '0.86rem' }}>
                        <thead>
                            <tr style={{ background: '#f4f6f8' }}>
                                <th style={{ ...s.th, position: 'sticky', left: 0, background: '#f4f6f8', minWidth: 150 }}>Participante</th>
                                <th style={{ ...s.th, minWidth: 130 }}>Alias público</th>
                                <th style={{ ...s.th, minWidth: 110 }}>
                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                                        Contraseña
                                        <button onClick={() => setVerClaves(v => !v)} title={verClaves ? 'Ocultar contraseñas' : 'Ver contraseñas'}
                                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: AZUL, padding: 0 }}>
                                            {verClaves ? <EyeOff size={13} /> : <Eye size={13} />}
                                        </button>
                                    </span>
                                </th>
                                {categorias.map(c => (
                                    <th key={c.id} style={{ ...s.th, minWidth: 120, textAlign: 'center' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'center', flexWrap: 'wrap' }}>
                                            <button onClick={() => setCatVer(c)} title="Ver" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#2c3e50', fontWeight: 700, fontSize: '0.82rem', padding: 0 }}>{c.titulo}</button>
                                            {(c.fotoUrl || c.videoUrl || c.recursoId || c.herramientaId) && <Eye size={12} color="#95a5a6" />}
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
                                        {(p.miembros || []).length > 0 && (
                                            <span title={p.miembros.join(', ')} style={{ marginLeft: 6, fontWeight: 600, fontSize: '0.72rem', color: AZUL, background: '#eef4fb', borderRadius: 20, padding: '1px 7px', whiteSpace: 'nowrap' }}>
                                                <UsersRound size={10} style={{ verticalAlign: -1 }} /> {p.miembros.length}
                                            </span>
                                        )}
                                    </td>
                                    <td style={s.td}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                            <input defaultValue={p.alias || ''} key={p.alias || ''} onBlur={e => { if (e.target.value !== (p.alias || '')) setAlias(p.id, e.target.value); }}
                                                placeholder="alias…" title="Nombre visible en la parte pública"
                                                style={{ width: 110, padding: '4px 6px', borderRadius: 6, border: '1.5px solid #e0e4f0', fontFamily: 'inherit', fontSize: '0.82rem', outline: 'none' }} />
                                            <button onClick={() => setAlias(p.id, aliasSugerido())} title="Generar alias" style={{ background: 'none', border: 'none', cursor: 'pointer', color: AZUL, padding: 0 }}><RefreshCw size={13} /></button>
                                        </div>
                                    </td>
                                    <td style={s.td}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                            <input type={verClaves ? 'text' : 'password'} defaultValue={claves[p.id] || ''} key={claves[p.id] || ''} maxLength={8}
                                                onBlur={e => { if (e.target.value !== (claves[p.id] || '')) setClave(p.id, e.target.value); }}
                                                placeholder="4-8 car." title="Contraseña del participante para enviar sus resultados"
                                                style={{ width: 80, padding: '4px 6px', borderRadius: 6, border: '1.5px solid #e0e4f0', fontFamily: 'inherit', fontSize: '0.82rem', outline: 'none' }} />
                                            <button onClick={() => setClave(p.id, claveAuto())} title="Generar contraseña" style={{ background: 'none', border: 'none', cursor: 'pointer', color: AZUL, padding: 0 }}><RefreshCw size={13} /></button>
                                        </div>
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

            {addPart && <ModalParticipantes usuario={usuario} comunidadId={comp.comunidadId || null} comunidadNombre={comp.comunidadNombre || ""} onClose={() => setAddPart(false)} onAdd={addParticipantes} />}
            {catEdit && <ModalCategoria usuario={usuario} compId={compId} categoria={catEdit.id ? catEdit : null} onClose={() => setCatEdit(null)} onGuardar={upsertCategoria} />}
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
                categorias: [], puntos: {}, inscripcion: 'creador', abierta: true, fechaCreacion: serverTimestamp(),
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
                                <div style={{ fontSize: '0.75rem', color: '#95a5a6' }}>{c.abierta !== false ? '🟢 Abierta' : '⚪ Cerrada'} · {c.categorias?.length || 0} pruebas · inscripción {({ creador: 'manual', auto: 'automática', aprobacion: 'con aprobación' }[c.inscripcion] || 'manual')}{c.comunidadNombre ? ` · ${c.comunidadNombre}` : ''}</div>
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

// ─── Panel de competiciones dentro de una comunidad ───────────────────────────
// Cualquier miembro ve las competiciones de la comunidad y puede crear la suya.
// Las abiertas se muestran en la página pública de la comunidad (por alias).
export function CompeticionesComunidadPanel({ usuario, comunidad }) {
    const [comps, setComps] = useState([]);
    const [cargando, setCargando] = useState(true);
    const [abierta, setAbierta] = useState(null);
    const [nueva, setNueva] = useState('');
    const [creando, setCreando] = useState(false);
    const [confirmarBorrar, setConfirmarBorrar] = useState(null);
    const [aviso, setAviso] = useState('');

    const cargar = useCallback(async () => {
        setCargando(true); setAviso('');
        try {
            const snap = await getDocs(query(collection(db, 'competiciones'), where('comunidadId', '==', comunidad.id)));
            const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            docs.sort((a, b) => (b.fechaCreacion?.seconds || 0) - (a.fechaCreacion?.seconds || 0));
            setComps(docs);
        } catch (e) { setAviso('No se pudieron cargar las competiciones: ' + e.message); }
        setCargando(false);
    }, [comunidad.id]);
    useEffect(() => { cargar(); }, [cargar]);

    const crear = async () => {
        const n = nueva.trim(); if (!n) return;
        setCreando(true); setAviso('');
        try {
            const r = await addDoc(collection(db, 'competiciones'), {
                nombre: n, profesorUid: usuario.uid, creadorNombre: usuario.displayName || 'Profesor/a',
                comunidadId: comunidad.id, comunidadNombre: comunidad.nombre || '',
                categorias: [], puntos: {}, inscripcion: 'creador', abierta: true, fechaCreacion: serverTimestamp(),
            });
            setNueva(''); setAbierta(r.id);
        } catch (e) { setAviso('No se pudo crear: ' + e.message); }
        setCreando(false);
    };
    const borrar = async (id) => {
        try { await deleteDoc(doc(db, 'competiciones', id)); setComps(cs => cs.filter(c => c.id !== id)); }
        catch (e) { setAviso('Error: ' + e.message); }
        setConfirmarBorrar(null);
    };

    if (abierta) return <CompeticionEditor usuario={usuario} compId={abierta} onBack={() => { setAbierta(null); cargar(); }} />;

    return (
        <div>
            <div style={{ fontSize: '0.8rem', color: '#7f8c8d', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Trophy size={14} color="#f39c12" /> Las competiciones <strong>abiertas</strong> aparecen en la página pública de la comunidad; en ella cada participante se muestra por su <strong>alias</strong>.
            </div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
                <input value={nueva} onChange={e => setNueva(e.target.value)} onKeyDown={e => e.key === 'Enter' && crear()} placeholder="Nombre de la competición (ej: Olimpiadas del centro)" style={{ ...s.input, marginBottom: 0, flex: 1, minWidth: 200 }} />
                <button onClick={crear} disabled={creando || !nueva.trim()} style={s.btnPrimary}><Plus size={16} /> Crear</button>
            </div>
            {aviso && <div style={{ color: '#e74c3c', fontSize: '0.84rem', marginBottom: 10 }}>{aviso}</div>}

            {cargando ? <div style={s.loader}><RefreshCw size={24} style={{ animation: 'spin 1s linear infinite' }} /></div>
                : comps.length === 0 ? <div style={s.vacio}>Todavía no hay competiciones en esta comunidad.</div>
                : (
                    <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))' }}>
                        {comps.map(c => {
                            const mia = c.profesorUid === usuario.uid;
                            return (
                                <div key={c.id} style={s.card}>
                                    <div style={{ fontWeight: 700, color: '#2c3e50', display: 'flex', alignItems: 'center', gap: 6 }}><Trophy size={17} color="#f39c12" /> {c.nombre}</div>
                                    <div style={{ fontSize: '0.75rem', color: '#95a5a6' }}>
                                        {c.abierta !== false ? '🟢 Abierta' : '⚪ Cerrada'} · {c.categorias?.length || 0} pruebas · por {mia ? 'ti' : (c.creadorNombre || 'otro profe')}
                                    </div>
                                    <div style={{ display: 'flex', gap: 6, marginTop: 'auto', flexWrap: 'wrap' }}>
                                        {mia
                                            ? <button onClick={() => setAbierta(c.id)} style={{ ...s.btnPrimary, flex: 1, justifyContent: 'center' }}><Pencil size={15} /> Editar</button>
                                            : <a href={`/competicion/${c.id}`} target="_blank" rel="noreferrer" style={{ ...s.btnPrimary, flex: 1, justifyContent: 'center', textDecoration: 'none' }}><Eye size={15} /> Ver</a>}
                                        {mia && (confirmarBorrar === c.id ? (
                                            <>
                                                <button onClick={() => borrar(c.id)} style={{ ...s.btnMini, color: 'white', background: '#e74c3c', borderColor: '#e74c3c' }}>Sí</button>
                                                <button onClick={() => setConfirmarBorrar(null)} style={s.btnMini}>No</button>
                                            </>
                                        ) : <button onClick={() => setConfirmarBorrar(c.id)} style={{ ...s.btnMini, color: '#e74c3c', borderColor: '#f3c9c4' }}><Trash2 size={13} /></button>)}
                                    </div>
                                </div>
                            );
                        })}
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
