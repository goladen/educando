import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, doc, setDoc, getDocs, query, where } from 'firebase/firestore';
import {
    Save, X, Settings, Plus, Trash2, Search, RefreshCw, CheckCircle,
    Clock, Calendar, ImageIcon, Video, ChevronUp, ChevronDown, AlertCircle
} from 'lucide-react';
import PublicarModal from './PublicarModal';

// ──────────────────────────────────────────────────────────
// HELPERS
// ──────────────────────────────────────────────────────────
const generarCodigo = () =>
    Array.from({ length: 5 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ'[Math.floor(Math.random() * 24)]).join('');

const eventoVacio = () => ({
    id: Date.now().toString() + Math.floor(Math.random() * 1000),
    fechaTipo: 'anio',   // 'anio' = solo año | 'dia' = día exacto
    anio: '', mes: '', dia: '',
    titulo: '', descripcion: '', imagen: '', video: '',
});

const hojaVacia = (n) => ({ nombreHoja: `Línea ${n}`, mostrarFechas: true, eventos: [] });

// Valor numérico ordenable de un evento (año*10000 + mes*100 + dia). Soporta años negativos (a.C.)
export const valorFecha = (ev) => {
    const a = parseInt(ev.anio, 10) || 0;
    const m = ev.fechaTipo === 'dia' ? (parseInt(ev.mes, 10) || 0) : 0;
    const d = ev.fechaTipo === 'dia' ? (parseInt(ev.dia, 10) || 0) : 0;
    return a * 10000 + m * 100 + d;
};

// Texto bonito de la fecha para mostrar
const MESES = ['', 'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
export const fechaTexto = (ev) => {
    const a = parseInt(ev.anio, 10);
    if (isNaN(a)) return '—';
    const anioStr = a < 0 ? `${Math.abs(a)} a.C.` : `${a}`;
    if (ev.fechaTipo === 'dia' && ev.dia && ev.mes) {
        return `${parseInt(ev.dia, 10)} de ${MESES[parseInt(ev.mes, 10)] || '?'} de ${anioStr}`;
    }
    return anioStr;
};

const toEmbedUrl = (url) => {
    if (!url) return '';
    let m = url.match(/youtube\.com\/watch\?(?:.*&)?v=([^&]+)/);
    if (m) return `https://www.youtube.com/embed/${m[1]}`;
    m = url.match(/youtu\.be\/([^?&]+)/);
    if (m) return `https://www.youtube.com/embed/${m[1]}`;
    m = url.match(/vimeo\.com\/(\d+)/);
    if (m) return `https://player.vimeo.com/video/${m[1]}`;
    return url;
};

// ──────────────────────────────────────────────────────────
// EDITOR PRINCIPAL
// ──────────────────────────────────────────────────────────
export default function EditorLineaTiempo({ datos, setDatos, onClose, usuario }) {
    const [hojaActiva, setHojaActiva]           = useState(0);
    const [mostrandoConfig, setMostrandoConfig] = useState(false);
    const [guardando, setGuardando]             = useState(false);
    const [guardadoOk, setGuardadoOk]           = useState(false);
    const [modalPublicar, setModalPublicar]     = useState(null);
    const [eventoAbierto, setEventoAbierto]     = useState(null);   // id del evento expandido

    // ── Inicialización ──────────────────────────────────
    useEffect(() => {
        setDatos(prev => ({
            ...prev,
            tipo:        'LINEA_TIEMPO',
            tipoJuego:   'LINEA_TIEMPO',
            pais:        prev.pais        || usuario?.pais       || '',
            region:      prev.region      || usuario?.region     || '',
            poblacion:   prev.poblacion   || usuario?.poblacion  || usuario?.localidad || '',
            ciclo:       prev.ciclo       || usuario?.ciclo      || 'Secundaria',
            temas:       prev.temas       || usuario?.temasPreferidos || '',
            profesorNombre: prev.profesorNombre || usuario?.displayName || usuario?.nombre || '',
            hojas: (!prev.hojas || prev.hojas.length === 0) ? [hojaVacia(1)] : prev.hojas,
        }));
    }, []);

    const hojaActual = datos.hojas?.[hojaActiva] || hojaVacia(1);
    const eventos    = hojaActual.eventos || [];
    const totalEventos = (datos.hojas || []).reduce((s, h) => s + (h.eventos?.length || 0), 0);

    // ── Gestión de hojas ────────────────────────────────
    const updateHoja = (nuevosDatos) => {
        setDatos(prev => {
            const hojas = [...(prev.hojas || [])];
            hojas[hojaActiva] = { ...hojas[hojaActiva], ...nuevosDatos };
            return { ...prev, hojas };
        });
    };
    const addHoja = () => {
        const hojas = [...(datos.hojas || []), hojaVacia((datos.hojas?.length || 0) + 1)];
        setDatos({ ...datos, hojas });
        setHojaActiva(hojas.length - 1);
    };
    const deleteHoja = (idx) => {
        if ((datos.hojas?.length || 0) <= 1) return alert('Debe haber al menos una línea del tiempo.');
        if (!window.confirm('¿Borrar esta línea del tiempo y sus eventos?')) return;
        const hojas = datos.hojas.filter((_, i) => i !== idx);
        setDatos({ ...datos, hojas });
        setHojaActiva(0);
    };
    const renameHoja = (idx, val) => {
        const hojas = [...datos.hojas];
        hojas[idx] = { ...hojas[idx], nombreHoja: val };
        setDatos({ ...datos, hojas });
    };

    // ── Gestión de eventos ──────────────────────────────
    const addEvento = () => {
        const nuevo = eventoVacio();
        updateHoja({ eventos: [...eventos, nuevo] });
        setEventoAbierto(nuevo.id);
    };
    const updateEvento = (id, campos) =>
        updateHoja({ eventos: eventos.map(ev => ev.id === id ? { ...ev, ...campos } : ev) });
    const deleteEvento = (id) =>
        updateHoja({ eventos: eventos.filter(ev => ev.id !== id) });

    // ── Guardar en Firestore ────────────────────────────
    const guardar = async (extraDatos = {}) => {
        if (!datos.titulo?.trim()) return alert('Introduce un título para el recurso.');
        const hojas = datos.hojas || [];
        const conEventos = hojas.filter(h => (h.eventos?.length || 0) >= 2);
        if (conEventos.length === 0) return alert('Añade al menos una línea con 2 o más eventos antes de guardar.');
        const sinFecha = hojas.some(h => h.eventos?.some(ev => ev.anio === '' || ev.anio === null || isNaN(parseInt(ev.anio, 10))));
        if (sinFecha && !window.confirm('Algún evento no tiene año. ¿Guardar igualmente?')) return;
        const datosEfectivos = { ...datos, ...extraDatos };

        setGuardando(true);
        try {
            let docId = datos.id;
            let code  = datos.accessCode;
            if (!code) {
                const checkRef = collection(db, 'resources');
                let intento = generarCodigo();
                const snap = await getDocs(query(checkRef, where('accessCode', '==', intento)));
                if (!snap.empty) intento = generarCodigo() + Math.floor(Math.random() * 9);
                code = intento;
            }
            if (!docId) docId = `linea_${Date.now()}`;

            const payload = {
                ...datosEfectivos,
                id:            docId,
                tipo:          'LINEA_TIEMPO',
                tipoJuego:     'LINEA_TIEMPO',
                accessCode:    code,
                profesorUid:   usuario?.uid || '',
                hojas,
                creadoEn:      datosEfectivos.creadoEn || Date.now(),
                fechaCreacion: datosEfectivos.fechaCreacion || new Date(),
                actualizadoEn: Date.now(),
            };
            await setDoc(doc(collection(db, 'resources'), docId), payload);
            setDatos({ ...payload });
            setGuardadoOk(true);
            setTimeout(() => setGuardadoOk(false), 3000);
        } catch (e) {
            console.error(e);
            alert('Error al guardar: ' + e.message);
        }
        setGuardando(false);
    };

    // ── Render ──────────────────────────────────────────
    return (
        <div style={st.overlay}>
            <div style={st.container}>

                {/* ── HEADER ── */}
                <div style={st.header}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
                        <Clock size={22} />
                        <span style={{ fontWeight: 'bold', whiteSpace: 'nowrap' }}>Editor Línea del Tiempo</span>
                        <input
                            placeholder="Título del Recurso..."
                            value={datos.titulo || ''}
                            onChange={e => setDatos({ ...datos, titulo: e.target.value })}
                            style={st.titleInput}
                        />
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
                        {guardadoOk && (
                            <span style={{ color: '#a8ffc4', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: 4 }}>
                                <CheckCircle size={14} /> Guardado
                            </span>
                        )}
                        <button onClick={() => setMostrandoConfig(true)} style={st.iconBtn} title="Configuración">
                            <Settings size={20} />
                        </button>
                        <button onClick={() => datos.isFinished ? guardar() : setModalPublicar('guardar')} disabled={guardando} style={st.saveBtn}>
                            {guardando ? <RefreshCw size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Save size={16} />}
                            {guardando ? 'Guardando...' : 'Guardar'}
                        </button>
                        <button onClick={() => !datos.isFinished ? setModalPublicar('cerrar') : onClose()} style={st.iconBtn}><X size={22} /></button>
                    </div>
                </div>

                {/* ── TABS ── */}
                <div style={st.tabsBar}>
                    {datos.hojas?.map((h, i) => (
                        <div
                            key={i}
                            onClick={() => { setHojaActiva(i); setEventoAbierto(null); }}
                            style={{
                                ...st.tab,
                                background:   i === hojaActiva ? 'white' : '#e8eef6',
                                borderBottom: i === hojaActiva ? '3px solid #2980b9' : 'none',
                                color:        i === hojaActiva ? '#1f5f86' : '#666',
                            }}
                        >
                            <Clock size={13} />
                            <input
                                value={h.nombreHoja}
                                onChange={e => renameHoja(i, e.target.value)}
                                style={st.tabInput}
                                onClick={e => e.stopPropagation()}
                            />
                            <span style={{ fontSize: '0.7rem', color: '#999' }}>({(h.eventos || []).length})</span>
                            {datos.hojas.length > 1 && (
                                <Trash2 size={13} color="#c0392b" onClick={e => { e.stopPropagation(); deleteHoja(i); }} style={{ cursor: 'pointer' }} />
                            )}
                        </div>
                    ))}
                    <button onClick={addHoja} style={st.addTabBtn}><Plus size={16} /> Línea</button>
                </div>

                {/* ── BODY ── */}
                <div style={st.body}>
                    {/* Config de la hoja: modo mostrar fechas / ordenar */}
                    <div style={st.modoRow}>
                        <span style={{ fontWeight: 700, color: '#2c3e50', fontSize: '0.9rem' }}>Modo de juego de esta línea:</span>
                        <div style={{ display: 'flex', borderRadius: 8, overflow: 'hidden', border: '1px solid #cbd5e1' }}>
                            <button
                                onClick={() => updateHoja({ mostrarFechas: true })}
                                style={{ ...st.modoBtn, background: hojaActual.mostrarFechas ? '#2980b9' : 'white', color: hojaActual.mostrarFechas ? 'white' : '#555' }}>
                                <Calendar size={14} /> Casillas con fecha
                            </button>
                            <button
                                onClick={() => updateHoja({ mostrarFechas: false })}
                                style={{ ...st.modoBtn, background: !hojaActual.mostrarFechas ? '#2980b9' : 'white', color: !hojaActual.mostrarFechas ? 'white' : '#555' }}>
                                <ChevronUp size={14} /> Ordenar (sin fecha)
                            </button>
                        </div>
                    </div>
                    <p style={{ fontSize: '0.78rem', color: '#94a3b8', margin: '0 0 16px' }}>
                        {hojaActual.mostrarFechas
                            ? 'Las casillas mostrarán la fecha y el alumno arrastra cada evento a su fecha.'
                            : 'Las casillas estarán vacías (1º, 2º, 3º…): el alumno ordena los eventos y escribe la fecha de cada uno. Al comprobar verá una pista («va antes / va después») hasta colocarlos bien.'}
                    </p>

                    {/* Lista de eventos */}
                    {eventos.length === 0 && (
                        <div style={st.vacio}>
                            <Clock size={42} color="#cbd5e1" />
                            <p style={{ color: '#94a3b8', margin: '10px 0 0' }}>Aún no hay eventos en esta línea.</p>
                        </div>
                    )}

                    {eventos.slice().sort((a, b) => valorFecha(a) - valorFecha(b)).map((ev) => (
                        <EventoCard
                            key={ev.id}
                            ev={ev}
                            abierto={eventoAbierto === ev.id}
                            onToggle={() => setEventoAbierto(eventoAbierto === ev.id ? null : ev.id)}
                            onChange={(campos) => updateEvento(ev.id, campos)}
                            onDelete={() => { deleteEvento(ev.id); if (eventoAbierto === ev.id) setEventoAbierto(null); }}
                        />
                    ))}

                    <button onClick={addEvento} style={st.addEventoBtn}><Plus size={18} /> Añadir evento</button>
                </div>

                {/* ── MODAL PUBLICAR ── */}
                {modalPublicar && (
                    <PublicarModal
                        modo={modalPublicar}
                        onGuardarPublicar={async () => { await guardar({ isFinished: true }); setModalPublicar(null); if (modalPublicar === 'cerrar') onClose(); }}
                        onGuardarSolo={async () => { await guardar(); setModalPublicar(null); if (modalPublicar === 'cerrar') onClose(); }}
                        onSalirSinGuardar={() => { setModalPublicar(null); onClose(); }}
                        onCancelar={() => setModalPublicar(null)}
                    />
                )}

                {/* ── MODAL CONFIGURACIÓN ── */}
                {mostrandoConfig && (
                    <ConfigModal datos={datos} setDatos={setDatos} onClose={() => setMostrandoConfig(false)} />
                )}

            </div>
            <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
        </div>
    );
}

// ──────────────────────────────────────────────────────────
// TARJETA DE EVENTO (con buscador de imagen y vídeo)
// ──────────────────────────────────────────────────────────
function EventoCard({ ev, abierto, onToggle, onChange, onDelete }) {
    const [modoBuscador, setModoBuscador] = useState(false);
    const [searchQuery, setSearchQuery]   = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [isSearching, setIsSearching]   = useState(false);

    const buscarImagenes = async () => {
        if (!searchQuery.trim()) return;
        setIsSearching(true);
        try {
            const res = await fetch(`https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrnamespace=6&gsrsearch=${encodeURIComponent(searchQuery)}&gsrlimit=24&prop=imageinfo&iiprop=url&iiurlwidth=400&format=json&origin=*`);
            const data = await res.json();
            const pages = data.query?.pages || {};
            const urls = Object.values(pages)
                .map(p => { const i = p.imageinfo?.[0]; return i?.thumburl || i?.url; })
                .filter(u => u && /\.(jpe?g|png|gif|webp|svg)(\?|$)/i.test(u));
            setSearchResults(urls);
        } catch { alert('Error buscando imágenes. Prueba a pegar la URL directamente.'); }
        setIsSearching(false);
    };
    const elegirImagen = (url) => { onChange({ imagen: url }); setModoBuscador(false); setSearchResults([]); setSearchQuery(''); };

    const sinAnio = ev.anio === '' || ev.anio === null || isNaN(parseInt(ev.anio, 10));

    return (
        <div style={{ ...st.evCard, borderColor: sinAnio ? '#f1c40f' : '#e2e8f0' }}>
            {/* Cabecera plegable */}
            <div style={st.evHead} onClick={onToggle}>
                <span style={st.evFecha}>{fechaTexto(ev)}</span>
                <span style={{ flex: 1, fontWeight: 700, color: ev.titulo ? '#2c3e50' : '#cbd5e1', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {ev.titulo || 'Evento sin título'}
                </span>
                {ev.imagen && <ImageIcon size={15} color="#27ae60" />}
                {ev.video && <Video size={15} color="#8e44ad" />}
                {sinAnio && <AlertCircle size={15} color="#f1c40f" />}
                <button onClick={e => { e.stopPropagation(); onDelete(); }} style={st.evDelBtn}><Trash2 size={14} /></button>
                {abierto ? <ChevronUp size={18} color="#94a3b8" /> : <ChevronDown size={18} color="#94a3b8" />}
            </div>

            {/* Cuerpo */}
            {abierto && (
                <div style={st.evBody}>
                    {/* Fecha */}
                    <div style={{ display: 'flex', borderRadius: 8, overflow: 'hidden', border: '1px solid #cbd5e1', marginBottom: 10, maxWidth: 280 }}>
                        {[['anio', '📅 Solo año'], ['dia', '📆 Día exacto']].map(([t, lbl]) => (
                            <button key={t} onClick={() => onChange({ fechaTipo: t })}
                                style={{ flex: 1, padding: '7px 0', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '0.78rem', background: ev.fechaTipo === t ? '#2980b9' : '#f5f7fa', color: ev.fechaTipo === t ? 'white' : '#555' }}>
                                {lbl}
                            </button>
                        ))}
                    </div>
                    <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
                        {ev.fechaTipo === 'dia' && (<>
                            <div><label style={st.miniLabel}>Día</label>
                                <input type="number" min="1" max="31" value={ev.dia} onChange={e => onChange({ dia: e.target.value })} placeholder="12" style={{ ...st.input, width: 70 }} /></div>
                            <div><label style={st.miniLabel}>Mes</label>
                                <input type="number" min="1" max="12" value={ev.mes} onChange={e => onChange({ mes: e.target.value })} placeholder="10" style={{ ...st.input, width: 70 }} /></div>
                        </>)}
                        <div><label style={st.miniLabel}>Año (negativo = a.C.)</label>
                            <input type="number" value={ev.anio} onChange={e => onChange({ anio: e.target.value })} placeholder="1492" style={{ ...st.input, width: 120 }} /></div>
                    </div>

                    {/* Título y descripción */}
                    <label style={st.miniLabel}>Título del evento</label>
                    <input value={ev.titulo} onChange={e => onChange({ titulo: e.target.value })} placeholder="Ej: Descubrimiento de América" style={{ ...st.input, marginBottom: 10 }} />
                    <label style={st.miniLabel}>Descripción</label>
                    <textarea value={ev.descripcion} onChange={e => onChange({ descripcion: e.target.value })} placeholder="Breve descripción del evento..." style={{ ...st.input, minHeight: 56, resize: 'vertical', fontFamily: 'inherit', marginBottom: 12 }} />

                    {/* Imagen */}
                    <label style={st.miniLabel}>🖼️ Imagen</label>
                    {ev.imagen && (
                        <div style={{ position: 'relative', marginBottom: 8, maxWidth: 220 }}>
                            <img src={ev.imagen} alt="" onError={e => { e.target.style.display = 'none'; }} style={{ width: '100%', borderRadius: 8, maxHeight: 130, objectFit: 'cover', display: 'block' }} />
                            <button onClick={() => onChange({ imagen: '' })} style={st.removeImgBtn}>✕</button>
                        </div>
                    )}
                    <button onClick={() => setModoBuscador(p => !p)} style={st.buscarBtn}>
                        <Search size={14} /> {modoBuscador ? 'Cerrar buscador' : 'Buscar imagen'}
                    </button>
                    {modoBuscador && (
                        <div style={{ background: '#f5f7fa', borderRadius: 8, padding: 10, marginBottom: 10 }}>
                            <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                                <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} onKeyDown={e => e.key === 'Enter' && buscarImagenes()} placeholder="Buscar en Wikimedia Commons..." style={{ ...st.input, flex: 1 }} />
                                <button onClick={buscarImagenes} style={st.searchGoBtn}>{isSearching ? '...' : 'Buscar'}</button>
                            </div>
                            <input placeholder="O pega una URL de imagen..." style={{ ...st.input, fontSize: '0.78rem', marginBottom: 8 }}
                                onBlur={e => { if (e.target.value.startsWith('http')) elegirImagen(e.target.value); }}
                                onKeyDown={e => { if (e.key === 'Enter' && e.target.value.startsWith('http')) elegirImagen(e.target.value); }} />
                            {searchResults.length > 0 && (
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(72px,1fr))', gap: 5, maxHeight: 180, overflowY: 'auto' }}>
                                    {searchResults.map((url, i) => (
                                        <img key={i} src={url} alt="" onClick={() => elegirImagen(url)} onError={e => { e.target.style.display = 'none'; }}
                                            style={{ width: '100%', height: 60, objectFit: 'cover', borderRadius: 5, cursor: 'pointer', border: '2px solid transparent' }}
                                            onMouseEnter={e => { e.target.style.border = '2px solid #2980b9'; }} onMouseLeave={e => { e.target.style.border = '2px solid transparent'; }} />
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Vídeo */}
                    <label style={st.miniLabel}>▶️ Vídeo (YouTube / Vimeo)</label>
                    <input value={ev.video} onChange={e => onChange({ video: e.target.value })} placeholder="https://www.youtube.com/watch?v=..." style={{ ...st.input, marginBottom: 8 }} />
                    {ev.video && toEmbedUrl(ev.video) && (
                        <div style={{ position: 'relative', paddingBottom: '56.25%', borderRadius: 8, overflow: 'hidden', background: '#000', maxWidth: 320 }}>
                            <iframe src={toEmbedUrl(ev.video)} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 'none' }} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen title="preview" />
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

// ──────────────────────────────────────────────────────────
// MODAL DE CONFIGURACIÓN (búsqueda, estado, presentación)
// ──────────────────────────────────────────────────────────
function ConfigModal({ datos, setDatos, onClose }) {
    const [mediaTipo, setMediaTipo] = useState(() => datos.presentacion?.video ? 'video' : 'imagen');
    const [modoBuscador, setModoBuscador] = useState(false);
    const [q, setQ] = useState('');
    const [res, setRes] = useState([]);
    const [buscando, setBuscando] = useState(false);

    const buscar = async () => {
        if (!q.trim()) return;
        setBuscando(true);
        try {
            const r = await fetch(`https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrnamespace=6&gsrsearch=${encodeURIComponent(q)}&gsrlimit=24&prop=imageinfo&iiprop=url&iiurlwidth=400&format=json&origin=*`);
            const data = await r.json();
            const pages = data.query?.pages || {};
            setRes(Object.values(pages).map(p => { const i = p.imageinfo?.[0]; return i?.thumburl || i?.url; }).filter(u => u && /\.(jpe?g|png|gif|webp|svg)(\?|$)/i.test(u)));
        } catch { alert('Error buscando imágenes.'); }
        setBuscando(false);
    };
    const setPresImg = (url) => { setDatos(p => ({ ...p, presentacion: { ...(p.presentacion || {}), imagen: url } })); setModoBuscador(false); setRes([]); setQ(''); };
    const setPres = (campo, v) => setDatos(p => ({ ...p, presentacion: { ...(p.presentacion || {}), [campo]: v } }));

    return (
        <div style={st.modalOverlay}>
            <div style={st.modal}>
                <div style={st.modalHeader}>
                    <h3 style={{ margin: 0, color: '#2c3e50' }}>⚙️ Configuración del Recurso</h3>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={20} /></button>
                </div>
                <div style={st.modalBody}>
                    <div style={st.sectionTitle}>Datos de búsqueda</div>
                    <p style={{ fontSize: '0.75rem', color: '#999', marginTop: 0 }}>Permiten a los alumnos encontrar tu recurso en el buscador.</p>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                        <InputConf label="País"   val={datos.pais}   set={v => setDatos({ ...datos, pais: v })} />
                        <InputConf label="Región" val={datos.region} set={v => setDatos({ ...datos, region: v })} />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                        <InputConf label="Localidad"           val={datos.poblacion}      set={v => setDatos({ ...datos, poblacion: v })} />
                        <InputConf label="Nombre del profesor" val={datos.profesorNombre} set={v => setDatos({ ...datos, profesorNombre: v })} />
                    </div>
                    <InputConf label="Temas (separados por comas)" val={datos.temas} set={v => setDatos({ ...datos, temas: v })} />
                    <div style={{ marginBottom: 14 }}>
                        <label style={st.label}>Ciclo Educativo</label>
                        <select value={datos.ciclo || 'Secundaria'} onChange={e => setDatos({ ...datos, ciclo: e.target.value })} style={st.input}>
                            <option>Infantil</option><option>Primaria</option><option>Secundaria</option><option>Bachillerato</option><option>Otros</option>
                        </select>
                    </div>

                    <div style={st.sectionTitle}>Estado</div>
                    <ToggleRow label="Terminado (visible para alumnos)" checked={!!datos.isFinished} onChange={() => setDatos({ ...datos, isFinished: !datos.isFinished })} />
                    <ToggleRow label="Público (permite que otros lo vean y copien)" checked={!datos.isPrivate} onChange={() => setDatos({ ...datos, isPrivate: !datos.isPrivate })} />

                    <div style={st.sectionTitle}>🎬 Presentación previa</div>
                    <p style={{ fontSize: '0.75rem', color: '#999', marginTop: 0 }}>Pantalla introductoria antes de empezar el juego.</p>
                    <InputConf label="Título" val={datos.presentacion?.titulo} set={v => setPres('titulo', v)} />
                    <div style={{ marginBottom: 12 }}>
                        <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 'bold', color: '#555', marginBottom: 6 }}>Media</label>
                        <div style={{ display: 'flex', borderRadius: 8, overflow: 'hidden', border: '1px solid #ddd', marginBottom: 8 }}>
                            {[['imagen', '🖼️ Imagen'], ['video', '▶️ Vídeo']].map(([t, lbl]) => (
                                <button key={t} onClick={() => { setMediaTipo(t); setModoBuscador(false); setRes([]); }} style={{ flex: 1, padding: '7px 0', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '0.82rem', background: mediaTipo === t ? '#2980b9' : '#f5f5f5', color: mediaTipo === t ? 'white' : '#555' }}>{lbl}</button>
                            ))}
                        </div>
                        {mediaTipo === 'imagen' && (<>
                            {datos.presentacion?.imagen && (
                                <div style={{ position: 'relative', marginBottom: 8 }}>
                                    <img src={datos.presentacion.imagen} alt="" onError={e => { e.target.style.display = 'none'; }} style={{ width: '100%', borderRadius: 8, maxHeight: 110, objectFit: 'cover', display: 'block' }} />
                                    <button onClick={() => setPres('imagen', '')} style={st.removeImgBtn}>✕</button>
                                </div>
                            )}
                            <button onClick={() => setModoBuscador(p => !p)} style={{ ...st.input, background: '#e8f1f8', color: '#1f5f86', fontWeight: 'bold', border: '1px dashed #2980b9', cursor: 'pointer', textAlign: 'center', marginBottom: 6 }}>🔍 {modoBuscador ? 'Cerrar buscador' : 'Buscar imagen'}</button>
                            {modoBuscador && (
                                <div style={{ background: '#f5f5f5', borderRadius: 8, padding: 10, marginBottom: 8 }}>
                                    <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                                        <input value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => e.key === 'Enter' && buscar()} placeholder="Buscar en Wikimedia Commons..." style={{ ...st.input, flex: 1 }} />
                                        <button onClick={buscar} style={st.searchGoBtn}>{buscando ? '...' : 'Buscar'}</button>
                                    </div>
                                    <input placeholder="O pega una URL..." style={{ ...st.input, fontSize: '0.75rem', marginBottom: 8 }} onBlur={e => { if (e.target.value.startsWith('http')) setPresImg(e.target.value); }} onKeyDown={e => { if (e.key === 'Enter' && e.target.value.startsWith('http')) setPresImg(e.target.value); }} />
                                    {res.length > 0 && (
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(72px,1fr))', gap: 5, maxHeight: 170, overflowY: 'auto' }}>
                                            {res.map((url, i) => <img key={i} src={url} alt="" onClick={() => setPresImg(url)} onError={e => { e.target.style.display = 'none'; }} style={{ width: '100%', height: 60, objectFit: 'cover', borderRadius: 5, cursor: 'pointer' }} />)}
                                        </div>
                                    )}
                                </div>
                            )}
                        </>)}
                        {mediaTipo === 'video' && (
                            <input value={datos.presentacion?.video || ''} onChange={e => setPres('video', e.target.value)} placeholder="https://www.youtube.com/watch?v=..." style={{ ...st.input, marginBottom: 8 }} />
                        )}
                    </div>
                    <div style={{ marginBottom: 12 }}>
                        <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 'bold', color: '#555', marginBottom: 4 }}>Descripción</label>
                        <textarea value={datos.presentacion?.descripcion || ''} onChange={e => setPres('descripcion', e.target.value)} style={{ ...st.input, resize: 'vertical', minHeight: 58, fontFamily: 'inherit' }} placeholder="Texto introductorio..." />
                    </div>
                </div>
                <button onClick={onClose} style={st.closeBtn}>Aceptar</button>
            </div>
        </div>
    );
}

// ── Sub-componentes UI ──────────────────────────────────────
const InputConf = ({ label, val, set }) => (
    <div style={{ marginBottom: 12 }}>
        <label style={st.label}>{label}</label>
        <input value={val || ''} onChange={e => set(e.target.value)} style={st.input} />
    </div>
);
const ToggleRow = ({ label, checked, onChange }) => (
    <div onClick={onChange} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', background: '#f8fafc', borderRadius: 8, marginBottom: 8, cursor: 'pointer' }}>
        <span style={{ fontSize: '0.85rem', color: '#2c3e50' }}>{label}</span>
        <div style={{ width: 42, height: 24, borderRadius: 12, background: checked ? '#27ae60' : '#cbd5e1', position: 'relative', transition: 'background 0.2s' }}>
            <div style={{ position: 'absolute', top: 2, left: checked ? 20 : 2, width: 20, height: 20, borderRadius: '50%', background: 'white', transition: 'left 0.2s' }} />
        </div>
    </div>
);

// ── ESTILOS ─────────────────────────────────────────────────
const st = {
    overlay: { position: 'fixed', inset: 0, zIndex: 5000, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 },
    container: { width: '100%', height: '100%', maxWidth: 920, maxHeight: '100%', background: '#f1f5f9', display: 'flex', flexDirection: 'column', overflow: 'hidden', fontFamily: "'Segoe UI', sans-serif" },
    header: { background: 'linear-gradient(135deg,#2980b9,#1f5f86)', color: 'white', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10 },
    titleInput: { flex: 1, minWidth: 80, background: 'rgba(255,255,255,0.18)', border: '1px solid rgba(255,255,255,0.3)', borderRadius: 8, padding: '7px 12px', color: 'white', fontSize: '0.95rem', outline: 'none' },
    iconBtn: { background: 'rgba(255,255,255,0.15)', border: 'none', color: 'white', borderRadius: 8, width: 38, height: 38, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' },
    saveBtn: { background: '#27ae60', border: 'none', color: 'white', borderRadius: 8, padding: '8px 16px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' },
    tabsBar: { display: 'flex', alignItems: 'stretch', gap: 4, padding: '8px 10px 0', background: '#dde6f0', overflowX: 'auto', flexShrink: 0 },
    tab: { display: 'flex', alignItems: 'center', gap: 5, padding: '7px 10px', borderRadius: '8px 8px 0 0', cursor: 'pointer', whiteSpace: 'nowrap' },
    tabInput: { border: 'none', background: 'transparent', fontWeight: 700, fontSize: '0.82rem', width: 80, outline: 'none', color: 'inherit' },
    addTabBtn: { display: 'flex', alignItems: 'center', gap: 4, background: '#2980b9', color: 'white', border: 'none', borderRadius: '8px 8px 0 0', padding: '7px 12px', cursor: 'pointer', fontWeight: 700, fontSize: '0.8rem', whiteSpace: 'nowrap' },
    body: { flex: 1, overflowY: 'auto', padding: '16px 18px 60px' },
    modoRow: { display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 6 },
    modoBtn: { display: 'flex', alignItems: 'center', gap: 5, padding: '7px 12px', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '0.8rem' },
    vacio: { textAlign: 'center', padding: '40px 0' },
    evCard: { background: 'white', border: '1.5px solid #e2e8f0', borderRadius: 12, marginBottom: 10, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' },
    evHead: { display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px', cursor: 'pointer' },
    evFecha: { background: '#e8f1f8', color: '#1f5f86', fontWeight: 800, fontSize: '0.78rem', padding: '3px 9px', borderRadius: 20, whiteSpace: 'nowrap', flexShrink: 0 },
    evDelBtn: { background: '#fdecea', border: 'none', color: '#e74c3c', borderRadius: 7, width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' },
    evBody: { padding: '4px 14px 16px', borderTop: '1px solid #f1f5f9' },
    miniLabel: { display: 'block', fontSize: '0.72rem', fontWeight: 700, color: '#64748b', marginBottom: 4 },
    input: { width: '100%', boxSizing: 'border-box', padding: '8px 11px', borderRadius: 8, border: '1.5px solid #cbd5e1', fontSize: '0.88rem', outline: 'none', background: 'white' },
    buscarBtn: { display: 'inline-flex', alignItems: 'center', gap: 5, background: '#e8f1f8', color: '#1f5f86', border: '1px dashed #2980b9', borderRadius: 8, padding: '7px 14px', cursor: 'pointer', fontWeight: 700, fontSize: '0.8rem', marginBottom: 10 },
    searchGoBtn: { background: '#2980b9', color: 'white', border: 'none', borderRadius: 6, padding: '0 14px', cursor: 'pointer', fontWeight: 'bold', whiteSpace: 'nowrap' },
    removeImgBtn: { position: 'absolute', top: 4, right: 4, background: 'rgba(0,0,0,0.6)', border: 'none', color: 'white', borderRadius: '50%', width: 22, height: 22, cursor: 'pointer', fontSize: 13 },
    addEventoBtn: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, width: '100%', padding: '13px', background: 'white', color: '#2980b9', border: '2px dashed #2980b9', borderRadius: 12, cursor: 'pointer', fontWeight: 800, fontSize: '0.95rem', marginTop: 4 },
    // Modal config
    modalOverlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 6000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 14 },
    modal: { background: 'white', borderRadius: 16, width: '100%', maxWidth: 460, maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' },
    modalHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 18px', borderBottom: '1px solid #eee' },
    modalBody: { padding: '16px 18px', overflowY: 'auto' },
    sectionTitle: { fontWeight: 800, color: '#1f5f86', fontSize: '0.92rem', margin: '14px 0 6px', borderBottom: '2px solid #e8f1f8', paddingBottom: 4 },
    label: { display: 'block', fontSize: '0.75rem', fontWeight: 'bold', color: '#555', marginBottom: 4 },
    closeBtn: { margin: 14, padding: '11px', background: '#2980b9', color: 'white', border: 'none', borderRadius: 10, fontWeight: 700, cursor: 'pointer' },
};
