import React, { useState, useEffect } from 'react';
import { Save, X, Trash2, FolderPlus, Settings, Plus, FileText, Globe } from 'lucide-react';
import PublicarModal from './PublicarModal';

// Aceptamos la prop 'usuario' para poder leer sus datos
export default function EditorWordle({ datos, setDatos, onClose, onSave, usuario }) {
    const [hojaActiva, setHojaActiva] = useState(0);
    const [mostrandoConfig, setMostrandoConfig] = useState(false);
    const [tempPalabras, setTempPalabras] = useState("");
    const [mediaTipoPres, setMediaTipoPres] = useState(() => datos.presentacion?.video ? 'video' : 'imagen');
    const [modoBuscadorPres, setModoBuscadorPres] = useState(false);
    const [searchQueryPres, setSearchQueryPres] = useState('');
    const [searchResultsPres, setSearchResultsPres] = useState([]);
    const [isSearchingPres, setIsSearchingPres] = useState(false);
    const [mostrandoPreviewPres, setMostrandoPreviewPres] = useState(false);
    const [modalPublicar, setModalPublicar] = useState(null);

    // 1. INICIALIZACIÓN DE DATOS (Con Autocompletado)
    useEffect(() => {
        if (datos) {
            setDatos(prev => ({
                ...prev,
                tipo: 'PRO',
                tipoJuego: 'WORDLE',

                // Configuración Base + Idioma
                config: {
                    tiempoTotal: 300,
                    numPalabras: 5,
                    aleatorio: true,
                    idioma: prev.config?.idioma || 'ES', // <--- NUEVO: Por defecto Español
                    ...prev.config
                },

                // --- AUTOCOMPLETADO DE DATOS DEL PROFESOR ---
                pais: prev.pais || usuario?.pais || '',
                region: prev.region || usuario?.region || '',
                poblacion: prev.poblacion || usuario?.poblacion || usuario?.localidad || '',
                ciclo: prev.ciclo || usuario?.ciclo || 'Secundaria',
                temas: prev.temas || usuario?.temasPreferidos || '',
                // --------------------------------------------

                // Asegurar que hay al menos una hoja
                hojas: (!prev.hojas || prev.hojas.length === 0)
                    ? [{ nombreHoja: 'Nivel 1', palabras: [] }]
                    : prev.hojas
            }));
        }
    }, []); // Se ejecuta al montar

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
    const buscarImagenesPres = async () => {
        if (!searchQueryPres.trim()) return;
        setIsSearchingPres(true);
        try {
            const res = await fetch(`https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrnamespace=6&gsrsearch=${encodeURIComponent(searchQueryPres)}&gsrlimit=24&prop=imageinfo&iiprop=url&iiurlwidth=400&format=json&origin=*`);
            const data = await res.json();
            const pages = data.query?.pages || {};
            const urls = Object.values(pages).map(p => { const i = p.imageinfo?.[0]; return i?.thumburl || i?.url; }).filter(u => u && /\.(jpe?g|png|gif|webp|svg)(\?|$)/i.test(u));
            setSearchResultsPres(urls);
        } catch { alert('Error buscando imágenes.'); }
        setIsSearchingPres(false);
    };
    const setPresentacionImg = (url) => {
        setDatos(p => ({ ...p, presentacion: { ...(p.presentacion || {}), imagen: url } }));
        setModoBuscadorPres(false); setSearchResultsPres([]); setSearchQueryPres('');
    };

    // --- GESTIÓN DE HOJAS ---
    const addHoja = () => {
        setDatos({
            ...datos,
            hojas: [...datos.hojas, { nombreHoja: `Nivel ${datos.hojas.length + 1}`, palabras: [] }]
        });
        setHojaActiva(datos.hojas.length);
    };

    const deleteHoja = (idx) => {
        if (datos.hojas.length <= 1) return alert("Debe haber al menos un nivel.");
        if (confirm("¿Borrar este nivel?")) {
            const nuevas = datos.hojas.filter((_, i) => i !== idx);
            setDatos({ ...datos, hojas: nuevas });
            setHojaActiva(0);
        }
    };

    const renameHoja = (idx, val) => {
        const n = [...datos.hojas]; n[idx].nombreHoja = val; setDatos({ ...datos, hojas: n });
    };

    // --- GESTIÓN DE PALABRAS ---
    const procesarPalabras = () => {
        if (!tempPalabras.trim()) return;

        const nuevasPalabras = tempPalabras.split(',')
            .map(p => p.trim().toUpperCase())
            .filter(p => {
                // FILTRO: Letras válidas y longitud 4-8
                const esLetras = /^[A-ZÑ]+$/.test(p);
                const longitudValida = p.length >= 4 && p.length <= 10;
                return esLetras && longitudValida;
            });

        if (nuevasPalabras.length === 0) {
            alert("Ninguna palabra válida. Deben tener entre 4 y 10 letras.");
            return;
        }

        const n = [...datos.hojas];
        const actuales = new Set(n[hojaActiva].palabras);
        nuevasPalabras.forEach(p => actuales.add(p));

        n[hojaActiva].palabras = Array.from(actuales);
        setDatos({ ...datos, hojas: n });
        setTempPalabras("");
    };

    const borrarPalabra = (palabra) => {
        const n = [...datos.hojas];
        n[hojaActiva].palabras = n[hojaActiva].palabras.filter(p => p !== palabra);
        setDatos({ ...datos, hojas: n });
    };

    // --- CONFIGURACIÓN GLOBAL ---
    const updateGlobalConfig = (k, v) => {
        setDatos({ ...datos, config: { ...datos.config, [k]: v } });
    };

    return (
        <div style={styles.overlay}>
            <div style={styles.container}>

                {/* HEADER */}
                <div style={styles.header}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1 }}>
                        <h2 style={{ margin: 0, color: '#e8f5e9', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <FileText size={24} /> <span>Editor Wordle</span>
                        </h2>
                        <input
                            placeholder="Título del Recurso..."
                            value={datos.titulo || ''}
                            onChange={e => setDatos({ ...datos, titulo: e.target.value })}
                            style={styles.titleInput}
                        />
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <button onClick={() => setMostrandoConfig(true)} style={styles.iconBtn}><Settings size={22} /></button>
                        <button onClick={() => datos.isFinished ? onSave() : setModalPublicar('guardar')} style={styles.saveBtn}><Save size={18} /> Guardar</button>
                        <button onClick={() => !datos.isFinished ? setModalPublicar('cerrar') : onClose()} style={styles.iconBtn}><X size={22} /></button>
                    </div>
                </div>

                {/* TABS */}
                <div style={styles.tabsContainer}>
                    {datos.hojas?.map((h, i) => (
                        <div key={i} onClick={() => setHojaActiva(i)} style={{
                            ...styles.tab,
                            background: i === hojaActiva ? 'white' : '#ecf0f1',
                            borderBottom: i === hojaActiva ? '3px solid #2e7d32' : 'none',
                            color: i === hojaActiva ? '#1b5e20' : '#7f8c8d'
                        }}>
                            <input value={h.nombreHoja ?? ''} onChange={(e) => renameHoja(i, e.target.value)} style={styles.tabInput} onClick={e => e.stopPropagation()} />
                            {datos.hojas.length > 1 && <Trash2 size={14} onClick={(e) => { e.stopPropagation(); deleteHoja(i) }} style={{ cursor: 'pointer', color: '#c62828' }} />}
                        </div>
                    ))}
                    <button onClick={addHoja} style={styles.addTabBtn}><FolderPlus size={20} /></button>
                </div>

                {/* BODY */}
                <div style={styles.body}>
                    {/* CODIGO DE ACCESO */}
                    <div style={{ background: 'white', padding: '15px', borderRadius: '10px', marginBottom: '20px', border: '1px solid #ddd', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div>
                            <h4 style={{ margin: '0 0 5px 0', color: '#2e7d32' }}>Código de Acceso</h4>
                            <span style={{ fontSize: '12px', color: '#666' }}>Este código servirá para cargar este Wordle personalizado.</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                            <span style={{ fontSize: '24px', fontWeight: 'bold', letterSpacing: '2px', color: '#333' }}>
                                {datos.accessCode || '----'}
                            </span>
                            {!datos.accessCode && <span style={{ fontSize: '10px', color: 'red' }}>(Guarda para generar)</span>}
                        </div>
                    </div>

                    {/* EDITOR DE PALABRAS */}
                    <div style={{ background: 'white', padding: '20px', borderRadius: '12px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
                        <h3 style={{ marginTop: 0, color: '#2e7d32' }}>Lista de Palabras ({datos.hojas?.[hojaActiva]?.palabras?.length || 0})</h3>
                        <p style={{ color: '#666', fontSize: '14px', marginBottom: '15px' }}>
                            Escribe palabras de <b>4 a 10 letras</b> separadas por comas (Ej: CASA, PERRO, GATO).
                        </p>

                        <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
                            <input
                                value={tempPalabras}
                                onChange={e => setTempPalabras(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && procesarPalabras()}
                                placeholder="Escribe aquí..."
                                style={styles.inputBig}
                            />
                            <button onClick={procesarPalabras} style={styles.addBtn}><Plus size={20} /> Añadir</button>
                        </div>

                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', minHeight: '100px', padding: '15px', background: '#f1f8e9', borderRadius: '10px', border: '1px dashed #a5d6a7' }}>
                            {datos.hojas?.[hojaActiva]?.palabras?.map((p, i) => (
                                <div key={i} style={styles.wordBadge}>
                                    <span style={{ fontWeight: 'bold' }}>{p}</span>
                                    <span style={{ fontSize: '10px', marginLeft: '5px', color: '#1b5e20', opacity: 0.7 }}>({p.length})</span>
                                    <X size={14} style={{ cursor: 'pointer', marginLeft: '8px' }} onClick={() => borrarPalabra(p)} />
                                </div>
                            ))}
                            {(!datos.hojas?.[hojaActiva]?.palabras || datos.hojas[hojaActiva].palabras.length === 0) && (
                                <div style={{ width: '100%', textAlign: 'center', color: '#aaa', fontStyle: 'italic', alignSelf: 'center' }}>
                                    Lista vacía. Añade palabras arriba.
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* MODAL CONFIGURACIÓN */}
                {modalPublicar && (
                    <PublicarModal
                        modo={modalPublicar}
                        onGuardarPublicar={async () => { setDatos(prev => ({ ...prev, isFinished: true })); await onSave(); setModalPublicar(null); }}
                        onGuardarSolo={async () => { await onSave(); setModalPublicar(null); }}
                        onSalirSinGuardar={() => { setModalPublicar(null); onClose(); }}
                        onCancelar={() => setModalPublicar(null)}
                    />
                )}
                {mostrandoConfig && (
                    <div style={styles.modalOverlay}>
                        <div style={styles.modal}>
                            <div style={styles.modalHeader}>
                                <h3>Configuración Wordle</h3>
                                <button onClick={() => setMostrandoConfig(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X /></button>
                            </div>
                            <div style={styles.modalBody}>
                                {/* SECCIÓN 1: DATOS BÁSICOS (AUTOCOMPLETADOS) */}
                                <h4 style={styles.sectionTitle}>Datos de Búsqueda</h4>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                    <InputConfig label="País" val={datos.pais} set={v => setDatos({ ...datos, pais: v })} />
                                    <InputConfig label="Región" val={datos.region} set={v => setDatos({ ...datos, region: v })} />
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                    <InputConfig label="Población" val={datos.poblacion} set={v => setDatos({ ...datos, poblacion: v })} />
                                    <InputConfig label="Temas" val={datos.temas} set={v => setDatos({ ...datos, temas: v })} />
                                </div>
                                <div style={{ marginBottom: '15px' }}>
                                    <label style={styles.label}>Ciclo Educativo</label>
                                    <select value={datos.ciclo || 'Secundaria'} onChange={e => setDatos({ ...datos, ciclo: e.target.value })} style={styles.input}>
                                        <option value="Infantil">Infantil</option>
                                        <option value="Primaria">Primaria</option>
                                        <option value="Secundaria">Secundaria</option>
                                        <option value="Bachillerato">Bachillerato</option>
                                        <option value="Otros">Otros</option>
                                    </select>
                                </div>

                                {/* SECCIÓN 2: REGLAS DEL JUEGO */}
                                <h4 style={styles.sectionTitle}>Reglas del Juego</h4>

                                {/* --- SELECTOR DE IDIOMA NUEVO --- */}
                                <div style={{ marginBottom: '15px' }}>
                                    <label style={styles.label}><Globe size={14} style={{ verticalAlign: 'middle' }} /> Idioma del Diccionario</label>
                                    <select
                                        value={datos.config?.idioma || 'ES'}
                                        onChange={e => updateGlobalConfig('idioma', e.target.value)}
                                        style={{ ...styles.input, border: '1px solid #2e7d32', color: '#1b5e20', fontWeight: 'bold' }}
                                    >
                                        <option value="ES">🇪🇸 Español</option>
                                        <option value="CA">🟥🟨 Català</option>
                                        <option value="EN">🇬🇧 English</option>
                                        <option value="FR">🇫🇷 Français</option>
                                    </select>
                                    <p style={{ fontSize: '11px', color: '#666', marginTop: '2px' }}>Define qué diccionario usará el juego para validar las palabras.</p>
                                </div>
                                {/* -------------------------------- */}

                                <div style={{ marginBottom: '10px' }}>
                                    <label style={styles.label}>Palabras a jugar</label>
                                    <input type="number" value={datos.config?.numPalabras || 5} onChange={e => updateGlobalConfig('numPalabras', parseInt(e.target.value))} style={styles.input} />
                                </div>
                                <div style={{ marginBottom: '10px' }}>
                                    <label style={styles.label}>Tiempo Total (segundos)</label>
                                    <input type="number" value={datos.config?.tiempoTotal || 300} onChange={e => updateGlobalConfig('tiempoTotal', parseInt(e.target.value))} style={styles.input} />
                                </div>

                                {/* SECCIÓN 3: ESTADOS */}
                                <h4 style={styles.sectionTitle}>Estado</h4>
                                <div style={styles.toggleRow}>
                                    <span>Terminado (Visible alumnos)</span>
                                    <input type="checkbox" checked={datos.isFinished} onChange={() => setDatos({ ...datos, isFinished: !datos.isFinished })} />
                                </div>
                                <div style={styles.toggleRow}>
                                    <span>Público (Permitir copia)</span>
                                    <input type="checkbox" checked={!datos.isPrivate} onChange={() => setDatos({ ...datos, isPrivate: !datos.isPrivate })} />
                                </div>

                                {/* ── PRESENTACIÓN PREVIA ── */}
                                <h4 style={{ ...styles.sectionTitle, color: '#8e44ad' }}>🎬 Presentación previa</h4>
                                <p style={{ fontSize: '0.75rem', color: '#999', marginTop: 0 }}>Pantalla introductoria antes de que empiece el juego.</p>
                                <div style={{ marginBottom: 10 }}><label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: '#555', marginBottom: 4 }}>Título</label><input value={datos.presentacion?.titulo || ''} onChange={e => setDatos(p => ({ ...p, presentacion: { ...(p.presentacion || {}), titulo: e.target.value } }))} style={styles.input} placeholder="Ej: Vocabulario de ciencias" /></div>
                                <div style={{ marginBottom: 10 }}>
                                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: '#555', marginBottom: 6 }}>Media</label>
                                    <div style={{ display: 'flex', borderRadius: 8, overflow: 'hidden', border: '1px solid #ddd', marginBottom: 8 }}>
                                        {[['imagen', '🖼️ Imagen'], ['video', '▶️ Vídeo']].map(([tipo, lbl]) => (
                                            <button key={tipo} onClick={() => { setMediaTipoPres(tipo); setModoBuscadorPres(false); setSearchResultsPres([]); }} style={{ flex: 1, padding: '7px 0', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '0.82rem', background: mediaTipoPres === tipo ? '#2e7d32' : '#f5f5f5', color: mediaTipoPres === tipo ? 'white' : '#555' }}>{lbl}</button>
                                        ))}
                                    </div>
                                    {mediaTipoPres === 'imagen' && (<>
                                        {datos.presentacion?.imagen && (<div style={{ position: 'relative', marginBottom: 8 }}><img src={datos.presentacion.imagen} alt="" onError={e => { e.target.style.display = 'none'; }} style={{ width: '100%', borderRadius: 8, maxHeight: 110, objectFit: 'cover', display: 'block' }} /><button onClick={() => setDatos(p => ({ ...p, presentacion: { ...(p.presentacion || {}), imagen: '' } }))} style={{ position: 'absolute', top: 4, right: 4, background: 'rgba(0,0,0,0.6)', border: 'none', color: 'white', borderRadius: '50%', width: 22, height: 22, cursor: 'pointer', fontSize: 13 }}>✕</button></div>)}
                                        <button onClick={() => setModoBuscadorPres(p => !p)} style={{ ...styles.input, background: '#f1f8e9', color: '#2e7d32', fontWeight: 'bold', border: '1px dashed #66bb6a', cursor: 'pointer', textAlign: 'center', marginBottom: 6 }}>🔍 {modoBuscadorPres ? 'Cerrar buscador' : 'Buscar imagen'}</button>
                                        {modoBuscadorPres && (<div style={{ background: '#f5f5f5', borderRadius: 8, padding: 10, marginBottom: 8 }}>
                                            <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}><input value={searchQueryPres} onChange={e => setSearchQueryPres(e.target.value)} onKeyDown={e => e.key === 'Enter' && buscarImagenesPres()} placeholder="Buscar en Wikimedia Commons..." style={{ ...styles.input, flex: 1 }} /><button onClick={buscarImagenesPres} style={{ background: '#2e7d32', color: 'white', border: 'none', borderRadius: 6, padding: '0 12px', cursor: 'pointer', fontWeight: 'bold', whiteSpace: 'nowrap' }}>{isSearchingPres ? '...' : 'Buscar'}</button></div>
                                            <input placeholder="O pega una URL..." style={{ ...styles.input, fontSize: '0.75rem', marginBottom: 8 }} onBlur={e => { if (e.target.value.startsWith('http')) setPresentacionImg(e.target.value); }} onKeyDown={e => { if (e.key === 'Enter' && e.target.value.startsWith('http')) setPresentacionImg(e.target.value); }} />
                                            {searchResultsPres.length > 0 && (<div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(72px,1fr))', gap: 5, maxHeight: 170, overflowY: 'auto' }}>{searchResultsPres.map((url, i) => <img key={i} src={url} alt="" onClick={() => setPresentacionImg(url)} onError={e => { e.target.style.display = 'none'; }} style={{ width: '100%', height: 60, objectFit: 'cover', borderRadius: 5, cursor: 'pointer', border: '2px solid transparent' }} onMouseEnter={e => { e.target.style.border = '2px solid #2e7d32'; }} onMouseLeave={e => { e.target.style.border = '2px solid transparent'; }} />)}</div>)}
                                        </div>)}
                                    </>)}
                                    {mediaTipoPres === 'video' && (<>
                                        <input value={datos.presentacion?.video || ''} onChange={e => setDatos(p => ({ ...p, presentacion: { ...(p.presentacion || {}), video: e.target.value } }))} placeholder="https://www.youtube.com/watch?v=..." style={{ ...styles.input, marginBottom: 8 }} />
                                        {datos.presentacion?.video && toEmbedUrl(datos.presentacion.video) && (<div style={{ position: 'relative', paddingBottom: '56.25%', borderRadius: 8, overflow: 'hidden', background: '#000', marginBottom: 6 }}><iframe src={toEmbedUrl(datos.presentacion.video)} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 'none' }} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen title="preview" /></div>)}
                                        {datos.presentacion?.video && <button onClick={() => setDatos(p => ({ ...p, presentacion: { ...(p.presentacion || {}), video: '' } }))} style={{ background: '#ffebee', border: 'none', color: '#c62828', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 700 }}>✕ Quitar vídeo</button>}
                                    </>)}
                                </div>
                                <div style={{ marginBottom: 10 }}><label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: '#555', marginBottom: 4 }}>Descripción</label><textarea value={datos.presentacion?.descripcion || ''} onChange={e => setDatos(p => ({ ...p, presentacion: { ...(p.presentacion || {}), descripcion: e.target.value } }))} style={{ ...styles.input, resize: 'vertical', minHeight: 58, fontFamily: 'inherit' }} placeholder="Texto introductorio..." /></div>
                                {datos.presentacion?.titulo && <button onClick={() => setMostrandoPreviewPres(true)} style={{ width: '100%', padding: 10, background: '#8e44ad', color: 'white', border: 'none', borderRadius: 8, fontWeight: 'bold', cursor: 'pointer', marginBottom: 4 }}>👁️ Vista previa</button>}
                            </div>
                            <button onClick={() => setMostrandoConfig(false)} style={styles.closeBtn}>Aceptar</button>
                        </div>
                    </div>
                )}

                {mostrandoPreviewPres && (
                    <div style={{ position: 'fixed', inset: 0, zIndex: 6000, background: 'linear-gradient(160deg,#0f0c29 0%,#302b63 55%,#24243e 100%)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px 20px', overflowY: 'auto', boxSizing: 'border-box' }}>
                        <button onClick={() => setMostrandoPreviewPres(false)} style={{ position: 'fixed', top: 16, right: 16, background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.3)', color: 'white', borderRadius: 8, padding: '8px 16px', cursor: 'pointer', fontWeight: 'bold', zIndex: 10 }}>✕ Cerrar</button>
                        <div style={{ width: '100%', maxWidth: 560, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 22 }}>
                            <h1 style={{ color: 'white', margin: 0, fontSize: 'clamp(1.6rem,5vw,2.8rem)', textAlign: 'center', fontWeight: 900, lineHeight: 1.2 }}>{datos.presentacion?.titulo}</h1>
                            {datos.presentacion?.video && toEmbedUrl(datos.presentacion.video) ? (<div style={{ width: '100%', borderRadius: 18, overflow: 'hidden', boxShadow: '0 24px 64px rgba(0,0,0,0.65)', position: 'relative', paddingBottom: '56.25%', background: '#000' }}><iframe src={toEmbedUrl(datos.presentacion.video)} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 'none' }} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen title="presentación" /></div>) : datos.presentacion?.imagen ? (<div style={{ width: '100%', borderRadius: 18, overflow: 'hidden', boxShadow: '0 24px 64px rgba(0,0,0,0.65)' }}><img src={datos.presentacion.imagen} alt="" style={{ width: '100%', height: 'auto', display: 'block', maxHeight: '42vh', objectFit: 'cover' }} /></div>) : null}
                            {datos.presentacion?.descripcion && <p style={{ color: 'rgba(255,255,255,0.88)', margin: 0, fontSize: 'clamp(0.95rem,2.5vw,1.1rem)', textAlign: 'center', lineHeight: 1.7 }}>{datos.presentacion.descripcion}</p>}
                            <button style={{ background: 'linear-gradient(135deg,#667eea 0%,#764ba2 100%)', color: 'white', border: 'none', borderRadius: 50, padding: '16px 52px', fontSize: '1.1rem', fontWeight: 800, cursor: 'default', opacity: 0.85 }}>▶ ¡Empezar!</button>
                            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.75rem', margin: 0 }}>— Vista previa —</p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

const InputConfig = ({ label, val, set }) => (
    <div style={{ marginBottom: '10px' }}>
        <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: '#555' }}>{label}</label>
        <input value={val || ''} onChange={e => set(e.target.value)} style={styles.input} />
    </div>
);

const styles = {
    overlay: { position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: '#f0f2f5', zIndex: 3000, display: 'flex', justifyContent: 'center' },
    container: { display: 'flex', flexDirection: 'column', height: '100%', width: '100%', maxWidth: '900px', margin: '0 auto', background: 'white', boxShadow: '0 0 20px rgba(0,0,0,0.1)' },
    header: { background: '#2e7d32', padding: '15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'white' },
    titleInput: { background: 'rgba(255,255,255,0.2)', border: 'none', color: 'white', fontSize: '18px', padding: '5px 10px', borderRadius: '4px', flex: 1, outline: 'none', marginLeft: '10px' },
    iconBtn: { background: 'none', border: 'none', color: 'white', cursor: 'pointer', padding: '5px' },
    saveBtn: { background: '#66bb6a', border: 'none', color: 'white', padding: '8px 15px', borderRadius: '20px', display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer', fontWeight: 'bold' },

    tabsContainer: { background: '#f1f8e9', padding: '10px 10px 0 10px', display: 'flex', gap: '5px', overflowX: 'auto', borderBottom: '1px solid #c8e6c9' },
    tab: { padding: '10px 20px', borderRadius: '10px 10px 0 0', cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '10px', minWidth: '100px' },
    tabInput: { border: 'none', background: 'transparent', fontWeight: 'bold', width: '80px', outline: 'none', color: 'inherit' },
    addTabBtn: { padding: '10px', background: 'transparent', border: 'none', cursor: 'pointer', color: '#2e7d32' },

    body: { flex: 1, padding: '20px', overflowY: 'auto', background: '#fafafa' },

    inputBig: { flex: 1, padding: '12px', borderRadius: '8px', border: '1px solid #ccc', fontSize: '16px' },
    addBtn: { background: '#2e7d32', color: 'white', border: 'none', borderRadius: '8px', padding: '0 20px', cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '5px' },

    wordBadge: { background: 'white', border: '1px solid #81c784', color: '#2e7d32', padding: '5px 12px', borderRadius: '20px', display: 'flex', alignItems: 'center', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' },

    // Modal
    modalOverlay: { position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 4000 },
    modal: { background: 'white', width: '90%', maxWidth: '400px', borderRadius: '10px', maxHeight: '90vh', display: 'flex', flexDirection: 'column' },
    modalHeader: { padding: '15px', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
    modalBody: { padding: '20px', overflowY: 'auto' },
    sectionTitle: { margin: '15px 0 10px 0', color: '#2e7d32', borderBottom: '2px solid #eee', paddingBottom: '5px', fontSize: '14px', textTransform: 'uppercase' },
    label: { display: 'block', fontSize: '12px', marginBottom: '5px', fontWeight: 'bold', color: '#555' },
    input: { width: '100%', padding: '8px', borderRadius: '5px', border: '1px solid #ddd', boxSizing: 'border-box' },
    toggleRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', padding: '10px', background: '#f1f8e9', borderRadius: '5px' },
    closeBtn: { width: '100%', padding: '15px', background: '#2e7d32', color: 'white', border: 'none', borderBottomLeftRadius: '10px', borderBottomRightRadius: '10px', fontSize: '16px', cursor: 'pointer' }
};