// ─────────────────────────────────────────────────────────────────────────────
//  Banco de recursos del profesorado
//  Cualquier profe registrado enlaza materiales (Drive, webs, vídeos…) con
//  propietario, materia, cursos, tipo y descripción. Se ven los de todos o
//  solo los propios, agrupados por materia, tipo o curso.
//  Colección Firestore: banco_recursos. Comprobación de enlaces: /api/comprobar-enlace
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useMemo, useState } from 'react';
import { db, auth } from '../firebase';
import {
    collection, query, where, orderBy, limit, getDocs, addDoc, updateDoc, deleteDoc, doc, serverTimestamp,
} from 'firebase/firestore';
import {
    MATERIAS_BANCO, ETAPAS_BANCO, TIPOS_BANCO, etiquetaCurso, buscar,
    normalizarUrl, dominioDe, servicioDeUrl, enlaceCopiaGoogle,
} from './constantes';

const COL = 'banco_recursos';
const ADMIN_EMAIL = 'goladen@gmail.com';

const ms = (f) => (f?.toMillis ? f.toMillis() : typeof f === 'number' ? f : 0);

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
            const dup = await getDocs(query(collection(db, COL), where('url', '==', urlN), limit(3)));
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
function Tarjeta({ r, esMio, esAdmin, onEditar, onBorrar, onRecomprobado }) {
    const m = buscar(MATERIAS_BANCO, r.materia);
    const t = buscar(TIPOS_BANCO, r.tipo);
    const est = ESTADOS[r.comprobacion?.estado] || ESTADOS.dudoso;
    const [comprobando, setComprobando] = useState(false);
    const [verMas, setVerMas] = useState(false);
    const larga = (r.descripcion || '').length > 160;

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
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 'auto' }}>
                <a href={r.url} target="_blank" rel="noopener noreferrer" style={{ ...S.btnSm, background: '#3949ab', textDecoration: 'none' }}>Abrir ↗</a>
                <button onClick={() => navigator.clipboard?.writeText(r.url)} style={{ ...S.btnSm, background: '#78909c' }} title="Copiar enlace">📋</button>
                <button onClick={recomprobar} disabled={comprobando} style={{ ...S.btnSm, background: '#00897b' }} title="Comprobar si el enlace sigue funcionando">
                    {comprobando ? '…' : '🔍'}
                </button>
                {esMio && <button onClick={() => onEditar(r)} style={{ ...S.btnSm, background: '#f9a825' }}>✏️ Editar</button>}
                {(esMio || esAdmin) && <button onClick={() => onBorrar(r)} style={{ ...S.btnSm, background: '#e53935' }}>🗑️</button>}
            </div>
        </div>
    );
}

// ─── Componente principal ───────────────────────────────────────────────────
export default function BancoRecursos({ usuario }) {
    const uid = usuario?.uid;
    const esAdmin = usuario?.email === ADMIN_EMAIL;
    const [vista, setVista] = useState('todos'); // 'todos' | 'mios'
    const [materia, setMateria] = useState('');
    const [etapa, setEtapa] = useState('');
    const [curso, setCurso] = useState('');
    const [tipo, setTipo] = useState('');
    const [texto, setTexto] = useState('');
    const [agrupar, setAgrupar] = useState('materia');
    const [items, setItems] = useState([]);
    const [cargando, setCargando] = useState(true);
    const [error, setError] = useState('');
    const [form, setForm] = useState(null); // null | {} | recurso

    useEffect(() => {
        if (!uid) return;
        let vivo = true;
        setCargando(true); setError('');
        const col = collection(db, COL);
        // Consultas de un solo campo (sin índices compuestos); el resto se filtra aquí.
        const q = vista === 'mios' ? query(col, where('propietarioUid', '==', uid))
            : materia ? query(col, where('materia', '==', materia), limit(500))
            : query(col, orderBy('fecha', 'desc'), limit(400));
        getDocs(q)
            .then(s => { if (vivo) setItems(s.docs.map(d => ({ id: d.id, ...d.data() }))); })
            .catch(e => { if (vivo) setError(e.code === 'permission-denied' ? 'No hay permiso para leer el banco (faltan las reglas de Firestore).' : e.message); })
            .finally(() => { if (vivo) setCargando(false); });
        return () => { vivo = false; };
    }, [uid, vista, materia]);

    const filtrados = useMemo(() => {
        const t = texto.trim().toLowerCase();
        return items
            .filter(r => !materia || r.materia === materia)
            .filter(r => !etapa || (r.etapas || []).includes(etapa))
            .filter(r => !curso || (r.cursos || []).includes(curso))
            .filter(r => !tipo || r.tipo === tipo)
            .filter(r => !t || [r.titulo, r.descripcion, r.propietarioNombre, r.dominio, ...(r.etiquetas || [])]
                .some(x => String(x || '').toLowerCase().includes(t)))
            .sort((a, b) => ms(b.fecha) - ms(a.fecha));
    }, [items, materia, etapa, curso, tipo, texto]);

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
    const puedeSubir = uid && !usuario?.isAnonymous;

    const borrar = async (r) => {
        if (!confirm(`¿Quitar «${r.titulo}» del banco? (El archivo original no se borra.)`)) return;
        try { await deleteDoc(doc(db, COL, r.id)); setItems(p => p.filter(x => x.id !== r.id)); }
        catch (e) { alert(e.message); }
    };
    const guardado = (r) => {
        setItems(p => p.some(x => x.id === r.id) ? p.map(x => x.id === r.id ? r : x) : [r, ...p]);
        setForm(null);
    };
    const recomprobado = (id, comprobacion, mensaje) =>
        setItems(p => p.map(x => x.id === id ? { ...x, comprobacion, _mensaje: comprobacion.estado === 'ok' ? '' : mensaje } : x));

    if (!uid) return <div style={{ padding: 30, textAlign: 'center' }}>Inicia sesión para ver el banco de recursos.</div>;

    return (
        <div style={{ paddingBottom: 40 }}>
            <div style={{ textAlign: 'center', marginBottom: 16 }}>
                <h1 style={{ color: '#1a237e', margin: '0 0 4px' }}>📚 Banco de recursos</h1>
                <p style={{ color: '#455a64', margin: 0 }}>Materiales enlazados por el profesorado, organizados por materia, curso y tipo.</p>
            </div>

            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 14 }}>
                {[['todos', '🌍 De todos'], ['mios', '👤 Los míos']].map(([v, l]) => (
                    <button key={v} onClick={() => setVista(v)} style={{ ...S.pestana, background: vista === v ? '#3949ab' : 'white', color: vista === v ? 'white' : '#3949ab' }}>{l}</button>
                ))}
                {puedeSubir && <button onClick={() => setForm({})} style={{ ...S.pestana, background: '#2e7d32', color: 'white', borderColor: '#2e7d32' }}>➕ Añadir recurso</button>}
            </div>

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
                        {vista === 'mios' && !hayFiltros ? 'Aún no has añadido ningún recurso.' : 'No hay recursos con esos filtros.'}
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
                                        <Tarjeta key={`${g.clave}-${r.id}`} r={r} esMio={r.propietarioUid === uid} esAdmin={esAdmin}
                                            onEditar={setForm} onBorrar={borrar} onRecomprobado={recomprobado} />
                                    ))}
                                </div>
                            </section>
                        ))}
                    </>
                )}

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
    filtros: { display: 'flex', flexWrap: 'wrap', gap: 8, background: 'white', padding: 12, borderRadius: 14, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', marginBottom: 16 },
    rejilla: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 270px), 1fr))', gap: 12 },
    tarjeta: { background: 'white', borderRadius: 14, padding: 14, boxShadow: '0 2px 10px rgba(0,0,0,0.07)', display: 'flex', flexDirection: 'column', borderTop: '4px solid #5c6bc0', minWidth: 0 },
};
