import React, { useState, useEffect, useRef } from 'react';
import { db } from '../firebase';
import { collection, doc, setDoc, getDocs, query, where } from 'firebase/firestore';
import {
    Save, X, Trash2, FolderPlus, Settings, Plus, ImageIcon,
    Search, Move, Crosshair, CheckCircle, RefreshCw, AlertCircle,
    Paintbrush, Eraser, Slash
} from 'lucide-react';
import PublicarModal from './PublicarModal';

// ──────────────────────────────────────────────────────────
// HELPERS
// ──────────────────────────────────────────────────────────
const generarCodigo = () =>
    Array.from({ length: 5 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ'[Math.floor(Math.random() * 24)]).join('');

const hojaVacia = (n) => ({ nombreHoja: `Diagrama ${n}`, imageUrl: '', markers: [] });

// ──────────────────────────────────────────────────────────
// EDITOR PRINCIPAL
// ──────────────────────────────────────────────────────────
export default function EditorEtiquetas({ datos, setDatos, onClose, usuario }) {
    const [hojaActiva, setHojaActiva]           = useState(0);
    const [mostrandoConfig, setMostrandoConfig] = useState(false);
    const [guardando, setGuardando]             = useState(false);
    const [modalPublicar, setModalPublicar]     = useState(null);
    const [guardadoOk, setGuardadoOk]           = useState(false);

    // Buscador de imágenes
    const [modoBuscador, setModoBuscador]       = useState(false);
    const [searchQuery, setSearchQuery]         = useState('');
    const [searchResults, setSearchResults]     = useState([]);
    const [isSearching, setIsSearching]         = useState(false);

    // Drag de etiquetas
    const [draggingId, setDraggingId]           = useState(null);
    const containerRef                          = useRef(null);

    // Lienzo de pintura
    const [modoLienzo, setModoLienzo]           = useState(false);

    // ── Inicialización ──────────────────────────────────
    useEffect(() => {
        setDatos(prev => ({
            ...prev,
            tipo:        'ETIQUETAS',
            tipoJuego:   'ETIQUETAS',
            pais:        prev.pais        || usuario?.pais       || '',
            region:      prev.region      || usuario?.region     || '',
            poblacion:   prev.poblacion   || usuario?.poblacion  || usuario?.localidad || '',
            ciclo:       prev.ciclo       || usuario?.ciclo      || 'Secundaria',
            temas:       prev.temas       || usuario?.temasPreferidos || '',
            profesorNombre: prev.profesorNombre || usuario?.displayName || usuario?.nombre || '',
            hojas: (!prev.hojas || prev.hojas.length === 0)
                ? [hojaVacia(1)]
                : prev.hojas,
        }));
    }, []);

    // ── Guardar en Firestore ────────────────────────────
    const guardar = async (extraDatos = {}) => {
        if (!datos.titulo?.trim()) return alert('Introduce un título para el recurso.');
        const hojas = datos.hojas || [];
        const conImagen = hojas.filter(h => h.imageUrl && h.markers?.length > 0);
        if (conImagen.length === 0) return alert('Añade al menos una imagen con etiquetas antes de guardar.');
        const datosEfectivos = { ...datos, ...extraDatos };

        setGuardando(true);
        try {
            let docId = datos.id;
            let code  = datos.accessCode;

            if (!code) {
                const checkRef = collection(db, 'resources');
                let intento = generarCodigo();
                const snap  = await getDocs(query(checkRef, where('accessCode', '==', intento)));
                if (!snap.empty) intento = generarCodigo() + Math.floor(Math.random() * 9);
                code = intento;
            }
            if (!docId) docId = `etiq_${Date.now()}`;

            const payload = {
                ...datosEfectivos,
                id:            docId,
                accessCode:    code,
                profesorUid:   usuario?.uid || '',
                hojas,
                creadoEn:      datosEfectivos.creadoEn || Date.now(),
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

    // ── Gestión de Hojas ────────────────────────────────
    const addHoja = () => {
        const hojas = [...(datos.hojas || []), hojaVacia((datos.hojas?.length || 0) + 1)];
        setDatos({ ...datos, hojas });
        setHojaActiva(hojas.length - 1);
    };
    const deleteHoja = (idx) => {
        if ((datos.hojas?.length || 0) <= 1) return alert('Debe haber al menos un diagrama.');
        if (!window.confirm('¿Borrar este diagrama y sus etiquetas?')) return;
        const hojas = datos.hojas.filter((_, i) => i !== idx);
        setDatos({ ...datos, hojas });
        setHojaActiva(0);
    };
    const renameHoja = (idx, val) => {
        const hojas = [...datos.hojas];
        hojas[idx].nombreHoja = val;
        setDatos({ ...datos, hojas });
    };
    const updateHoja = (nuevosDatos) => {
        setDatos(prev => {
            const hojas = [...(prev.hojas || [])];
            hojas[hojaActiva] = { ...hojas[hojaActiva], ...nuevosDatos };
            return { ...prev, hojas };
        });
    };

    const hojaActual = datos.hojas?.[hojaActiva] || hojaVacia(1);
    const markers    = hojaActual.markers || [];
    const totalMarcadores = (datos.hojas || []).reduce((s, h) => s + (h.markers?.length || 0), 0);

    // ── Buscador Wikimedia ──────────────────────────────
    const buscarImagenes = async () => {
        if (!searchQuery.trim()) return;
        setIsSearching(true);
        try {
            const res  = await fetch(
                `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrnamespace=6&gsrsearch=${encodeURIComponent(searchQuery)}&gsrlimit=16&prop=imageinfo&iiprop=url&format=json&origin=*`
            );
            const data = await res.json();
            const pages = data.query?.pages || {};
            const urls  = Object.values(pages)
                .map(p => p.imageinfo?.[0]?.url)
                .filter(u => u && /\.(jpg|jpeg|png|gif|svg|webp)$/i.test(u));
            setSearchResults(urls);
        } catch {
            alert('Error buscando imágenes. Prueba a pegar la URL directamente.');
        }
        setIsSearching(false);
    };

    // ── Click en imagen → crear etiqueta ───────────────
    const handleImageClick = (e) => {
        if (!hojaActual.imageUrl || draggingId) return;
        const rect = containerRef.current.getBoundingClientRect();
        const x    = ((e.clientX - rect.left)  / rect.width)  * 100;
        const y    = ((e.clientY - rect.top)   / rect.height) * 100;

        // Posición inicial de la caja: desplazada 15% hacia el borde más alejado
        const labelX = x > 50 ? Math.min(95, x + 15) : Math.max(5, x - 15);
        const labelY = y > 50 ? Math.min(95, y + 12) : Math.max(5, y - 12);

        const newMarker = {
            id:       Date.now().toString(),
            anchorX:  x,
            anchorY:  y,
            labelX,
            labelY,
            text:     ''
        };
        updateHoja({ markers: [...markers, newMarker] });
    };

    // ── Drag de caja de texto ───────────────────────────
    useEffect(() => {
        if (!draggingId) return;
        const handleMove = (e) => {
            if (!containerRef.current) return;
            const rect = containerRef.current.getBoundingClientRect();
            const newX = Math.max(1, Math.min(99, ((e.clientX - rect.left)  / rect.width)  * 100));
            const newY = Math.max(1, Math.min(99, ((e.clientY - rect.top)   / rect.height) * 100));
            setDatos(prev => {
                const hojas = [...prev.hojas];
                const hoja  = { ...hojas[hojaActiva] };
                hoja.markers = hoja.markers.map(m =>
                    m.id === draggingId ? { ...m, labelX: newX, labelY: newY } : m
                );
                hojas[hojaActiva] = hoja;
                return { ...prev, hojas };
            });
        };
        const handleUp = () => setDraggingId(null);
        window.addEventListener('pointermove', handleMove);
        window.addEventListener('pointerup',   handleUp);
        return () => {
            window.removeEventListener('pointermove', handleMove);
            window.removeEventListener('pointerup',   handleUp);
        };
    }, [draggingId, hojaActiva]);

    const updateTexto = (id, texto) =>
        updateHoja({ markers: markers.map(m => m.id === id ? { ...m, text: texto } : m) });

    const eliminarEtiqueta = (id) =>
        updateHoja({ markers: markers.filter(m => m.id !== id) });

    // ── Render ──────────────────────────────────────────
    return (
        <div style={st.overlay}>
            <div style={st.container}>

                {/* ── HEADER ── */}
                <div style={st.header}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
                        <Crosshair size={22} />
                        <span style={{ fontWeight: 'bold', whiteSpace: 'nowrap' }}>Editor Etiquetas</span>
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
                            {guardando
                                ? <RefreshCw size={16} style={{ animation: 'spin 1s linear infinite' }} />
                                : <Save size={16} />}
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
                            onClick={() => { setHojaActiva(i); setModoBuscador(false); }}
                            style={{
                                ...st.tab,
                                background:   i === hojaActiva ? 'white' : '#e8eaf6',
                                borderBottom: i === hojaActiva ? '3px solid #e74c3c' : 'none',
                                color:        i === hojaActiva ? '#c0392b' : '#666',
                            }}
                        >
                            <ImageIcon size={13} />
                            <input
                                value={h.nombreHoja}
                                onChange={e => renameHoja(i, e.target.value)}
                                style={st.tabInput}
                                onClick={e => e.stopPropagation()}
                            />
                            <span style={{ fontSize: '0.7rem', color: '#999' }}>
                                ({(h.markers || []).length} ✎)
                            </span>
                            {(datos.hojas?.length || 0) > 1 && (
                                <Trash2
                                    size={13}
                                    onClick={e => { e.stopPropagation(); deleteHoja(i); }}
                                    style={{ cursor: 'pointer', color: '#c62828', marginLeft: 2 }}
                                />
                            )}
                        </div>
                    ))}
                    <button onClick={addHoja} style={st.addTabBtn} title="Nuevo diagrama">
                        <FolderPlus size={19} />
                    </button>
                </div>

                {/* ── BODY ── */}
                <div style={st.body}>

                    {/* Código de acceso */}
                    <div style={st.codeCard}>
                        <div>
                            <div style={{ fontWeight: 'bold', color: '#e74c3c', fontSize: '0.9rem' }}>Código de Acceso</div>
                            <div style={{ fontSize: '0.75rem', color: '#888', marginTop: 2 }}>
                                {totalMarcadores} etiqueta{totalMarcadores !== 1 ? 's' : ''} en total ·
                                Los alumnos buscan el recurso con este código en la app.
                            </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <span style={{ fontSize: '1.6rem', fontWeight: 900, letterSpacing: 4, color: '#333' }}>
                                {datos.accessCode || '─────'}
                            </span>
                            {!datos.accessCode && (
                                <span style={{ fontSize: '0.7rem', color: '#e74c3c' }}>Se genera al guardar</span>
                            )}
                        </div>
                    </div>

                    {/* ── PANEL DE IMAGEN ── */}
                    <div style={st.panel}>
                        <h3 style={st.panelTitle}>
                            🖼️ Imagen — «{hojaActual.nombreHoja}»
                        </h3>

                        {/* URL + buscador */}
                        <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                            <input
                                value={hojaActual.imageUrl || ''}
                                onChange={e => updateHoja({ imageUrl: e.target.value })}
                                placeholder="🔗 Pega la URL de la imagen aquí..."
                                style={st.inputUrl}
                            />
                            <button
                                onClick={() => setModoBuscador(b => !b)}
                                style={{ ...st.btnSecondary, background: modoBuscador ? '#2c3e50' : '#ecf0f1', color: modoBuscador ? 'white' : '#333' }}
                            >
                                <Search size={16} /> {modoBuscador ? 'Ocultar' : 'Buscar imagen'}
                            </button>
                            {hojaActual.imageUrl && (
                                <button
                                    onClick={() => updateHoja({ imageUrl: '', markers: [] })}
                                    style={{ ...st.btnSecondary, background: '#fdecea', color: '#c62828' }}
                                    title="Quitar imagen y etiquetas"
                                >
                                    <Trash2 size={16} />
                                </button>
                            )}
                        </div>

                        {/* Panel buscador */}
                        {modoBuscador && (
                            <div style={st.searchPanel}>
                                <p style={{ margin: '0 0 8px', fontSize: '0.8rem', color: '#555' }}>
                                    Búsqueda en Wikimedia Commons (imágenes libres de derechos)
                                </p>
                                <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                                    <input
                                        value={searchQuery}
                                        onChange={e => setSearchQuery(e.target.value)}
                                        onKeyDown={e => e.key === 'Enter' && buscarImagenes()}
                                        placeholder="Ej: célula vegetal, corazón humano, mapa Europa..."
                                        style={st.inputUrl}
                                    />
                                    <button onClick={buscarImagenes} style={st.saveBtn}>
                                        {isSearching ? '...' : 'Buscar'}
                                    </button>
                                </div>
                                {searchResults.length > 0 && (
                                    <div style={st.galleryGrid}>
                                        {searchResults.map((url, i) => (
                                            <img
                                                key={i}
                                                src={url}
                                                alt="resultado"
                                                onClick={() => { updateHoja({ imageUrl: url, markers: [] }); setModoBuscador(false); setSearchResults([]); }}
                                                style={st.thumb}
                                                onError={e => e.target.style.display = 'none'}
                                            />
                                        ))}
                                    </div>
                                )}
                                {searchResults.length === 0 && !isSearching && searchQuery && (
                                    <p style={{ textAlign: 'center', color: '#999', fontSize: '0.85rem' }}>
                                        Sin resultados. Prueba otro término o pega una URL directamente.
                                    </p>
                                )}
                            </div>
                        )}
                    </div>

                    {/* ── ZONA DE ETIQUETADO ── */}
                    {!hojaActual.imageUrl ? (
                        <div style={st.emptyState}>
                            <ImageIcon size={60} color="#bdc3c7" />
                            <h3 style={{ color: '#95a5a6' }}>Sin imagen</h3>
                            <p style={{ color: '#bdc3c7' }}>Pega una URL o usa el buscador para empezar a etiquetar.</p>
                        </div>
                    ) : (
                        <div style={st.panel}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
                                <h3 style={{ ...st.panelTitle, margin: 0 }}>
                                    ✏️ Etiquetado — {markers.length} etiqueta{markers.length !== 1 ? 's' : ''}
                                </h3>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                        <button
                                            onClick={() => setModoLienzo(b => !b)}
                                            style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', borderRadius: 20, border: 'none', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.8rem', background: modoLienzo ? '#8e44ad' : '#f0f0f0', color: modoLienzo ? 'white' : '#555' }}
                                            title={modoLienzo ? 'Modo lienzo activo — clic para volver a etiquetar' : 'Activar lienzo para tapar etiquetas de la imagen'}
                                        >
                                            <Paintbrush size={14} /> {modoLienzo ? 'Lienzo activo' : 'Lienzo'}
                                        </button>
                                        {!modoLienzo && (
                                            <span style={{ fontSize: '0.8rem', color: '#e67e22', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 4 }}>
                                                <Plus size={14} /> Clic en imagen para añadir etiquetas
                                            </span>
                                        )}
                                    </div>
                                    {markers.length > 0 && (
                                        <button
                                            onClick={() => { if (window.confirm('¿Borrar todas las etiquetas de esta imagen?')) updateHoja({ markers: [] }); }}
                                            style={{ ...st.btnSecondary, background: '#fdecea', color: '#c62828', fontSize: '0.8rem', padding: '5px 10px' }}
                                        >
                                            <Trash2 size={13} /> Borrar todas
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* CANVAS — imagen + etiquetas */}
                            {/* El wrapper NO tiene overflow:hidden para que las etiquetas
                                puedan salir más allá del borde de la imagen */}
                            <div style={{ textAlign: 'center' }}>
                                <div
                                    ref={containerRef}
                                    style={st.imageWrapper}
                                >
                                    {/* 1. IMAGEN */}
                                    <img
                                        src={hojaActual.imageUrl}
                                        alt="diagrama"
                                        onPointerDown={(e) => {
                                            if (modoLienzo) return; // en modo lienzo el canvas captura los eventos
                                            if (e.target.closest('[data-drag-handle]')) return;
                                            handleImageClick(e);
                                        }}
                                        style={st.image}
                                        draggable="false"
                                        onError={e => { e.target.style.border = '2px solid #e74c3c'; e.target.alt = 'Error cargando imagen'; }}
                                    />

                                    {/* 2. LIENZO DE PINTURA — entre imagen y etiquetas */}
                                    <PaintLayer
                                        paintData={hojaActual.paintData || null}
                                        onSave={base64 => updateHoja({ paintData: base64 })}
                                        active={modoLienzo}
                                        onClose={() => setModoLienzo(false)}
                                    />

                                    {/* 3. SVG de líneas — overflow:visible para que las líneas
                                        lleguen a etiquetas fuera del borde */}
                                    <svg style={st.svgOverlay}>
                                        <defs>
                                            <marker id="arrowhead" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
                                                <polygon points="0 0, 8 3, 0 6" fill="#e74c3c" />
                                            </marker>
                                        </defs>
                                        {markers.map(m => (
                                            <line
                                                key={`line-${m.id}`}
                                                x1={`${m.anchorX}%`} y1={`${m.anchorY}%`}
                                                x2={`${m.labelX}%`}  y2={`${m.labelY}%`}
                                                stroke="#e74c3c"
                                                strokeWidth="2"
                                                markerEnd="url(#arrowhead)"
                                            />
                                        ))}
                                    </svg>

                                    {/* 4. PUNTOS DE ANCLAJE */}
                                    {markers.map((m, index) => (
                                        <div
                                            key={`anchor-${m.id}`}
                                            style={{ ...st.anchorDot, left: `${m.anchorX}%`, top: `${m.anchorY}%` }}
                                            title={`Punto ${index + 1}: ${m.text || '(sin texto)'}`}
                                        >
                                            <span style={st.anchorNum}>{index + 1}</span>
                                            <div style={st.anchorPulse} />
                                        </div>
                                    ))}

                                    {/* 5. CAJAS DE ETIQUETA */}
                                    {markers.map((m, index) => (
                                        <div
                                            key={`label-${m.id}`}
                                            style={{
                                                ...st.labelBox,
                                                left:   `${m.labelX}%`,
                                                top:    `${m.labelY}%`,
                                                zIndex: draggingId === m.id ? 100 : 10,
                                                cursor: draggingId === m.id ? 'grabbing' : 'default',
                                            }}
                                        >
                                            {/* Handle de arrastre */}
                                            <div
                                                data-drag-handle="true"
                                                onPointerDown={(e) => { e.stopPropagation(); e.preventDefault(); setDraggingId(m.id); }}
                                                style={st.dragHandle}
                                                title="Arrastrar etiqueta"
                                            >
                                                <Move size={13} />
                                            </div>

                                            {/* Número + input */}
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 6px' }}>
                                                <span style={st.labelNumber}>{index + 1}</span>
                                                <input
                                                    value={m.text}
                                                    onChange={e => updateTexto(m.id, e.target.value)}
                                                    placeholder="Etiqueta..."
                                                    style={{
                                                        ...st.labelInput,
                                                        width: `${Math.max(7, (m.text?.length || 0) + 2)}ch`,
                                                    }}
                                                    onPointerDown={e => e.stopPropagation()}
                                                />
                                            </div>

                                            {/* Borrar */}
                                            <button
                                                onClick={e => { e.stopPropagation(); eliminarEtiqueta(m.id); }}
                                                style={st.deleteBtn}
                                                title="Borrar etiqueta"
                                                onPointerDown={e => e.stopPropagation()}
                                            >
                                                <X size={12} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Lista resumen de etiquetas */}
                            {markers.length > 0 && (
                                <div style={{ marginTop: 16 }}>
                                    <div style={st.stepLabel}>Etiquetas definidas</div>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                                        {markers.map((m, i) => (
                                            <div key={m.id} style={{
                                                display: 'flex', alignItems: 'center', gap: 4,
                                                background: m.text ? '#e8f8f0' : '#fdecea',
                                                border: `1px solid ${m.text ? '#27ae60' : '#e74c3c'}`,
                                                borderRadius: 20, padding: '3px 10px', fontSize: '0.8rem',
                                            }}>
                                                <span style={{ fontWeight: 'bold', color: '#e74c3c' }}>{i + 1}</span>
                                                <span style={{ color: '#2c3e50' }}>{m.text || <em style={{ color: '#e74c3c' }}>sin texto</em>}</span>
                                                {!m.text && <AlertCircle size={12} color="#e74c3c" />}
                                            </div>
                                        ))}
                                    </div>
                                    {markers.some(m => !m.text) && (
                                        <p style={{ fontSize: '0.75rem', color: '#e74c3c', marginTop: 6 }}>
                                            ⚠️ Hay etiquetas sin texto — el alumno no podrá responderlas correctamente.
                                        </p>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                </div>{/* end body */}

                {/* ── MODAL CONFIGURACIÓN ── */}
                {modalPublicar && (
                    <PublicarModal
                        modo={modalPublicar}
                        onGuardarPublicar={async () => { await guardar({ isFinished: true }); setModalPublicar(null); if (modalPublicar === 'cerrar') onClose(); }}
                        onGuardarSolo={async () => { await guardar(); setModalPublicar(null); if (modalPublicar === 'cerrar') onClose(); }}
                        onSalirSinGuardar={() => { setModalPublicar(null); onClose(); }}
                        onCancelar={() => setModalPublicar(null)}
                    />
                )}
                {mostrandoConfig && (
                    <div style={st.modalOverlay}>
                        <div style={st.modal}>
                            <div style={st.modalHeader}>
                                <h3 style={{ margin: 0, color: '#2c3e50' }}>⚙️ Configuración del Recurso</h3>
                                <button onClick={() => setMostrandoConfig(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                                    <X size={20} />
                                </button>
                            </div>
                            <div style={st.modalBody}>
                                <SectionTitle>Datos de Búsqueda</SectionTitle>
                                <p style={{ fontSize: '0.75rem', color: '#999', marginTop: 0 }}>
                                    Permiten a los alumnos encontrar tu recurso en el buscador de la app.
                                </p>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                                    <InputConf label="País"   val={datos.pais}    set={v => setDatos({ ...datos, pais: v })} />
                                    <InputConf label="Región" val={datos.region}  set={v => setDatos({ ...datos, region: v })} />
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                                    <InputConf label="Localidad"           val={datos.poblacion}      set={v => setDatos({ ...datos, poblacion: v })} />
                                    <InputConf label="Nombre del profesor" val={datos.profesorNombre} set={v => setDatos({ ...datos, profesorNombre: v })} />
                                </div>
                                <InputConf label="Temas (separados por comas)" val={datos.temas} set={v => setDatos({ ...datos, temas: v })} />
                                <div style={{ marginBottom: 14 }}>
                                    <label style={st.label}>Ciclo Educativo</label>
                                    <select
                                        value={datos.ciclo || 'Secundaria'}
                                        onChange={e => setDatos({ ...datos, ciclo: e.target.value })}
                                        style={st.input}
                                    >
                                        <option>Infantil</option>
                                        <option>Primaria</option>
                                        <option>Secundaria</option>
                                        <option>Bachillerato</option>
                                        <option>Otros</option>
                                    </select>
                                </div>

                                <SectionTitle>Estado</SectionTitle>
                                <ToggleRow
                                    label="Terminado (visible para alumnos)"
                                    checked={!!datos.isFinished}
                                    onChange={() => setDatos({ ...datos, isFinished: !datos.isFinished })}
                                />
                                <ToggleRow
                                    label="Público (permite que otros lo vean y copien)"
                                    checked={!datos.isPrivate}
                                    onChange={() => setDatos({ ...datos, isPrivate: !datos.isPrivate })}
                                />
                            </div>
                            <button onClick={() => setMostrandoConfig(false)} style={st.closeBtn}>Aceptar</button>
                        </div>
                    </div>
                )}

            </div>
            <style>{`
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
                @keyframes pulse { 0% { transform: scale(0.9); opacity: 1; } 100% { transform: scale(1.6); opacity: 0; } }
            `}</style>
        </div>
    );
}


// ── Lienzo de pintura ────────────────────────────────────────────────────────
// Se coloca entre la imagen (z:0) y el SVG de líneas (z:2).
// El profesor puede pintar encima de la imagen para tapar etiquetas existentes.
// El contenido se guarda como base64 PNG en hojaActual.paintData.
function PaintLayer({ paintData, onSave, active, onClose }) {
    const canvasRef    = useRef(null);
    const drawing      = useRef(false);
    const lastPos      = useRef(null);
    const [tool,  setTool]  = useState('PINCEL');  // 'PINCEL' | 'GOMA' | 'RELLENO'
    const [color, setColor] = useState('#ffffff');
    const [size,  setSize]  = useState(20);
    const [showBar, setShowBar] = useState(false);

    // Cargar paintData en el canvas cuando cambia (cambio de hoja)
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (paintData) {
            const img = new Image();
            img.onload = () => { ctx.clearRect(0, 0, canvas.width, canvas.height); ctx.drawImage(img, 0, 0); };
            img.src = paintData;
        } else {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
    }, [paintData]);

    // Ajustar tamaño del canvas al tamaño real del elemento
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ro = new ResizeObserver(() => {
            const { width, height } = canvas.getBoundingClientRect();
            // Guardar contenido actual
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = canvas.width; tempCanvas.height = canvas.height;
            tempCanvas.getContext('2d').drawImage(canvas, 0, 0);
            canvas.width  = width;
            canvas.height = height;
            canvas.getContext('2d').drawImage(tempCanvas, 0, 0);
        });
        ro.observe(canvas);
        return () => ro.disconnect();
    }, []);

    const getPos = (e) => {
        const rect = canvasRef.current.getBoundingClientRect();
        return {
            x: (e.clientX - rect.left) * (canvasRef.current.width  / rect.width),
            y: (e.clientY - rect.top)  * (canvasRef.current.height / rect.height),
        };
    };

    const floodFill = (ctx, startX, startY, fillColor) => {
        const canvas = canvasRef.current;
        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imgData.data;
        const idx = (y, x) => (y * canvas.width + x) * 4;
        const target = [...data.slice(idx(startY, startX), idx(startY, startX) + 4)];
        const fill   = fillColor.match(/\w\w/g).map(h => parseInt(h, 16));
        const match  = (i) => data[i]===target[0] && data[i+1]===target[1] && data[i+2]===target[2];
        if (match(idx(startY, startX)) && target[0]===fill[0] && target[1]===fill[1] && target[2]===fill[2]) return;
        const stack = [[startX, startY]];
        while (stack.length) {
            const [x, y] = stack.pop();
            if (x < 0 || x >= canvas.width || y < 0 || y >= canvas.height) continue;
            const i = idx(y, x);
            if (!match(i)) continue;
            data[i]=fill[0]; data[i+1]=fill[1]; data[i+2]=fill[2]; data[i+3]=255;
            stack.push([x+1,y],[x-1,y],[x,y+1],[x,y-1]);
        }
        ctx.putImageData(imgData, 0, 0);
    };

    const onPointerDown = (e) => {
        if (!active) return;
        e.stopPropagation(); e.preventDefault();
        drawing.current = true;
        const pos = getPos(e);
        lastPos.current = pos;
        const ctx = canvasRef.current.getContext('2d');
        if (tool === 'RELLENO') {
            floodFill(ctx, Math.round(pos.x), Math.round(pos.y), color.replace('#',''));
            onSave(canvasRef.current.toDataURL('image/png'));
            drawing.current = false;
            return;
        }
        // Punto inicial
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, (tool==='GOMA' ? size*1.5 : size) / 2, 0, Math.PI*2);
        ctx.fillStyle = tool === 'GOMA' ? 'rgba(0,0,0,0)' : color;
        if (tool === 'GOMA') ctx.clearRect(pos.x - size, pos.y - size, size*2, size*2);
        else ctx.fill();
    };

    const onPointerMove = (e) => {
        if (!active || !drawing.current) return;
        const pos = getPos(e);
        const ctx = canvasRef.current.getContext('2d');
        if (tool === 'GOMA') {
            ctx.clearRect(pos.x - size, pos.y - size, size*3, size*3);
        } else {
            ctx.beginPath();
            ctx.moveTo(lastPos.current.x, lastPos.current.y);
            ctx.lineTo(pos.x, pos.y);
            ctx.strokeStyle = color;
            ctx.lineWidth   = size;
            ctx.lineCap     = 'round';
            ctx.lineJoin    = 'round';
            ctx.stroke();
        }
        lastPos.current = pos;
    };

    const onPointerUp = () => {
        if (!drawing.current) return;
        drawing.current = false;
        onSave(canvasRef.current.toDataURL('image/png'));
    };

    const limpiar = () => {
        const canvas = canvasRef.current;
        canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
        onSave(null);
    };

    const COLORS_PRESET = ['#ffffff','#000000','#e74c3c','#f39c12','#2ecc71'];

    return (
        <>
            {/* Barra de herramientas — solo visible si active */}
            {active && (
                <div style={{
                    position: 'absolute', top: -50, left: '50%', transform: 'translateX(-50%)',
                    zIndex: 30, display: 'flex', alignItems: 'center', gap: 6,
                    background: 'white', borderRadius: 30, padding: '5px 12px',
                    boxShadow: '0 4px 16px rgba(0,0,0,0.18)', whiteSpace: 'nowrap',
                }}>
                    {/* Herramientas */}
                    {[['PINCEL','🖌️','Pincel'],['GOMA','🧹','Goma'],['RELLENO','🪣','Rellenar zona']].map(([t, emoji, label]) => (
                        <button key={t} onClick={() => setTool(t)} title={label} style={{
                            padding: '4px 9px', borderRadius: 20, border: 'none', cursor: 'pointer',
                            background: tool === t ? '#8e44ad' : '#f0f0f0',
                            color: tool === t ? 'white' : '#555',
                            fontWeight: 'bold', fontSize: '0.8rem',
                        }}>
                            {emoji}
                        </button>
                    ))}

                    <div style={{ width: 1, height: 20, background: '#eee' }} />

                    {/* Colores preset */}
                    {COLORS_PRESET.map(c => (
                        <div key={c} onClick={() => { setColor(c); setTool('PINCEL'); }} style={{
                            width: 20, height: 20, borderRadius: '50%', background: c,
                            border: color === c ? '3px solid #8e44ad' : '2px solid #ccc',
                            cursor: 'pointer', flexShrink: 0,
                        }} title={c} />
                    ))}

                    {/* Color personalizado */}
                    <input type="color" value={color} onChange={e => { setColor(e.target.value); setTool('PINCEL'); }}
                        style={{ width: 26, height: 26, padding: 0, border: 'none', borderRadius: '50%', cursor: 'pointer' }}
                        title="Color personalizado"
                    />

                    <div style={{ width: 1, height: 20, background: '#eee' }} />

                    {/* Tamaño */}
                    <span style={{ fontSize: '0.72rem', color: '#888' }}>Tamaño</span>
                    <input type="range" min="4" max="80" value={size} onChange={e => setSize(+e.target.value)}
                        style={{ width: 70 }} title={`Tamaño: ${size}px`} />
                    <span style={{ fontSize: '0.72rem', color: '#555', minWidth: 24 }}>{size}px</span>

                    <div style={{ width: 1, height: 20, background: '#eee' }} />

                    {/* Limpiar todo */}
                    <button onClick={limpiar} title="Borrar todo el lienzo" style={{
                        padding: '4px 9px', borderRadius: 20, border: 'none', cursor: 'pointer',
                        background: '#fdecea', color: '#c62828', fontWeight: 'bold', fontSize: '0.8rem',
                    }}>
                        🗑️ Limpiar
                    </button>

                    <div style={{ width: 1, height: 20, background: '#eee' }} />

                    {/* Cerrar barra — el lienzo queda visible pero se puede etiquetar */}
                    <button onClick={onClose} title="Cerrar herramientas — el lienzo queda visible" style={{
                        padding: '4px 10px', borderRadius: 20, border: 'none', cursor: 'pointer',
                        background: '#2c3e50', color: 'white', fontWeight: 'bold', fontSize: '0.8rem',
                        display: 'flex', alignItems: 'center', gap: 4,
                    }}>
                        ✓ Cerrar herramientas
                    </button>
                </div>
            )}

            {/* Canvas */}
            <canvas
                ref={canvasRef}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerLeave={onPointerUp}
                style={{
                    position:  'absolute', top: 0, left: 0,
                    width:     '100%',     height: '100%',
                    zIndex:    1,
                    cursor:    active ? (tool === 'GOMA' ? 'cell' : tool === 'RELLENO' ? 'crosshair' : 'crosshair') : 'crosshair',
                    pointerEvents: active ? 'auto' : 'none',
                    touchAction: 'none',
                }}
            />
        </>
    );
}

// ── Sub-componentes ─────────────────────────────────────
const SectionTitle = ({ children }) => (
    <h4 style={{ margin: '16px 0 8px', color: '#e74c3c', borderBottom: '2px solid #fdecea', paddingBottom: 5, fontSize: '0.82rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
        {children}
    </h4>
);
const InputConf = ({ label, val, set }) => (
    <div style={{ marginBottom: 12 }}>
        <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 'bold', color: '#555', marginBottom: 4 }}>{label}</label>
        <input value={val || ''} onChange={e => set(e.target.value)} style={st.input} />
    </div>
);
const ToggleRow = ({ label, checked, onChange }) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, padding: '10px 12px', background: '#fef9f9', borderRadius: 8 }}>
        <span style={{ fontSize: '0.85rem', color: '#444' }}>{label}</span>
        <input type="checkbox" checked={checked} onChange={onChange} style={{ width: 18, height: 18, cursor: 'pointer' }} />
    </div>
);

// ── Estilos ─────────────────────────────────────────────
const st = {
    overlay:    { position: 'fixed', inset: 0, background: '#f0f2f5', zIndex: 3000, display: 'flex', justifyContent: 'center' },
    container:  { display: 'flex', flexDirection: 'column', height: '100%', width: '100%', maxWidth: 1100, margin: '0 auto', background: 'white', boxShadow: '0 0 20px rgba(0,0,0,0.1)' },

    header:     { background: '#2c3e50', padding: '13px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'white', gap: 10 },
    titleInput: { background: 'rgba(255,255,255,0.18)', border: 'none', color: 'white', fontSize: '1rem', padding: '5px 10px', borderRadius: 6, flex: 1, outline: 'none' },
    iconBtn:    { background: 'none', border: 'none', color: 'white', cursor: 'pointer', padding: 5 },
    saveBtn:    { background: '#e74c3c', border: 'none', color: 'white', padding: '8px 16px', borderRadius: 20, display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer', fontWeight: 'bold', fontSize: '0.9rem', whiteSpace: 'nowrap' },

    tabsBar:    { background: '#fef9f9', padding: '10px 10px 0', display: 'flex', gap: 5, overflowX: 'auto', borderBottom: '1px solid #f5c6c6' },
    tab:        { padding: '9px 12px', borderRadius: '10px 10px 0 0', cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 5, minWidth: 90, flexShrink: 0 },
    tabInput:   { border: 'none', background: 'transparent', fontWeight: 'bold', width: 80, outline: 'none', color: 'inherit', fontSize: '0.85rem' },
    addTabBtn:  { padding: '8px 10px', background: 'transparent', border: 'none', cursor: 'pointer', color: '#e74c3c' },

    body:       { flex: 1, padding: '16px', overflowY: 'auto', background: '#f8f9fa', display: 'flex', flexDirection: 'column', gap: 14 },

    codeCard:   { background: 'white', padding: '14px 18px', borderRadius: 12, border: '1px solid #f5c6c6', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 },
    panel:      { background: 'white', borderRadius: 14, padding: '18px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' },
    panelTitle: { margin: '0 0 12px', color: '#2c3e50', fontSize: '1rem', fontWeight: 'bold' },
    stepLabel:  { fontWeight: 'bold', color: '#e74c3c', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.5px' },

    inputUrl:   { flex: 1, padding: '10px 12px', borderRadius: 8, border: '1px solid #ddd', outline: 'none', fontSize: '0.95rem' },
    btnSecondary: { border: 'none', padding: '9px 13px', borderRadius: 8, cursor: 'pointer', display: 'flex', gap: 5, alignItems: 'center', fontWeight: 'bold', fontSize: '0.85rem', whiteSpace: 'nowrap' },
    searchPanel:{ background: '#fef9f9', padding: '14px', borderRadius: 10, border: '1px solid #f5c6c6' },
    galleryGrid:{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: 8, maxHeight: 200, overflowY: 'auto' },
    thumb:      { width: '100%', height: 90, objectFit: 'cover', borderRadius: 6, cursor: 'pointer', border: '2px solid transparent', transition: '0.2s' },

    emptyState: { textAlign: 'center', padding: '40px 20px', color: '#95a5a6', background: 'white', borderRadius: 14 },

    // ── Canvas de etiquetado ──
    // Sin overflow:hidden → las etiquetas pueden salir del borde de la imagen
    imageWrapper: {
        position: 'relative',
        display: 'inline-block',
        maxWidth: '100%',
        boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
        borderRadius: 10,
        background: '#f8f9fa',
        // padding extra para que haya margen alrededor donde poner las etiquetas
        padding: 60,
        boxSizing: 'border-box',
    },
    image: {
        display: 'block',
        maxWidth: '100%',
        maxHeight: '60vh',
        objectFit: 'contain',
        cursor: 'crosshair',
        userSelect: 'none',
        borderRadius: 6,
        pointerEvents: 'auto',
    },
    // overflow: visible → las líneas pueden salir fuera del bounding box del SVG
    svgOverlay: {
        position: 'absolute', top: 0, left: 0,
        width: '100%', height: '100%',
        pointerEvents: 'none',
        zIndex: 2,
        overflow: 'visible',
    },

    anchorDot:  { position: 'absolute', width: 16, height: 16, background: '#e74c3c', borderRadius: '50%', transform: 'translate(-50%, -50%)', zIndex: 5, border: '2px solid white', boxShadow: '0 2px 6px rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'default' },
    anchorNum:  { fontSize: 9, fontWeight: 'bold', color: 'white', lineHeight: 1 },
    anchorPulse:{ position: 'absolute', top: -5, left: -5, right: -5, bottom: -5, borderRadius: '50%', background: 'rgba(231,76,60,0.35)', animation: 'pulse 1.8s infinite', pointerEvents: 'none' },

    labelBox:   { position: 'absolute', background: 'white', border: '2px solid #e74c3c', borderRadius: 8, display: 'flex', alignItems: 'center', transform: 'translate(-50%, -50%)', boxShadow: '0 4px 12px rgba(0,0,0,0.15)', whiteSpace: 'nowrap', userSelect: 'none' },
    dragHandle: { padding: '6px 7px', background: '#e74c3c', color: 'white', cursor: 'grab', borderTopLeftRadius: 5, borderBottomLeftRadius: 5, display: 'flex', alignItems: 'center' },
    labelNumber:{ fontWeight: 'bold', color: '#e74c3c', fontSize: 12, minWidth: 14, textAlign: 'center' },
    labelInput: { border: 'none', borderBottom: '2px solid #eee', outline: 'none', fontSize: 13, padding: '1px 2px', fontWeight: 'bold', color: '#2c3e50', background: 'transparent', minWidth: 50 },
    deleteBtn:  { background: 'transparent', border: 'none', color: '#bbb', cursor: 'pointer', padding: '6px 7px', borderLeft: '1px solid #eee', display: 'flex', alignItems: 'center' },

    // Modal
    modalOverlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 4000, padding: 20 },
    modal:        { background: 'white', width: '100%', maxWidth: 420, borderRadius: 14, maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 40px rgba(0,0,0,0.2)' },
    modalHeader:  { padding: '16px 18px', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
    modalBody:    { padding: '18px', overflowY: 'auto', flex: 1 },
    label:        { display: 'block', fontSize: '0.78rem', fontWeight: 'bold', color: '#555', marginBottom: 5 },
    input:        { width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #ddd', boxSizing: 'border-box', fontSize: '0.88rem', outline: 'none' },
    closeBtn:     { width: '100%', padding: '14px', background: '#e74c3c', color: 'white', border: 'none', borderBottomLeftRadius: 14, borderBottomRightRadius: 14, fontSize: '1rem', cursor: 'pointer', fontWeight: 'bold' },
};
