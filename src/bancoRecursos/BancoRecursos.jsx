// ─────────────────────────────────────────────────────────────────────────────
//  Banco de recursos del profesorado
//  Cualquier profe registrado enlaza materiales (Drive, webs, vídeos…) con
//  propietario, materia, cursos, tipo y descripción. Se ven los de todos o
//  solo los propios, agrupados por materia, tipo o curso.
//  Colección Firestore: banco_recursos. Comprobación de enlaces: /api/comprobar-enlace
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useMemo, useState, lazy, Suspense } from 'react';
import { db, auth } from '../firebase';
import {
    collection, query, where, orderBy, limit, getDocs, addDoc, updateDoc, deleteDoc, doc, serverTimestamp,
    increment, arrayUnion, arrayRemove, getDoc,
} from 'firebase/firestore';
import {
    MATERIAS_BANCO, ETAPAS_BANCO, TIPOS_BANCO, etiquetaCurso, buscar,
    normalizarUrl, dominioDe, servicioDeUrl, enlaceCopiaGoogle, urlBanco, urlBancoNuevo,
} from './constantes';

const FichasPikt = lazy(() => import('./FichasPikt'));

const COL = 'banco_recursos';
const ADMIN_EMAIL = 'goladen@gmail.com';

// Puntuación de «más útiles»: un «me gusta» pesa como 5 aperturas
const utilidad = (r) => (r.likesUids || []).length * 5 + (r.aperturas || 0);

const ms = (f) =>(f?.toMillis ? f.toMillis() : typeof f === 'number' ? f : 0);

const ESTADOS = {
    ok:      { color: '#2e7d32', fondo: '#e8f5e9', icono: '✅', texto: 'Enlace comprobado' },
    privado: { color: '#c62828', fondo: '#ffebee', icono: '🔒', texto: 'Privado: no se puede abrir' },
    roto:    { color: '#c62828', fondo: '#ffebee', icono: '❌', texto: 'Enlace roto' },
    dudoso:  { color: '#ef6c00', fondo: '#fff3e0', icono: '⚠️', texto: 'Sin confirmar' },
};

/** Llama a la función del servidor. Si no responde, devuelve un estado «dudoso». */
async function comprobarEnlace(url) {
    try {
        const token = await auth.currentUser?.getIdToken();
        const r = await fetch('/api/comprobar-enlace', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
            body: JSON.stringify({ url }),
        });
        const d = await r.json().catch(() => null);
        if (!r.ok || !d?.estado) throw new Error(d?.error || `Error ${r.status}`);
        return d;
    } catch (e) {
        return { estado: 'dudoso', status: 0, mensaje: `No se ha podido comprobar automáticamente (${e.message}). Ábrelo tú en una ventana de incógnito para asegurarte.` };
    }
}

// ─── Guías para compartir ───────────────────────────────────────────────────
function GuiaCompartir({ servicio, abierta, onToggle, resaltar }) {
    if (!servicio) return null;
    const esMs = servicio === 'onedrive';
    return (
        <div style={{ border: `2px solid ${resaltar ? '#e53935' : '#90caf9'}`, background: resaltar ? '#fff5f5' : '#f3f8ff', borderRadius: 12, padding: '10px 14px', marginTop: 10 }}>
            <div onClick={onToggle} style={{ cursor: 'pointer', fontWeight: 800, color: resaltar ? '#c62828' : '#1565c0', display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                <span>{esMs ? '☁️ Cómo compartir desde OneDrive' : '📂 Cómo tiene que estar compartido un archivo de Google Drive'}</span>
                <span>{abierta ? '▲' : '▼'}</span>
            </div>
            {abierta && (esMs ? (
                <ol style={{ margin: '8px 0 0', paddingLeft: 20, fontSize: '0.9rem', lineHeight: 1.55, color: '#333' }}>
                    <li>En OneDrive, clic derecho sobre el archivo → <b>Compartir</b>.</li>
                    <li>Pulsa el engranaje / «Configuración del vínculo» y elige <b>«Cualquier persona»</b>.</li>
                    <li>Deja marcado <b>«Puede ver»</b> (no editar) y desmarca «Bloquear descarga» si quieres que lo descarguen.</li>
                    <li>Pulsa <b>Copiar vínculo</b> y pégalo aquí.</li>
                    <li style={{ color: '#7b1fa2' }}>Las cuentas educativas de algunas consejerías no permiten compartir fuera del centro: en ese caso súbelo a una cuenta personal o a otra plataforma.</li>
                </ol>
            ) : (
                <ol style={{ margin: '8px 0 0', paddingLeft: 20, fontSize: '0.9rem', lineHeight: 1.55, color: '#333' }}>
                    <li>Abre el archivo (o la carpeta) en Google Drive y pulsa <b>Compartir</b>.</li>
                    <li>En <b>«Acceso general»</b> cambia <b>«Restringido»</b> por <b>«Cualquier persona con el enlace»</b>.</li>
                    <li>A la derecha deja el rol en <b>«Lector»</b> (así nadie puede estropear tu original).</li>
                    <li>Pulsa <b>Copiar enlace</b> → <b>Hecho</b>, y pega aquí ese enlace.</li>
                    <li style={{ color: '#7b1fa2' }}>Si usas una cuenta del centro (@educa…, @…edu.es) y solo aparece «Cualquier persona de [tu centro]», el administrador no deja compartir fuera: no funcionará para otros profes. Usa una cuenta personal de Gmail.</li>
                    <li>Si compartes una <b>carpeta</b>, los archivos de dentro heredan el permiso.</li>
                </ol>
            ))}
        </div>
    );
}

// ─── Formulario alta / edición ──────────────────────────────────────────────
function FormRecurso({ usuario, inicial, onCerrar, onGuardado }) {
    const editando = !!inicial?.id;
    const [url, setUrl] = useState(inicial?.url || '');
    const [titulo, setTitulo] = useState(inicial?.titulo || '');
    const [descripcion, setDescripcion] = useState(inicial?.descripcion || '');
    const [materia, setMateria] = useState(inicial?.materia || '');
    const [cursos, setCursos] = useState(inicial?.cursos || []);
    const [tipo, setTipo] = useState(inicial?.tipo || '');
    const [etiquetas, setEtiquetas] = useState((inicial?.etiquetas || []).join(', '));
    const [visibilidad, setVisibilidad] = useState(inicial?.visibilidad === 'profesores' ? 'profesores' : 'publico');
    const [comprob, setComprob] = useState(inicial?.comprobacion && inicial?.url ? { ...inicial.comprobacion, _url: inicial.url } : null);
    const [comprobando, setComprobando] = useState(false);
    const [confirmaManual, setConfirmaManual] = useState(!!inicial?.comprobacion?.manual);
    const [guiaAbierta, setGuiaAbierta] = useState(false);
    const [guardando, setGuardando] = useState(false);
    const [error, setError] = useState('');

    const urlN = normalizarUrl(url);
    const servicio = servicioDeUrl(urlN);
    const comprobVigente = comprob && comprob._url === urlN ? comprob : null;
    const copia = enlaceCopiaGoogle(urlN);

    const comprobar = async () => {
        if (!urlN) return;
        setComprobando(true); setError('');
        const r = await comprobarEnlace(urlN);
        setComprob({ ...r, _url: urlN });
        setConfirmaManual(false);
        if (r.estado === 'privado') setGuiaAbierta(true);
        if (r.estado === 'ok' && r.titulo && !titulo.trim()) setTitulo(r.titulo);
        setComprobando(false);
    };

    const toggleCurso = (id) => setCursos(c => c.includes(id) ? c.filter(x => x !== id) : [...c, id]);
    const toggleEtapa = (et) => {
        const ids = et.cursos.map((_, i) => `${et.id}-${i}`);
        const todos = ids.every(id => cursos.includes(id));
        setCursos(c => todos ? c.filter(x => !ids.includes(x)) : [...new Set([...c, ...ids])]);
    };

    const puedeGuardar = comprobVigente && (comprobVigente.estado === 'ok' || (comprobVigente.estado === 'dudoso' && confirmaManual));

    const guardar = async () => {
        setError('');
        if (!urlN) return setError('Pega el enlace del recurso.');
        if (!titulo.trim()) return setError('Ponle un título.');
        if (descripcion.trim().length < 10) return setError('Describe qué contiene el recurso (al menos una frase).');
        if (!materia) return setError('Elige la materia.');
        if (!cursos.length) return setError('Marca al menos un curso.');
        if (!tipo) return setError('Elige el tipo de recurso.');
        if (!comprobVigente) return setError('Comprueba el enlace antes de guardar.');
        if (!puedeGuardar) return setError(comprobVigente.estado === 'dudoso'
            ? 'Confirma que has abierto el enlace y funciona.'
            : 'El enlace no se puede abrir: corrígelo antes de guardar.');

        setGuardando(true);
        try {
            // ¿Ya está en el banco?
            // (si quien sube no es profe, la consulta puede no estar permitida: entonces no se avisa)
            const dup = await getDocs(query(collection(db, COL), where('url', '==', urlN), limit(3))).catch(() => ({ docs: [] }));
            const otro = dup.docs.find(d => d.id !== inicial?.id);
            if (otro && !confirm(`Este enlace ya está en el banco («${otro.data().titulo}», de ${otro.data().propietarioNombre || 'otro profe'}). ¿Añadirlo igualmente?`)) {
                setGuardando(false); return;
            }
            const datos = {
                url: urlN,
                dominio: dominioDe(urlN),
                servicio: servicio || null,
                titulo: titulo.trim().slice(0, 150),
                descripcion: descripcion.trim().slice(0, 2000),
                materia,
                cursos,
                etapas: [...new Set(cursos.map(c => c.split('-')[0]))],
                tipo,
                etiquetas: etiquetas.split(',').map(s => s.trim().toLowerCase()).filter(Boolean).slice(0, 15),
                visibilidad,
                comprobacion: {
                    estado: comprobVigente.estado,
                    status: comprobVigente.status || 0,
                    fecha: Date.now(),
                    manual: comprobVigente.estado !== 'ok',
                },
                actualizado: serverTimestamp(),
            };
            if (editando) {
                await updateDoc(doc(db, COL, inicial.id), datos);
                onGuardado({ ...inicial, ...datos, actualizado: Date.now() });
            } else {
                const nuevo = {
                    ...datos,
                    propietarioUid: usuario.uid,
                    propietarioNombre: usuario.displayName || (usuario.email || '').split('@')[0] || 'Profesor/a',
                    fecha: serverTimestamp(),
                };
                const ref = await addDoc(collection(db, COL), nuevo);
                onGuardado({ ...nuevo, id: ref.id, fecha: Date.now(), actualizado: Date.now() });
            }
        } catch (e) {
            setError(e.code === 'permission-denied' ? 'No tienes permiso para guardar (¿has iniciado sesión con tu cuenta?).' : e.message);
            setGuardando(false);
        }
    };

    const est = comprobVigente ? ESTADOS[comprobVigente.estado] : null;

    return (
        <div style={S.overlay} onClick={onCerrar}>
            <div style={S.modal} onClick={e => e.stopPropagation()}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <h2 style={{ margin: 0, color: '#1a237e', fontSize: '1.3rem' }}>{editando ? '✏️ Editar recurso' : '➕ Añadir recurso al banco'}</h2>
                    <button onClick={onCerrar} style={S.cerrar} aria-label="Cerrar">✕</button>
                </div>

                {/* 1. Enlace */}
                <label style={S.label}>Enlace del recurso *</label>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <input value={url} onChange={e => setUrl(e.target.value)} onBlur={() => { if (urlN && !comprobVigente) comprobar(); }}
                        placeholder="https://drive.google.com/… o cualquier web" style={{ ...S.input, flex: '1 1 240px' }} />
                    <button onClick={comprobar} disabled={!urlN || comprobando} style={{ ...S.btn, background: '#1565c0' }}>
                        {comprobando ? 'Comprobando…' : '🔍 Comprobar'}
                    </button>
                </div>

                {est && (
                    <div style={{ marginTop: 8, padding: '8px 12px', borderRadius: 10, background: est.fondo, color: est.color, fontSize: '0.9rem' }}>
                        <b>{est.icono} {est.texto}.</b> {comprobVigente.mensaje}
                        {urlN && <> <a href={urlN} target="_blank" rel="noopener noreferrer" style={{ color: est.color, fontWeight: 700 }}>Abrir ↗</a></>}
                        {comprobVigente.estado === 'dudoso' && (
                            <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginTop: 6, color: '#5d4037', cursor: 'pointer' }}>
                                <input type="checkbox" checked={confirmaManual} onChange={e => setConfirmaManual(e.target.checked)} style={{ marginTop: 3 }} />
                                <span>Lo he abierto en una ventana de incógnito (sin mi sesión) y funciona.</span>
                            </label>
                        )}
                        {(comprobVigente.estado === 'privado' || comprobVigente.estado === 'roto') && (
                            <div style={{ marginTop: 4 }}>Corrígelo y pulsa <b>Comprobar</b> otra vez.</div>
                        )}
                    </div>
                )}

                <GuiaCompartir servicio={servicio} abierta={guiaAbierta} onToggle={() => setGuiaAbierta(v => !v)}
                    resaltar={comprobVigente?.estado === 'privado'} />

                {copia && urlN !== copia && (
                    <div style={{ fontSize: '0.85rem', color: '#555', marginTop: 8 }}>
                        💡 ¿Quieres que cada profe obtenga <b>su propia copia</b> editable?{' '}
                        <button onClick={() => setUrl(copia)} style={S.linkBtn}>Usar enlace de copia (…/copy)</button>
                    </div>
                )}

                {/* 2. Datos */}
                <label style={S.label}>Título *</label>
                <input value={titulo} onChange={e => setTitulo(e.target.value)} maxLength={150} placeholder="Ej.: Fracciones equivalentes con regletas" style={S.input} />

                <label style={S.label}>Descripción: ¿qué contiene? *</label>
                <textarea value={descripcion} onChange={e => setDescripcion(e.target.value)} maxLength={2000} rows={3}
                    placeholder="Ej.: 12 diapositivas con teoría y 3 actividades finales; incluye solucionario." style={{ ...S.input, resize: 'vertical', fontFamily: 'inherit' }} />

                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                    <div style={{ flex: '1 1 200px' }}>
                        <label style={S.label}>Materia *</label>
                        <select value={materia} onChange={e => setMateria(e.target.value)} style={S.input}>
                            <option value="">— Elige —</option>
                            {MATERIAS_BANCO.map(m => <option key={m.id} value={m.id}>{m.emoji} {m.label}</option>)}
                        </select>
                    </div>
                    <div style={{ flex: '1 1 200px' }}>
                        <label style={S.label}>Tipo de recurso *</label>
                        <select value={tipo} onChange={e => setTipo(e.target.value)} style={S.input}>
                            <option value="">— Elige —</option>
                            {TIPOS_BANCO.map(t => <option key={t.id} value={t.id}>{t.emoji} {t.label}</option>)}
                        </select>
                    </div>
                </div>

                <label style={S.label}>Cursos * <span style={{ fontWeight: 400, color: '#777' }}>(pulsa la etapa para marcarla entera)</span></label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {ETAPAS_BANCO.map(et => (
                        <div key={et.id} style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                            <button onClick={() => toggleEtapa(et)} style={{ ...S.chip, minWidth: 96, fontWeight: 800, background: '#eceff1' }}>{et.label}</button>
                            {et.cursos.map((c, i) => {
                                const id = `${et.id}-${i}`, on = cursos.includes(id);
                                return <button key={id} onClick={() => toggleCurso(id)}
                                    style={{ ...S.chip, background: on ? '#3949ab' : 'white', color: on ? 'white' : '#333', borderColor: on ? '#3949ab' : '#cfd8dc' }}>{c}</button>;
                            })}
                        </div>
                    ))}
                </div>

                <label style={S.label}>Etiquetas <span style={{ fontWeight: 400, color: '#777' }}>(opcional, separadas por comas)</span></label>
                <input value={etiquetas} onChange={e => setEtiquetas(e.target.value)} placeholder="fracciones, cálculo, repaso" style={S.input} />

                <label style={S.label}>¿Quién puede verlo?</label>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {[
                        ['publico', '🌍 Público', 'Cualquiera, también sin cuenta (zona pública de las comunidades y /banco).'],
                        ['profesores', '👩‍🏫 Solo profesores', 'Solo lo ven quienes entran con cuenta de profesor.'],
                    ].map(([v, l, d]) => (
                        <button key={v} onClick={() => setVisibilidad(v)}
                            style={{ flex: '1 1 200px', textAlign: 'left', padding: '8px 12px', borderRadius: 10, cursor: 'pointer',
                                border: `2px solid ${visibilidad === v ? '#3949ab' : '#cfd8dc'}`, background: visibilidad === v ? '#e8eaf6' : 'white' }}>
                            <div style={{ fontWeight: 800, color: '#263238' }}>{l}</div>
                            <div style={{ fontSize: '0.78rem', color: '#607d8b' }}>{d}</div>
                        </button>
                    ))}
                </div>

                {error && <div style={{ marginTop: 12, color: '#c62828', fontWeight: 700 }}>{error}</div>}

                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 16, flexWrap: 'wrap' }}>
                    <button onClick={onCerrar} style={{ ...S.btn, background: '#90a4ae' }}>Cancelar</button>
                    <button onClick={guardar} disabled={guardando || comprobando}
                        style={{ ...S.btn, background: puedeGuardar ? '#2e7d32' : '#a5d6a7' }}>
                        {guardando ? 'Guardando…' : editando ? '💾 Guardar cambios' : '💾 Añadir al banco'}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─── Tarjeta ────────────────────────────────────────────────────────────────
function Tarjeta({ r, uid, esMio, esAdmin, puedeVotar, onEditar, onBorrar, onRecomprobado, onCambio }) {
    const m = buscar(MATERIAS_BANCO, r.materia);
    const t = buscar(TIPOS_BANCO, r.tipo);
    const est = ESTADOS[r.comprobacion?.estado] || ESTADOS.dudoso;
    const [comprobando, setComprobando] = useState(false);
    const [verMas, setVerMas] = useState(false);
    const [votando, setVotando] = useState(false);
    const larga = (r.descripcion || '').length > 160;
    const likes = (r.likesUids || []).length;
    const meGusta = (r.likesUids || []).includes(uid);

    // Contador de aperturas: no cuenta las del propietario ni repite en la misma sesión del navegador
    const contarApertura = () => {
        if (esMio || !puedeVotar) return;
        const clave = `banco_abierto_${r.id}`;
        try { if (sessionStorage.getItem(clave)) return; sessionStorage.setItem(clave, '1'); } catch { /* */ }
        onCambio(r.id, { aperturas: (r.aperturas || 0) + 1 });
        updateDoc(doc(db, COL, r.id), { aperturas: increment(1) }).catch(() => {});
    };

    const toggleLike = async () => {
        if (!puedeVotar || esMio || votando) return;
        setVotando(true);
        const nuevos = meGusta ? (r.likesUids || []).filter(x => x !== uid) : [...(r.likesUids || []), uid];
        onCambio(r.id, { likesUids: nuevos });
        try { await updateDoc(doc(db, COL, r.id), { likesUids: meGusta ? arrayRemove(uid) : arrayUnion(uid) }); }
        catch { onCambio(r.id, { likesUids: r.likesUids || [] }); }
        setVotando(false);
    };

    const recomprobar = async () => {
        setComprobando(true);
        const res = await comprobarEnlace(r.url);
        const comprobacion = { estado: res.estado, status: res.status || 0, fecha: Date.now(), manual: false };
        if (esMio) { try { await updateDoc(doc(db, COL, r.id), { comprobacion }); } catch { /* */ } }
        onRecomprobado(r.id, comprobacion, res.mensaje);
        setComprobando(false);
    };

    return (
        <div style={S.tarjeta}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <div style={{ fontSize: '1.9rem', lineHeight: 1 }} title={t?.label}>{t?.emoji || '🔗'}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 800, color: '#1a237e', wordBreak: 'break-word' }}>{r.titulo}</div>
                    <div style={{ fontSize: '0.78rem', color: '#78909c' }}>{t?.label} · {r.dominio}</div>
                </div>
            </div>
            <div style={{ fontSize: '0.88rem', color: '#37474f', margin: '8px 0', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                {larga && !verMas ? `${r.descripcion.slice(0, 160)}… ` : r.descripcion}
                {larga && <button onClick={() => setVerMas(v => !v)} style={S.linkBtn}>{verMas ? 'ver menos' : 'ver más'}</button>}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
                {r.visibilidad === 'profesores' && <span style={{ ...S.tag, background: '#fce4ec', color: '#ad1457', fontWeight: 700 }} title="Solo lo ven las cuentas de profesor">👩‍🏫 Solo profesores</span>}
                {m && <span style={{ ...S.tag, background: '#e8eaf6', color: '#283593' }}>{m.emoji} {m.label}</span>}
                {(r.cursos || []).slice(0, 6).map(c => <span key={c} style={S.tag}>{etiquetaCurso(c)}</span>)}
                {(r.cursos || []).length > 6 && <span style={S.tag}>+{r.cursos.length - 6}</span>}
                {(r.etiquetas || []).map(e => <span key={e} style={{ ...S.tag, background: '#fffde7', color: '#795548' }}>#{e}</span>)}
            </div>
            <div style={{ fontSize: '0.78rem', color: '#607d8b', marginBottom: 8 }}>
                👤 {esMio ? 'Tú' : r.propietarioNombre || 'Profesor/a'}
                {r.fecha ? ` · ${new Date(ms(r.fecha)).toLocaleDateString('es-ES')}` : ''}
                <span style={{ marginLeft: 6, padding: '1px 6px', borderRadius: 8, background: est.fondo, color: est.color }} title={r._mensaje || ''}>
                    {est.icono} {r.comprobacion?.estado === 'dudoso' && r.comprobacion?.manual ? 'Confirmado a mano' : est.texto}
                </span>
            </div>
            {r._mensaje && <div style={{ fontSize: '0.78rem', color: est.color, marginBottom: 6 }}>{r._mensaje}</div>}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 'auto', alignItems: 'center' }}>
                <a href={r.url} target="_blank" rel="noopener noreferrer" onClick={contarApertura} onAuxClick={contarApertura}
                    style={{ ...S.btnSm, background: '#3949ab', textDecoration: 'none' }}>Abrir ↗</a>
                <button onClick={toggleLike} disabled={votando || esMio || !puedeVotar}
                    title={esMio ? 'No puedes dar «me gusta» a tus propios recursos' : meGusta ? 'Quitar «me gusta»' : 'Me gusta: me ha resultado útil'}
                    style={{ ...S.btnSm, background: meGusta ? '#e91e63' : 'white', color: meGusta ? 'white' : '#e91e63', border: '1.5px solid #e91e63', cursor: esMio || !puedeVotar ? 'default' : 'pointer' }}>
                    {meGusta ? '❤️' : '🤍'} {likes}
                </button>
                <span title="Veces que se ha abierto" style={{ fontSize: '0.8rem', color: '#607d8b', padding: '0 2px' }}>👁️ {r.aperturas || 0}</span>
                <button onClick={() => navigator.clipboard?.writeText(r.url)} style={{ ...S.btnSm, background: '#78909c' }} title="Copiar enlace">📋</button>
                {puedeVotar && (
                    <button onClick={recomprobar} disabled={comprobando} style={{ ...S.btnSm, background: '#00897b' }} title="Comprobar si el enlace sigue funcionando">
                        {comprobando ? '…' : '🔍'}
                    </button>
                )}
                {esMio && <button onClick={() => onEditar(r)} style={{ ...S.btnSm, background: '#f9a825' }}>✏️ Editar</button>}
                {(esMio || esAdmin) && <button onClick={() => onBorrar(r)} style={{ ...S.btnSm, background: '#e53935' }}>🗑️</button>}
            </div>
        </div>
    );
}

// ─── Compartir los enlaces del banco ────────────────────────────────────────
function BotonCompartirBanco() {
    const [abierto, setAbierto] = useState(false);
    const [copiado, setCopiado] = useState('');
    const enlaces = [
        { id: 'nuevo', titulo: '➕ Enlace para añadir un recurso', desc: 'Quien lo abra (con su cuenta) va directo al formulario.', url: urlBancoNuevo() },
        { id: 'ver', titulo: '📚 Enlace al banco', desc: 'Para ver y buscar los recursos de todos.', url: urlBanco() },
        { id: 'fichas', titulo: '🖨️ Enlace a las fichas PDF', desc: 'Todos los generadores de fichas imprimibles de PiKT.', url: `${urlBanco()}/fichas` },
    ];
    const copiar = async (e) => {
        try { await navigator.clipboard.writeText(e.url); setCopiado(e.id); setTimeout(() => setCopiado(''), 1800); }
        catch { prompt('Copia el enlace:', e.url); }
    };
    const compartir = async (e) => {
        try { await navigator.share({ title: 'Banco de recursos PiKT', text: e.desc, url: e.url }); } catch { /* cancelado */ }
    };
    return (
        <div style={{ position: 'relative' }}>
            <button onClick={() => setAbierto(v => !v)} style={{ ...S.pestana, background: 'white', color: '#00897b', borderColor: '#00897b' }}>🔗 Compartir</button>
            {abierto && (
                <div style={S.popover}>
                    {enlaces.map(e => (
                        <div key={e.id} style={{ marginBottom: 10 }}>
                            <div style={{ fontWeight: 800, color: '#263238', fontSize: '0.9rem' }}>{e.titulo}</div>
                            <div style={{ fontSize: '0.78rem', color: '#607d8b', marginBottom: 4 }}>{e.desc}</div>
                            <div style={{ display: 'flex', gap: 6 }}>
                                <input readOnly value={e.url} onFocus={ev => ev.target.select()} style={{ ...S.input, padding: '6px 8px', fontSize: '0.8rem' }} />
                                <button onClick={() => copiar(e)} style={{ ...S.btnSm, background: copiado === e.id ? '#2e7d32' : '#3949ab', whiteSpace: 'nowrap' }}>{copiado === e.id ? '✓ Copiado' : '📋 Copiar'}</button>
                                {navigator.share && <button onClick={() => compartir(e)} style={{ ...S.btnSm, background: '#00897b' }} title="Compartir">📤</button>}
                            </div>
                        </div>
                    ))}
                    <button onClick={() => setAbierto(false)} style={{ ...S.linkBtn, fontSize: '0.8rem' }}>Cerrar</button>
                </div>
            )}
        </div>
    );
}

// ─── Componente principal ───────────────────────────────────────────────────
// Props:
//   abrirNuevo  → abre el formulario de alta al entrar (enlace /banco/nuevo)
//   onVolver    → muestra el botón «← Volver»
//   comunidad   → { nombre, miembros[] }: modo embebido, solo recursos de esos profes
//   seccionInicial → 'recursos' | 'fichas' (enlace /banco/fichas)
export default function BancoRecursos({ usuario, abrirNuevo = false, onVolver = null, comunidad = null, seccionInicial = 'recursos' }) {
    const [seccion, setSeccion] = useState(comunidad || abrirNuevo ? 'recursos' : seccionInicial);
    const irSeccion = (s) => {
        setSeccion(s);
        // Refleja la sección en la URL solo en la página propia del banco
        if (/^\/banco(\/|$)/i.test(window.location.pathname)) window.history.replaceState({}, '', s === 'fichas' ? '/banco/fichas' : '/banco');
    };
    const uid = usuario?.uid;
    const esAdmin = usuario?.email === ADMIN_EMAIL;
    const uidsComunidad = comunidad ? (comunidad.miembros || []) : null;
    const claveComunidad = uidsComunidad ? uidsComunidad.join(',') : '';
    const [vista, setVista] = useState('todos'); // 'todos' | 'mios'
    const [materia, setMateria] = useState('');
    const [etapa, setEtapa] = useState('');
    const [curso, setCurso] = useState('');
    const [tipo, setTipo] = useState('');
    const [texto, setTexto] = useState('');
    const [agrupar, setAgrupar] = useState('materia');
    const [orden, setOrden] = useState('utiles'); // utiles | likes | abiertos | recientes
    const [items, setItems] = useState([]);
    const [cargando, setCargando] = useState(true);
    const [error, setError] = useState('');
    const registrado = !!uid && !usuario?.isAnonymous;
    const [form, setForm] = useState(abrirNuevo && registrado ? {} : null); // null | {} | recurso
    // ¿Puede ver los recursos «solo profesores»? (users/{uid}.role == 'profesor'). null = comprobando
    const [esProfe, setEsProfe] = useState(registrado ? null : false);
    useEffect(() => {
        if (!registrado) { setEsProfe(false); return; }
        let vivo = true;
        getDoc(doc(db, 'users', uid))
            .then(s => { if (vivo) setEsProfe(String(s.data()?.role || '').toLowerCase() === 'profesor'); })
            .catch(() => { if (vivo) setEsProfe(false); });
        return () => { vivo = false; };
    }, [uid, registrado]);

    useEffect(() => {
        if (esProfe === null) return;
        let vivo = true;
        setCargando(true); setError('');
        const col = collection(db, COL);
        // Sin ser profe solo se pueden pedir los públicos (las reglas lo exigen en la consulta)
        const pub = esProfe ? [] : [where('visibilidad', '==', 'publico')];
        // Consultas de igualdad (sin índices compuestos); el resto se filtra y ordena aquí.
        let promesa;
        if (uidsComunidad) {
            // Recursos de los profes de la comunidad ('in' admite hasta 30 valores por consulta)
            const trozos = [];
            for (let i = 0; i < uidsComunidad.length && i < 300; i += 30) trozos.push(uidsComunidad.slice(i, i + 30));
            promesa = Promise.all(trozos.map(t => getDocs(query(col, where('propietarioUid', 'in', t), ...pub))))
                .then(snaps => snaps.flatMap(s => s.docs));
        } else {
            const q = vista === 'mios' && registrado ? query(col, where('propietarioUid', '==', uid))
                : materia ? query(col, where('materia', '==', materia), ...pub, limit(500))
                : esProfe ? query(col, orderBy('fecha', 'desc'), limit(400))
                : query(col, ...pub, limit(400));
            promesa = getDocs(q).then(s => s.docs);
        }
        promesa
            .then(docs => { if (vivo) setItems(docs.map(d => ({ id: d.id, ...d.data() }))); })
            .catch(e => { if (vivo) setError(e.code === 'permission-denied' ? 'No hay permiso para leer el banco (faltan las reglas de Firestore).' : e.message); })
            .finally(() => { if (vivo) setCargando(false); });
        return () => { vivo = false; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [uid, esProfe, vista, uidsComunidad ? claveComunidad : materia]);

    const filtrados = useMemo(() => {
        const t = texto.trim().toLowerCase();
        return items
            .filter(r => !materia || r.materia === materia)
            .filter(r => !etapa || (r.etapas || []).includes(etapa))
            .filter(r => !curso || (r.cursos || []).includes(curso))
            .filter(r => !tipo || r.tipo === tipo)
            .filter(r => !t || [r.titulo, r.descripcion, r.propietarioNombre, r.dominio, ...(r.etiquetas || [])]
                .some(x => String(x || '').toLowerCase().includes(t)))
            .sort((a, b) => {
                const L = (x) => (x.likesUids || []).length, A = (x) => x.aperturas || 0;
                if (orden === 'likes') return L(b) - L(a) || A(b) - A(a) || ms(b.fecha) - ms(a.fecha);
                if (orden === 'abiertos') return A(b) - A(a) || L(b) - L(a) || ms(b.fecha) - ms(a.fecha);
                if (orden === 'utiles') return utilidad(b) - utilidad(a) || ms(b.fecha) - ms(a.fecha);
                return ms(b.fecha) - ms(a.fecha);
            });
    }, [items, materia, etapa, curso, tipo, texto, orden]);

    const grupos = useMemo(() => {
        if (agrupar === 'no') return [{ clave: 'todos', titulo: null, lista: filtrados }];
        const mapa = new Map();
        const meter = (clave, r) => { if (!mapa.has(clave)) mapa.set(clave, []); mapa.get(clave).push(r); };
        filtrados.forEach(r => {
            if (agrupar === 'materia') meter(r.materia || 'otras', r);
            else if (agrupar === 'tipo') meter(r.tipo || 'otro', r);
            else (r.cursos?.length ? r.cursos : ['?']).forEach(c => { if (!curso || c === curso) meter(c, r); });
        });
        const orden = agrupar === 'materia' ? MATERIAS_BANCO.map(x => x.id)
            : agrupar === 'tipo' ? TIPOS_BANCO.map(x => x.id)
            : ETAPAS_BANCO.flatMap(e => e.cursos.map((_, i) => `${e.id}-${i}`));
        const titulo = (k) => {
            if (agrupar === 'materia') { const m = buscar(MATERIAS_BANCO, k); return m ? `${m.emoji} ${m.label}` : k; }
            if (agrupar === 'tipo') { const x = buscar(TIPOS_BANCO, k); return x ? `${x.emoji} ${x.label}` : k; }
            return `🎓 ${etiquetaCurso(k)}`;
        };
        return [...mapa.entries()]
            .sort((a, b) => (orden.indexOf(a[0]) + 1 || 999) - (orden.indexOf(b[0]) + 1 || 999))
            .map(([clave, lista]) => ({ clave, titulo: titulo(clave), lista }));
    }, [filtrados, agrupar, curso]);

    const etapaSel = ETAPAS_BANCO.find(e => e.id === etapa);
    const hayFiltros = materia || etapa || curso || tipo || texto;
    const puedeSubir = registrado && (!uidsComunidad || uidsComunidad.includes(uid));

    const borrar = async (r) => {
        if (!confirm(`¿Quitar «${r.titulo}» del banco? (El archivo original no se borra.)`)) return;
        try { await deleteDoc(doc(db, COL, r.id)); setItems(p => p.filter(x => x.id !== r.id)); }
        catch (e) { alert(e.message); }
    };
    const guardado = (r) => {
        setItems(p => p.some(x => x.id === r.id) ? p.map(x => x.id === r.id ? r : x) : [r, ...p]);
        setForm(null);
        if (/\/banco\/nuevo\/?$/i.test(window.location.pathname)) window.history.replaceState({}, '', '/banco');
    };
    const cambiar = (id, patch) => setItems(p => p.map(x => x.id === id ? { ...x, ...patch } : x));
    const recomprobado = (id, comprobacion, mensaje) =>
        setItems(p => p.map(x => x.id === id ? { ...x, comprobacion, _mensaje: comprobacion.estado === 'ok' ? '' : mensaje } : x));

    return (
        <div style={{ paddingBottom: 40 }}>
            {onVolver && (
                <button onClick={onVolver} style={{ marginBottom: 12, padding: '7px 14px', borderRadius: 8, border: '1px solid #dde', background: 'white', cursor: 'pointer', fontSize: '0.85rem', color: '#555' }}>
                    ← Volver
                </button>
            )}
            {comunidad ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
                    <h3 style={{ margin: 0, color: '#1a237e', flex: 1, minWidth: 180 }}>📚 Banco de recursos de los miembros</h3>
                    <a href={urlBanco()} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.85rem', color: '#3949ab', fontWeight: 700 }}>Ver el banco completo ↗</a>
                    {puedeSubir && <button onClick={() => setForm({})} style={{ ...S.btnSm, background: '#2e7d32' }}>➕ Añadir</button>}
                </div>
            ) : (
                <>
                    <div style={{ textAlign: 'center', marginBottom: 14 }}>
                        <h1 style={{ color: '#1a237e', margin: '0 0 4px' }}>📚 Banco de recursos</h1>
                        <p style={{ color: '#455a64', margin: 0 }}>Materiales compartidos por el profesorado y todas las fichas en PDF que puedes generar en PiKT.</p>
                    </div>

                    <div style={{ display: 'flex', gap: 4, justifyContent: 'center', marginBottom: 16, borderBottom: '2px solid #c5cae9', flexWrap: 'wrap' }}>
                        {[['recursos', '🤝 Recursos compartidos'], ['fichas', '🖨️ Fichas PDF de PiKT']].map(([s, l]) => (
                            <button key={s} onClick={() => irSeccion(s)}
                                style={{ border: 'none', background: 'none', padding: '10px 16px', cursor: 'pointer', fontSize: '1rem', marginBottom: -2,
                                    fontWeight: seccion === s ? 800 : 600, color: seccion === s ? '#1a237e' : '#78909c',
                                    borderBottom: seccion === s ? '3px solid #3949ab' : '3px solid transparent' }}>{l}</button>
                        ))}
                    </div>
                </>
            )}

            {!comunidad && seccion === 'fichas' ? (
                <Suspense fallback={<div style={{ textAlign: 'center', color: '#607d8b', margin: 30 }}>Cargando fichas…</div>}>
                    <FichasPikt />
                </Suspense>
            ) : (<>
            {!comunidad && (
                <>
                    <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 14 }}>
                        {registrado && [['todos', '🌍 De todos'], ['mios', '👤 Los míos']].map(([v, l]) => (
                            <button key={v} onClick={() => setVista(v)} style={{ ...S.pestana, background: vista === v ? '#3949ab' : 'white', color: vista === v ? 'white' : '#3949ab' }}>{l}</button>
                        ))}
                        {puedeSubir && <button onClick={() => setForm({})} style={{ ...S.pestana, background: '#2e7d32', color: 'white', borderColor: '#2e7d32' }}>➕ Añadir recurso</button>}
                        <BotonCompartirBanco />
                    </div>
                </>
            )}
            {esProfe === false && (
                <div style={{ background: '#fff8e1', border: '1px solid #ffe082', color: '#6d4c41', borderRadius: 10, padding: '8px 12px', fontSize: '0.85rem', marginBottom: 12 }}>
                    🌍 Estás viendo solo los recursos <b>públicos</b>.{' '}
                    {registrado ? 'Los marcados «solo profesores» solo los ven las cuentas de profesor.' : 'Inicia sesión con tu cuenta de profesor para ver también los de «solo profesores» y añadir los tuyos.'}
                </div>
            )}

            {/* Filtros */}
            <div style={S.filtros}>
                <input value={texto} onChange={e => setTexto(e.target.value)} placeholder="🔎 Buscar por título, descripción, autor o etiqueta…" style={{ ...S.input, flex: '1 1 100%' }} />
                <select value={materia} onChange={e => setMateria(e.target.value)} style={S.select}>
                    <option value="">Todas las materias</option>
                    {MATERIAS_BANCO.map(m => <option key={m.id} value={m.id}>{m.emoji} {m.label}</option>)}
                </select>
                <select value={etapa} onChange={e => { setEtapa(e.target.value); setCurso(''); }} style={S.select}>
                    <option value="">Todas las etapas</option>
                    {ETAPAS_BANCO.map(e => <option key={e.id} value={e.id}>{e.label}</option>)}
                </select>
                {etapaSel && (
                    <select value={curso} onChange={e => setCurso(e.target.value)} style={S.select}>
                        <option value="">Todos los cursos</option>
                        {etapaSel.cursos.map((c, i) => <option key={i} value={`${etapaSel.id}-${i}`}>{etiquetaCurso(`${etapaSel.id}-${i}`)}</option>)}
                    </select>
                )}
                <select value={tipo} onChange={e => setTipo(e.target.value)} style={S.select}>
                    <option value="">Todos los tipos</option>
                    {TIPOS_BANCO.map(t => <option key={t.id} value={t.id}>{t.emoji} {t.label}</option>)}
                </select>
                <select value={orden} onChange={e => setOrden(e.target.value)} style={S.select} title="Ordenar">
                    <option value="utiles">⭐ Más útiles primero</option>
                    <option value="likes">❤️ Más «me gusta»</option>
                    <option value="abiertos">👁️ Más abiertos</option>
                    <option value="recientes">🕒 Más recientes</option>
                </select>
                <select value={agrupar} onChange={e => setAgrupar(e.target.value)} style={S.select} title="Agrupar">
                    <option value="materia">Agrupar por materia</option>
                    <option value="tipo">Agrupar por tipo</option>
                    <option value="curso">Agrupar por curso</option>
                    <option value="no">Sin agrupar</option>
                </select>
                {hayFiltros && <button onClick={() => { setMateria(''); setEtapa(''); setCurso(''); setTipo(''); setTexto(''); }} style={{ ...S.btnSm, background: '#90a4ae' }}>Limpiar</button>}
            </div>

            {error && <div style={{ color: '#c62828', textAlign: 'center', margin: 20, fontWeight: 700 }}>{error}</div>}
            {cargando ? <div style={{ textAlign: 'center', color: '#607d8b', margin: 30 }}>Cargando…</div>
                : !error && filtrados.length === 0 ? (
                    <div style={{ textAlign: 'center', color: '#607d8b', margin: 30 }}>
                        {hayFiltros ? 'No hay recursos con esos filtros.'
                            : comunidad ? 'Los miembros aún no han añadido recursos al banco.'
                            : vista === 'mios' ? 'Aún no has añadido ningún recurso.' : 'Todavía no hay recursos en el banco.'}
                        {puedeSubir && <div style={{ marginTop: 10 }}><button onClick={() => setForm({})} style={{ ...S.btn, background: '#2e7d32' }}>➕ Añadir el primero</button></div>}
                    </div>
                ) : (
                    <>
                        <div style={{ color: '#607d8b', fontSize: '0.85rem', margin: '4px 2px 10px' }}>{filtrados.length} recurso{filtrados.length === 1 ? '' : 's'}</div>
                        {grupos.map(g => (
                            <section key={g.clave} style={{ marginBottom: 22 }}>
                                {g.titulo && <h3 style={{ color: '#283593', margin: '0 0 10px', borderBottom: '2px solid #c5cae9', paddingBottom: 4 }}>{g.titulo} <span style={{ color: '#9fa8da', fontWeight: 400 }}>({g.lista.length})</span></h3>}
                                <div style={S.rejilla}>
                                    {g.lista.map(r => (
                                        <Tarjeta key={`${g.clave}-${r.id}`} r={r} uid={uid} esMio={r.propietarioUid === uid} esAdmin={esAdmin}
                                            puedeVotar={registrado}
                                            onEditar={setForm} onBorrar={borrar} onRecomprobado={recomprobado} onCambio={cambiar} />
                                    ))}
                                </div>
                            </section>
                        ))}
                    </>
                )}
            </>)}

            {form && <FormRecurso usuario={usuario} inicial={form} onCerrar={() => setForm(null)} onGuardado={guardado} />}
        </div>
    );
}

const S = {
    overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 10000, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', overflowY: 'auto', padding: '24px 12px' },
    modal: { background: 'white', borderRadius: 18, padding: '18px 18px 20px', width: '100%', maxWidth: 640, boxShadow: '0 10px 40px rgba(0,0,0,0.25)', boxSizing: 'border-box' },
    cerrar: { background: 'none', border: 'none', fontSize: '1.4rem', cursor: 'pointer', color: '#546e7a' },
    label: { display: 'block', fontWeight: 700, color: '#37474f', margin: '14px 0 5px', fontSize: '0.92rem' },
    input: { width: '100%', padding: '9px 11px', borderRadius: 10, border: '1.5px solid #cfd8dc', fontSize: '0.95rem', boxSizing: 'border-box' },
    select: { flex: '1 1 160px', padding: '8px 10px', borderRadius: 10, border: '1.5px solid #cfd8dc', fontSize: '0.9rem', background: 'white', minWidth: 0 },
    btn: { border: 'none', color: 'white', padding: '9px 16px', borderRadius: 10, fontWeight: 800, cursor: 'pointer', fontSize: '0.92rem' },
    btnSm: { border: 'none', color: 'white', padding: '6px 10px', borderRadius: 8, fontWeight: 700, cursor: 'pointer', fontSize: '0.82rem', display: 'inline-flex', alignItems: 'center' },
    linkBtn: { background: 'none', border: 'none', color: '#1565c0', textDecoration: 'underline', cursor: 'pointer', padding: 0, fontSize: 'inherit' },
    chip: { border: '1.5px solid #cfd8dc', borderRadius: 16, padding: '4px 10px', cursor: 'pointer', fontSize: '0.82rem', background: 'white' },
    tag: { fontSize: '0.72rem', padding: '2px 7px', borderRadius: 8, background: '#eceff1', color: '#455a64' },
    pestana: { border: '2px solid #3949ab', borderRadius: 20, padding: '8px 16px', fontWeight: 800, cursor: 'pointer' },
    popover: { position: 'fixed', left: '50%', top: 90, transform: 'translateX(-50%)', zIndex: 10001, background: 'white', borderRadius: 12, boxShadow: '0 8px 30px rgba(0,0,0,0.18)', padding: 14, width: 'min(360px, calc(100vw - 32px))', textAlign: 'left' },
    filtros: { display: 'flex', flexWrap: 'wrap', gap: 8, background: 'white', padding: 12, borderRadius: 14, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', marginBottom: 16 },
    rejilla: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 270px), 1fr))', gap: 12 },
    tarjeta: { background: 'white', borderRadius: 14, padding: 14, boxShadow: '0 2px 10px rgba(0,0,0,0.07)', display: 'flex', flexDirection: 'column', borderTop: '4px solid #5c6bc0', minWidth: 0 },
};
