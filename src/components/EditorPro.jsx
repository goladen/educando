import { useState, useEffect, useRef } from 'react';
import { Save, X, Trash2, FolderPlus, ArrowUp, ArrowDown, Clock, Trophy, GripVertical, Image as ImageIcon, Type, List, AlignCenter, MoreHorizontal, Settings } from 'lucide-react';
import PublicarModal from './PublicarModal';

export default function EditorPro({ datos, setDatos, onClose, onSave, usuario }) {
    const [hojaActiva, setHojaActiva] = useState(0);
    const [mostrandoConfig, setMostrandoConfig] = useState(false);
    const [modalPublicar, setModalPublicar] = useState(null);

    // Asegurar que el recurso se marca como PRO y tiene configuración base
    // Asegurar que el recurso se marca como PRO, tiene configuración y AUTORRELLENA el perfil
    useEffect(() => {
        if (datos) {
            setDatos(prev => ({
                ...prev,
                // Aseguramos el tipo siempre
                tipo: 'PRO',

                // Configuración base
                config: {
                    ...prev.config,
                    aleatorio: prev.config?.aleatorio !== undefined ? prev.config.aleatorio : true,
                    numPreguntas: prev.config?.numPreguntas || 10
                },

                // --- AUTORRELLENO CORREGIDO ---
                // Usamos || para que si está vacío ("") coja el del usuario
                pais: prev.pais || usuario?.pais || '',
                region: prev.region || usuario?.region || '',
                poblacion: prev.poblacion || usuario?.poblacion || usuario?.localidad || '',
                ciclo: prev.ciclo || usuario?.ciclo || 'Secundaria',
                temas: prev.temas || usuario?.temasPreferidos || '',
            }));
        }
    }, []);

    // --- LOGICA DE ACTUALIZACIÓN ---
    const updateGlobalConfig = (k, v) => {
        setDatos({ ...datos, config: { ...datos.config, [k]: v } });
    };

    // Gestión Hojas
    const addHoja = () => setDatos({ ...datos, hojas: [...datos.hojas, { nombreHoja: `Grupo ${datos.hojas.length + 1}`, preguntas: [] }] });

    const deleteHoja = (idx) => {
        if (datos.hojas.length <= 1) return alert("Debe haber al menos un grupo de preguntas.");
        if (confirm("¿Borrar grupo y sus preguntas?")) {
            const nuevas = datos.hojas.filter((_, i) => i !== idx);
            setDatos({ ...datos, hojas: nuevas });
            setHojaActiva(0);
        }
    };

    const renameHoja = (idx, val) => {
        const n = [...datos.hojas]; n[idx].nombreHoja = val; setDatos({ ...datos, hojas: n });
    };

    // Gestión Preguntas
    const addPregunta = () => {
        const nuevas = [...datos.hojas];
        const nuevaP = {
            tipo: 'SIMPLE',
            pregunta: '',
            tiempo: 20,
            puntosMax: 100,
            puntosMin: 10,
            respuesta: '',
            correcta: '', incorrectas: ['', '', ''],
            bloques: [],
            numBloques: 4
        };
        nuevas[hojaActiva].preguntas.push(nuevaP);
        setDatos({ ...datos, hojas: nuevas });
    };

    const updatePregunta = (idx, field, val) => {
        const nuevas = [...datos.hojas];
        nuevas[hojaActiva].preguntas[idx][field] = val;
        setDatos({ ...datos, hojas: nuevas });
    };

    const updatePreguntaArray = (idx, arrayField, arrayIdx, val) => {
        const nuevas = [...datos.hojas];
        const arr = [...(nuevas[hojaActiva].preguntas[idx][arrayField] || [])];
        arr[arrayIdx] = val;
        nuevas[hojaActiva].preguntas[idx][arrayField] = arr;
        setDatos({ ...datos, hojas: nuevas });
    };

    const deletePregunta = (idx) => {
        const nuevas = [...datos.hojas];
        nuevas[hojaActiva].preguntas.splice(idx, 1);
        setDatos({ ...datos, hojas: nuevas });
    };

    const moverPregunta = (idx, dir) => {
        const nuevas = [...datos.hojas];
        const list = nuevas[hojaActiva].preguntas;
        if (dir === -1 && idx > 0) [list[idx], list[idx - 1]] = [list[idx - 1], list[idx]];
        if (dir === 1 && idx < list.length - 1) [list[idx], list[idx + 1]] = [list[idx + 1], list[idx]];
        setDatos({ ...datos, hojas: nuevas });
    };

    // --- TOGGLES DE CONFIGURACIÓN ---
    const togglePermitirCopia = () => setDatos(prev => ({ ...prev, isPrivate: !prev.isPrivate }));
    const toggleTerminado = () => setDatos(prev => ({ ...prev, isFinished: !prev.isFinished }));

    // --- RENDERIZADO DE CAMPOS ESPECÍFICOS SEGÚN TIPO ---
    const renderCamposPro = (p, i) => {
        const tipo = p.tipo || 'SIMPLE';

        return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '100%' }}>

                {/* 1. SELECTOR DE TIPO Y CONFIGURACIÓN BÁSICA */}
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center', background: '#f0f4f8', padding: '8px', borderRadius: '5px', flexWrap: 'wrap' }}>
                    <select
                        value={tipo}
                        onChange={(e) => updatePregunta(i, 'tipo', e.target.value)}
                        style={{ ...inputStyleSmall, fontWeight: 'bold', minWidth: '140px', border: '1px solid #3498db', color: '#3498db' }}
                    >
                        <option value="SIMPLE">Respuesta Corta</option>
                        <option value="MULTIPLE">Selección Múltiple</option>
                        <option value="ORDENAR">Ordenar</option>
                        <option value="RELLENAR">Rellenar Hueco</option>
                        <option value="PRESENTATION">Presentación</option>
                        <option value="DIBUJO">Dibujo en Pizarra</option>
                        <option value="MUSICAL">Pregunta Musical 🎵</option>
                    </select>

                    {tipo !== 'PRESENTATION' && (
                        <>
                            <div style={statBox} title="Tiempo (segundos)">
                                <Clock size={14} color="#666" />
                                <input type="number" value={p.tiempo} onChange={e => updatePregunta(i, 'tiempo', e.target.value)} style={miniInput} /> s
                            </div>
                            <div style={statBox} title="Puntos Máximos">
                                <Trophy size={14} color="#27ae60" />
                                <span style={{ fontSize: '10px', color: '#27ae60' }}>Max</span>
                                <input type="number" value={p.puntosMax} onChange={e => updatePregunta(i, 'puntosMax', e.target.value)} style={miniInput} />
                            </div>
                            <div style={statBox} title="Puntos Mínimos">
                                <Trophy size={14} color="#e67e22" />
                                <span style={{ fontSize: '10px', color: '#e67e22' }}>Min</span>
                                <input type="number" value={p.puntosMin} onChange={e => updatePregunta(i, 'puntosMin', e.target.value)} style={miniInput} />
                            </div>
                        </>
                    )}
                </div>

                {/* 2. CAMPOS ESPECÍFICOS SEGÚN TIPO */}

                {tipo === 'SIMPLE' && (
                    <>
                        <input placeholder="Escribe la pregunta..." value={p.pregunta} onChange={e => updatePregunta(i, 'pregunta', e.target.value)} className="inp" style={{ fontWeight: 'bold' }} />
                        <input placeholder="Respuesta Correcta" value={p.respuesta} onChange={e => updatePregunta(i, 'respuesta', e.target.value)} className="inp" style={{ borderColor: '#2ecc71' }} />
                    </>
                )}

                {tipo === 'MULTIPLE' && (
                    <>
                        <input placeholder="Escribe la pregunta..." value={p.pregunta} onChange={e => updatePregunta(i, 'pregunta', e.target.value)} className="inp" style={{ fontWeight: 'bold' }} />
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '5px' }}>
                            <input placeholder="✅ Respuesta Correcta" value={p.correcta} onChange={e => updatePregunta(i, 'correcta', e.target.value)} className="inp" style={{ borderColor: '#2ecc71', background: '#e8f5e9' }} />
                            {[0, 1, 2].map(k => (
                                <input key={k} placeholder={`❌ Incorrecta ${k + 1}`} value={p.incorrectas?.[k] || ''} onChange={e => updatePreguntaArray(i, 'incorrectas', k, e.target.value)} className="inp" style={{ borderColor: '#e74c3c', background: '#ffebee' }} />
                            ))}
                        </div>
                    </>
                )}

                {tipo === 'ORDENAR' && (
                    <>
                        <input placeholder="Enunciado (Ej: Ordena la frase...)" value={p.pregunta} onChange={e => updatePregunta(i, 'pregunta', e.target.value)} className="inp" style={{ fontWeight: 'bold' }} />
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '5px' }}>
                            <label style={{ fontSize: '12px', color: '#666' }}>Nº Bloques:</label>
                            <select
                                value={p.numBloques || 4}
                                onChange={e => {
                                    const num = parseInt(e.target.value);
                                    updatePregunta(i, 'numBloques', num);
                                    const currentBloques = p.bloques || [];
                                    const newBloques = Array(num).fill('').map((_, idx) => currentBloques[idx] || '');
                                    updatePregunta(i, 'bloques', newBloques);
                                }}
                                style={miniSelect}
                            >
                                {[2, 3, 4, 5, 6, 7, 8].map(n => <option key={n} value={n}>{n}</option>)}
                            </select>
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                            {(p.bloques || Array(p.numBloques || 4).fill('')).map((b, k) => (
                                <input key={k} placeholder={`Parte ${k + 1}`} value={b} onChange={e => updatePreguntaArray(i, 'bloques', k, e.target.value)} className="inp" style={{ flex: '1 1 45%', minWidth: '100px' }} />
                            ))}
                        </div>
                    </>
                )}

                {tipo === 'RELLENAR' && (
                    <>
                        <input placeholder="Enunciado (Ej: Completa la frase...)" value={p.pregunta} onChange={e => updatePregunta(i, 'pregunta', e.target.value)} className="inp" style={{ fontWeight: 'bold' }} />
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', background: '#f9f9f9', padding: '10px', borderRadius: '5px' }}>
                            <input placeholder="Primera parte..." value={p.bloques?.[0] || ''} onChange={e => updatePreguntaArray(i, 'bloques', 0, e.target.value)} className="inp" style={{ flex: 1 }} />
                            <input placeholder="[ A RELLENAR ]" value={p.bloques?.[1] || ''} onChange={e => updatePreguntaArray(i, 'bloques', 1, e.target.value)} className="inp" style={{ flex: 0.5, borderColor: '#3498db', fontWeight: 'bold', textAlign: 'center' }} />
                            <input placeholder="Segunda parte..." value={p.bloques?.[2] || ''} onChange={e => updatePreguntaArray(i, 'bloques', 2, e.target.value)} className="inp" style={{ flex: 1 }} />
                        </div>
                    </>
                )}

                {tipo === 'PRESENTATION' && (
                    <div style={{ border: '2px dashed #95a5a6', padding: '10px', borderRadius: '5px' }}>
                        <div style={{ textAlign: 'center', color: '#95a5a6', fontSize: '12px', marginBottom: '5px' }}><ImageIcon size={16} style={{ verticalAlign: 'middle' }} /> Pantalla Informativa (Sin puntos)</div>
                        <input placeholder="Enunciado Superior" value={p.bloques?.[0] || ''} onChange={e => updatePreguntaArray(i, 'bloques', 0, e.target.value)} className="inp" style={{ marginBottom: '5px' }} />
                        <input placeholder="URL de la Imagen (https://...)" value={p.bloques?.[1] || ''} onChange={e => updatePreguntaArray(i, 'bloques', 1, e.target.value)} className="inp" style={{ marginBottom: '5px' }} />
                        <input placeholder="Enunciado Inferior" value={p.bloques?.[2] || ''} onChange={e => updatePreguntaArray(i, 'bloques', 2, e.target.value)} className="inp" />
                    </div>
                )}

                {tipo === 'MUSICAL' && (
                    <MusicalEditorFields p={p} idx={i} updatePregunta={updatePregunta} />
                )}

                {/* --- NUEVO BLOQUE PARA DIBUJO --- */}
                {tipo === 'DIBUJO' && (
                    <div style={{ border: '2px dashed #e67e22', padding: '10px', borderRadius: '5px', background: '#fdf3e8', marginTop: '5px' }}>
                        <div style={{ textAlign: 'center', color: '#d35400', fontSize: '12px', marginBottom: '5px', fontWeight: 'bold' }}>
                            🖌️ Pizarra Digital (El profesor corrige manualmente)
                        </div>
                        <input
                            placeholder="Enunciado (Ej: Dibuja una célula vegetal y sus partes)"
                            value={p.pregunta}
                            onChange={e => updatePregunta(i, 'pregunta', e.target.value)}
                            className="inp"
                            style={{ fontWeight: 'bold', borderColor: '#e67e22' }}
                        />
                    </div>
                )}



            </div>
        );
    };

    // Estilos locales
    const inputStyleSmall = { padding: '5px', borderRadius: '5px', border: '1px solid #ccc', fontSize: '12px' };
    const arrowBtn = { background: '#eee', border: 'none', cursor: 'pointer', fontSize: '10px', padding: '4px', borderRadius: '3px', display: 'flex', alignItems: 'center', justifyContent: 'center' };
    const statBox = { display: 'flex', alignItems: 'center', gap: '3px', background: 'white', padding: '3px 8px', borderRadius: '15px', border: '1px solid #ddd' };
    const miniInput = { width: '40px', border: 'none', borderBottom: '1px solid #ccc', textAlign: 'center', outline: 'none', fontSize: '12px' };
    const miniSelect = { padding: '2px', borderRadius: '3px', border: '1px solid #ccc' };

    return (
        <div style={styles.overlay}>
            <style>{`.inp { padding: 8px; border: 1px solid #ddd; borderRadius: 4px; outline: none; width: 100%; box-sizing: border-box; } .inp:focus { border-color: #2196F3; }`}</style>

            <div style={styles.container}>

                {/* HEADER RESPONSIVE */}
                <div style={styles.header}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: 0 }}>
                        <h2 style={{ margin: 0, color: '#f1c40f', display: 'flex', alignItems: 'center', gap: '5px' }}>
                            <Save size={24} /> <span className="hide-mobile-xs">Editor PRO</span>
                        </h2>
                        <input
                            placeholder="Título..."
                            value={datos.titulo}
                            onChange={e => setDatos({ ...datos, titulo: e.target.value })}
                            style={styles.titleInput}
                        />
                    </div>

                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <button onClick={() => setMostrandoConfig(true)} style={styles.iconBtn} title="Configuración">
                            <Settings size={22} />
                        </button>
                        <button onClick={() => datos.isFinished ? onSave() : setModalPublicar('guardar')} style={styles.saveBtn}>
                            <Save size={18} /> <span className="hide-mobile">Guardar</span>
                        </button>
                        <button onClick={() => !datos.isFinished ? setModalPublicar('cerrar') : onClose()} style={styles.iconBtn}>
                            <X size={22} />
                        </button>
                    </div>
                </div>

                {/* TABS HOJAS */}
                <div style={styles.tabsContainer}>
                    {datos.hojas.map((h, i) => (
                        <div key={i} onClick={() => setHojaActiva(i)} style={{
                            ...styles.tab,
                            background: i === hojaActiva ? 'white' : '#bdc3c7',
                            color: i === hojaActiva ? '#2c3e50' : '#555',
                            boxShadow: i === hojaActiva ? '0 -2px 5px rgba(0,0,0,0.05)' : 'none'
                        }}>
                            <input value={h.nombreHoja} onChange={(e) => renameHoja(i, e.target.value)} style={styles.tabInput} onClick={e => e.stopPropagation()} />
                            {datos.hojas.length > 1 && <Trash2 size={14} onClick={(e) => { e.stopPropagation(); deleteHoja(i) }} style={{ cursor: 'pointer' }} />}
                        </div>
                    ))}
                    <button onClick={addHoja} style={styles.addTabBtn} title="Añadir Grupo"><FolderPlus size={24} /></button>
                </div>

                {/* AREA PREGUNTAS */}
                <div style={styles.body}>
                    {datos.hojas[hojaActiva]?.preguntas.length === 0 ? (
                        <div style={{ textAlign: 'center', color: '#95a5a6', marginTop: '50px' }}>
                            <div style={{ fontSize: '3rem', marginBottom: '10px' }}>📭</div>
                            <p style={{ fontSize: '1.2rem' }}>Este grupo no tiene preguntas aún.</p>
                            <button onClick={addPregunta} style={styles.addFirstBtn}>+ Añadir Primera Pregunta</button>
                        </div>
                    ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', maxWidth: '800px', margin: '0 auto' }}>
                                {datos.hojas[hojaActiva]?.preguntas.map((p, i) => (
                                    <div key={i} style={{ background: 'white', padding: '15px', borderRadius: '12px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)', display: 'flex', alignItems: 'flex-start', gap: '10px', borderLeft: `5px solid ${p.tipo === 'PRESENTATION' ? '#95a5a6' : p.tipo === 'MUSICAL' ? '#9b59b6' : '#3498db'}` }}>

                                        {/* Controles Izquierda */}
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', alignItems: 'center', paddingTop: '5px' }}>
                                            <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#bdc3c7', marginBottom: '5px' }}>#{i + 1}</div>
                                            <button onClick={() => moverPregunta(i, -1)} disabled={i === 0} style={arrowBtn}><ArrowUp size={14} color="#555" /></button>
                                            <button onClick={() => moverPregunta(i, 1)} disabled={i === datos.hojas[hojaActiva].preguntas.length - 1} style={arrowBtn}><ArrowDown size={14} color="#555" /></button>
                                            <button onClick={() => deletePregunta(i)} style={{ ...arrowBtn, background: '#ffebee', marginTop: '10px' }} title="Borrar"><Trash2 size={14} color="#c62828" /></button>
                                        </div>

                                        {/* Contenido Pregunta */}
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            {renderCamposPro(p, i)}
                                        </div>
                                    </div>
                                ))}

                                <button onClick={addPregunta} style={styles.addMoreBtn}>
                                    + AÑADIR OTRA PREGUNTA
                            </button>
                            </div>
                        )}
                </div>

                {/* MODAL CONFIGURACIÓN (RUEDA DENTADA) */}
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
                    <div style={styles.configOverlay}>
                        <div style={styles.configModal}>
                            <div style={styles.configHeader}>
                                <h3>Configuración</h3>
                                <button onClick={() => setMostrandoConfig(false)} style={styles.iconBtnBlack}><X /></button>
                            </div>
                            <div style={styles.configBody}>
                                <h4 style={styles.sectionTitle}>Datos de Búsqueda</h4>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                    <InputConfig label="País" val={datos.pais} set={v => setDatos({ ...datos, pais: v })} />
                                    <InputConfig label="Región" val={datos.region} set={v => setDatos({ ...datos, region: v })} />
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                    <InputConfig label="Localidad" val={datos.poblacion} set={v => setDatos({ ...datos, poblacion: v })} />
                                    <InputConfig
                                        label="Temas"
                                        val={datos.temas} // <--- CAMBIADO (antes ponía datos.temasPreferidos)
                                        set={v => setDatos({ ...datos, temas: v })} // <--- CAMBIADO
                                    />
                                </div>
                                <div style={{ marginBottom: '15px' }}>
                                    <label style={styles.label}>Ciclo Educativo</label>
                                    <select value={datos.ciclo || 'Secundaria'} onChange={e => setDatos({ ...datos, ciclo: e.target.value })} style={styles.input}>
                                        <option value="Infantil">Infantil</option>
                                        <option value="Primaria">Primaria</option>
                                        <option value="Secundaria">Secundaria</option>
                                        <option value="Bachillerato">Bachillerato</option>
                                        <option value="FP">Formación Profesional</option>
                                        <option value="Universidad">Universidad</option>
                                        <option value="Otros">Otros</option>
                                    </select>
                                </div>
                                <h4 style={styles.sectionTitle}>Ajustes de Juego (Global)</h4>
                                <div style={{ marginBottom: '10px' }}>
                                    <label style={styles.label}>Nº de Preguntas a Jugar</label>
                                    <input
                                        type="number"
                                        value={datos.config?.numPreguntas || 10}
                                        onChange={e => updateGlobalConfig('numPreguntas', e.target.value)}
                                        style={styles.input}
                                    />
                                </div>
                                <div style={styles.toggleRow}>
                                    <div><div style={{ fontWeight: 'bold' }}>Orden Aleatorio</div></div>
                                    <button onClick={() => updateGlobalConfig('aleatorio', !datos.config?.aleatorio)} style={{ ...styles.toggleBtn, background: datos.config?.aleatorio ? '#2196F3' : '#ccc', justifyContent: datos.config?.aleatorio ? 'flex-end' : 'flex-start' }}><div style={styles.toggleCircle}></div></button>
                                </div>

                                <h4 style={styles.sectionTitle}>Opciones</h4>
                                <div style={styles.toggleRow}>
                                    <div><div style={{ fontWeight: 'bold' }}>Permitir Copia</div><div style={{ fontSize: '12px', color: '#666' }}>Público para otros profes.</div></div>
                                    <button onClick={togglePermitirCopia} style={{ ...styles.toggleBtn, background: !datos.isPrivate ? '#4CAF50' : '#ccc', justifyContent: !datos.isPrivate ? 'flex-end' : 'flex-start' }}><div style={styles.toggleCircle}></div></button>
                                </div>
                                <div style={styles.toggleRow}>
                                    <div><div style={{ fontWeight: 'bold' }}>Terminado</div><div style={{ fontSize: '12px', color: '#666' }}>Visible para alumnos.</div></div>
                                    <button onClick={toggleTerminado} style={{ ...styles.toggleBtn, background: datos.isFinished ? '#2196F3' : '#ccc', justifyContent: datos.isFinished ? 'flex-end' : 'flex-start' }}><div style={styles.toggleCircle}></div></button>
                                </div>
                            </div>
                            <button onClick={() => setMostrandoConfig(false)} style={styles.closeConfigBtn}>Aceptar</button>
                        </div>
                    </div>
                )}

            </div>
            <style>{`.hide-mobile { display: inline; } .hide-mobile-xs { display: inline; } @media (max-width: 600px) { .hide-mobile { display: none; } .hide-mobile-xs { display: none; } }`}</style>
        </div>
    );
}

function MusicalEditorFields({ p, idx, updatePregunta }) {
    const [videoUrl, setVideoUrl] = useState(p.videoUrl || '');
    const [videoId, setVideoId] = useState(p.videoId || '');
    const [letra, setLetra] = useState(p.letra || '');
    const [blancos, setBlancos] = useState(p.blancos || []);
    const [fetchingLetra, setFetchingLetra] = useState(false);
    const [fetchError, setFetchError] = useState('');
    const [currentTime, setCurrentTime] = useState(0);
    const [playerReady, setPlayerReady] = useState(false);
    const playerRef = useRef(null);
    const timeIntervalRef = useRef(null);
    const playerDivId = `yt-editor-player-${idx}`;

    const extractVideoId = (url) => {
        if (!url) return null;
        const patterns = [/[?&]v=([^&]+)/, /youtu\.be\/([^?&]+)/, /embed\/([^?&]+)/];
        for (const pat of patterns) { const m = url.match(pat); if (m) return m[1]; }
        return null;
    };

    const handleUrlChange = (url) => {
        setVideoUrl(url);
        const id = extractVideoId(url);
        if (id) {
            setVideoId(id);
            updatePregunta(idx, 'videoId', id);
            updatePregunta(idx, 'videoUrl', url);
        }
    };

    const initPlayer = () => {
        if (!window.YT || !window.YT.Player) return;
        if (playerRef.current) { try { playerRef.current.destroy(); } catch(e) {} }
        if (timeIntervalRef.current) clearInterval(timeIntervalRef.current);
        setPlayerReady(false);
        const div = document.getElementById(playerDivId);
        if (!div) return;
        playerRef.current = new window.YT.Player(playerDivId, {
            videoId,
            height: '220',
            width: '100%',
            playerVars: { rel: 0, modestbranding: 1, origin: window.location.origin },
            events: {
                onReady: () => {
                    setPlayerReady(true);
                    timeIntervalRef.current = setInterval(() => {
                        try { setCurrentTime(Math.floor(playerRef.current.getCurrentTime())); } catch(e) {}
                    }, 500);
                }
            }
        });
    };

    useEffect(() => {
        if (!videoId) return;
        const setup = () => setTimeout(initPlayer, 150);
        if (window.YT && window.YT.Player) {
            setup();
        } else {
            if (!document.querySelector('script[src*="youtube.com/iframe_api"]')) {
                const tag = document.createElement('script');
                tag.src = 'https://www.youtube.com/iframe_api';
                document.head.appendChild(tag);
            }
            const prev = window.onYouTubeIframeAPIReady;
            window.onYouTubeIframeAPIReady = () => { if (prev) prev(); setup(); };
        }
        return () => { if (timeIntervalRef.current) clearInterval(timeIntervalRef.current); };
    }, [videoId]);

    const cleanTitle = (s) => s
        .replace(/\|.*$/g, '')
        .replace(/\(.*?\)/g, '')
        .replace(/\[.*?\]/g, '')
        .replace(/feat\..*$/i, '')
        .replace(/ft\..*$/i, '')
        .replace(/VEVO$/i, '')
        .trim();

    const tryLyrics = async (artist, song) => {
        const r = await fetch(`https://api.lyrics.ovh/v1/${encodeURIComponent(artist)}/${encodeURIComponent(song)}`);
        const d = await r.json();
        return d.lyrics || null;
    };

    const fetchLetra = async () => {
        if (!videoId) return;
        setFetchingLetra(true); setFetchError('');
        try {
            const oRes = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`);
            if (!oRes.ok) throw new Error('no_oembed');
            const oData = await oRes.json();
            const title = oData.title || '';
            const sepIdx = title.indexOf(' - ');

            if (sepIdx < 0) throw new Error('no_artist');

            const rawArtist = title.substring(0, sepIdx);
            const rawSong   = title.substring(sepIdx + 3);
            const artist = cleanTitle(rawArtist);
            const song   = cleanTitle(rawSong);

            if (!artist || !song) throw new Error('no_artist');

            // Intento 1: Artista - Canción (orden normal)
            let lyrics = await tryLyrics(artist, song);

            // Intento 2: Canción - Artista (orden invertido, común en canales oficiales)
            if (!lyrics) lyrics = await tryLyrics(song, artist);

            if (lyrics) {
                setLetra(lyrics.trim());
                updatePregunta(idx, 'letra', lyrics.trim());
            } else {
                throw new Error('no_lyrics');
            }
        } catch(e) {
            setFetchError(
                e.message === 'no_artist'
                    ? 'Título sin formato "Artista - Canción". Pega la letra manualmente.'
                    : 'No se encontró la letra automáticamente. Pégala manualmente.'
            );
        }
        setFetchingLetra(false);
    };

    const marcarTimestamp = (bi) => {
        const t = playerReady && playerRef.current ? Math.floor(playerRef.current.getCurrentTime()) : currentTime;
        const nb = blancos.map((b, i) => i === bi ? { ...b, timestamp: t } : b);
        setBlancos(nb); updatePregunta(idx, 'blancos', nb);
    };

    const updateBlancoTimestamp = (bi, val) => {
        const nb = blancos.map((b, i) => i === bi ? { ...b, timestamp: parseInt(val) || 0 } : b);
        setBlancos(nb); updatePregunta(idx, 'blancos', nb);
    };

    const togglePalabra = (rawWord, letraIdx) => {
        const palabra = rawWord.replace(/[^a-zA-ZáéíóúüñÁÉÍÓÚÜÑ']/g, '').trim();
        if (!palabra) return;
        const existingIdx = blancos.findIndex(b => b.letraIdx === letraIdx);
        let nb;
        if (existingIdx >= 0) {
            nb = blancos.filter((_, i) => i !== existingIdx);
        } else {
            nb = [...blancos, { palabra, timestamp: 0, letraIdx }];
            nb.sort((a, b) => a.letraIdx - b.letraIdx);
        }
        setBlancos(nb); updatePregunta(idx, 'blancos', nb);
    };

    const renderLetraInteractiva = () => {
        if (!letra) return null;
        const tokens = [];
        let wordBuf = ''; let wordStart = 0;
        for (let ci = 0; ci <= letra.length; ci++) {
            const c = ci < letra.length ? letra[ci] : null;
            if (c && /[a-zA-ZáéíóúüñÁÉÍÓÚÜÑ']/.test(c)) {
                if (!wordBuf) wordStart = ci;
                wordBuf += c;
            } else {
                if (wordBuf) {
                    const pos = wordStart;
                    const word = wordBuf;
                    const isBlanco = blancos.some(b => b.letraIdx === pos);
                    const blancoNum = blancos.findIndex(b => b.letraIdx === pos) + 1;
                    tokens.push(
                        <span key={`w${pos}`} onClick={() => togglePalabra(word, pos)}
                            style={{ cursor: 'pointer', background: isBlanco ? '#f1c40f' : 'transparent', color: isBlanco ? '#000' : '#ecf0f1', padding: isBlanco ? '1px 3px' : '0', borderRadius: '3px', fontWeight: isBlanco ? 'bold' : 'normal' }}
                            title={isBlanco ? `Blanco #${blancoNum}: clic para quitar` : 'Clic para marcar como blanco'}>
                            {isBlanco ? <><span style={{borderBottom:'2px solid #e67e22'}}>____</span><sup style={{fontSize:'9px',color:'#e67e22'}}>{blancoNum}</sup></> : word}
                        </span>
                    );
                    wordBuf = '';
                }
                if (c === '\n') tokens.push(<br key={`br${ci}`} />);
                else if (c) tokens.push(<span key={`c${ci}`}>{c}</span>);
            }
        }
        return tokens;
    };

    const fmtTime = (s) => `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`;

    return (
        <div style={{ border: '2px solid #9b59b6', borderRadius: '8px', padding: '12px', background: '#1a1a2e' }}>
            <div style={{ textAlign: 'center', color: '#bb8fce', fontWeight: 'bold', marginBottom: '10px', fontSize: '13px' }}>🎵 Pregunta Musical</div>

            <div style={{ marginBottom: '10px' }}>
                <label style={{ color: '#bbb', fontSize: '12px', display: 'block', marginBottom: '4px' }}>URL de YouTube:</label>
                <input placeholder="https://www.youtube.com/watch?v=..." value={videoUrl} onChange={e => handleUrlChange(e.target.value)} className="inp" style={{ borderColor: '#9b59b6', background: '#0d0d1a', color: 'white' }} />
            </div>

            {videoId && (
                <div style={{ marginBottom: '10px' }}>
                    <div id={playerDivId} style={{ width: '100%', minHeight: '220px', background: '#000' }} />
                    <div style={{ textAlign: 'center', color: '#f1c40f', fontSize: '12px', padding: '4px 0', background: 'rgba(0,0,0,0.5)' }}>
                        ⏱ {playerReady ? `Tiempo actual: ${fmtTime(currentTime)}` : 'Cargando reproductor...'}
                    </div>
                </div>
            )}

            <div style={{ marginBottom: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <label style={{ color: '#bbb', fontSize: '12px' }}>Letra de la canción:</label>
                    <div style={{ display: 'flex', gap: '6px' }}>
                        {videoId && <button onClick={fetchLetra} disabled={fetchingLetra} style={{ padding: '4px 10px', background: '#9b59b6', color: 'white', border: 'none', borderRadius: '12px', fontSize: '11px', cursor: 'pointer' }}>{fetchingLetra ? 'Buscando...' : '🔍 Obtener letra'}</button>}
                        {letra && <button onClick={() => { setLetra(''); updatePregunta(idx, 'letra', ''); setBlancos([]); updatePregunta(idx, 'blancos', []); }} style={{ padding: '4px 8px', background: 'transparent', color: '#888', border: '1px solid #555', borderRadius: '10px', fontSize: '11px', cursor: 'pointer' }}>Cambiar letra</button>}
                    </div>
                </div>
                {fetchError && <div style={{ color: '#e74c3c', fontSize: '11px', marginBottom: '5px' }}>{fetchError}</div>}
                {letra ? (
                    <>
                        <div style={{ background: '#0d0d1a', border: '1px solid #9b59b6', borderRadius: '5px', padding: '10px', maxHeight: '200px', overflowY: 'auto', lineHeight: '2', fontSize: '13px', fontFamily: 'monospace', userSelect: 'none' }}>
                            {renderLetraInteractiva()}
                        </div>
                        <div style={{ color: '#888', fontSize: '11px', marginTop: '4px' }}>💡 Haz clic en las palabras para marcarlas como blancos</div>
                    </>
                ) : (
                    <textarea placeholder="Pega la letra de la canción aquí..." value={letra} onChange={e => { setLetra(e.target.value); updatePregunta(idx, 'letra', e.target.value); }} rows={6}
                        style={{ width: '100%', padding: '8px', background: '#0d0d1a', color: '#ecf0f1', border: '1px solid #9b59b6', borderRadius: '5px', resize: 'vertical', boxSizing: 'border-box', fontFamily: 'monospace', fontSize: '13px' }} />
                )}
            </div>

            {blancos.length > 0 && (
                <div style={{ background: '#0d0d1a', border: '1px solid #e67e22', borderRadius: '5px', padding: '10px' }}>
                    <div style={{ color: '#e67e22', fontWeight: 'bold', fontSize: '12px', marginBottom: '8px' }}>Blancos configurados ({blancos.length}) — establece el momento de pausa:</div>
                    {blancos.map((b, bi) => (
                        <div key={bi} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', flexWrap: 'wrap' }}>
                            <span style={{ color: '#f1c40f', fontWeight: 'bold', fontSize: '12px', minWidth: '22px' }}>#{bi+1}</span>
                            <span style={{ color: '#ecf0f1', fontWeight: 'bold', fontSize: '13px', minWidth: '70px' }}>{b.palabra}</span>
                            <input type="number" value={b.timestamp} onChange={e => updateBlancoTimestamp(bi, e.target.value)}
                                style={{ width: '65px', padding: '3px 6px', background: '#1a1a2e', color: '#ecf0f1', border: '1px solid #555', borderRadius: '4px', fontSize: '12px' }} placeholder="seg" />
                            <span style={{ color: '#888', fontSize: '11px' }}>{fmtTime(b.timestamp)}</span>
                            {playerReady && (
                                <button onClick={() => marcarTimestamp(bi)} style={{ padding: '3px 8px', background: '#e67e22', color: 'white', border: 'none', borderRadius: '10px', fontSize: '11px', cursor: 'pointer' }}>
                                    📍 Marcar ahora
                                </button>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {blancos.length === 0 && letra && (
                <div style={{ color: '#777', fontSize: '12px', textAlign: 'center', padding: '8px', border: '1px dashed #555', borderRadius: '5px' }}>
                    Sin blancos aún. Haz clic en palabras de la letra para añadirlos.
                </div>
            )}
        </div>
    );
}

const InputConfig = ({ label, val, set }) => (<div style={{ marginBottom: '10px' }}><label style={{ display: 'block', fontSize: '12px', color: '#666', fontWeight: 'bold' }}>{label}</label><input value={val || ''} onChange={(e) => set(e.target.value)} style={styles.input} /></div>);

const styles = {
    overlay: { position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: '#f0f2f5', zIndex: 3000, display: 'flex', flexDirection: 'column' },
    container: { display: 'flex', flexDirection: 'column', height: '100%', width: '100%', maxWidth: '1000px', margin: '0 auto', background: 'white', boxShadow: '0 0 20px rgba(0,0,0,0.1)' },

    header: { background: '#2c3e50', padding: '10px 15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'white', gap: '10px' },
    titleInput: { background: 'rgba(255,255,255,0.2)', border: 'none', color: 'white', fontSize: '16px', padding: '5px 10px', borderRadius: '4px', flex: 1, minWidth: 0, outline: 'none' },
    iconBtn: { background: 'none', border: 'none', color: 'white', cursor: 'pointer', padding: '5px', display: 'flex', alignItems: 'center' },
    saveBtn: { background: '#27ae60', border: 'none', color: 'white', padding: '8px 15px', borderRadius: '20px', display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer', fontWeight: 'bold', whiteSpace: 'nowrap' },

    tabsContainer: { background: '#ecf0f1', padding: '10px 10px 0 10px', display: 'flex', gap: '5px', overflowX: 'auto', borderBottom: '1px solid #bdc3c7' },
    tab: { padding: '10px 20px', borderRadius: '8px 8px 0 0', cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px', minWidth: '100px' },
    tabInput: { border: 'none', background: 'transparent', fontWeight: 'bold', width: '80px', outline: 'none', color: 'inherit' },
    addTabBtn: { padding: '8px', background: 'transparent', border: 'none', cursor: 'pointer', color: '#2c3e50' },

    body: { flex: 1, padding: '15px', overflowY: 'auto', background: '#f4f6f7' },
    addFirstBtn: { marginTop: '20px', padding: '12px 25px', background: '#3498db', color: 'white', border: 'none', borderRadius: '30px', cursor: 'pointer', fontSize: '1rem', boxShadow: '0 4px 10px rgba(52, 152, 219, 0.3)' },
    addMoreBtn: { width: '100%', padding: '15px', border: '2px dashed #bdc3c7', background: 'transparent', borderRadius: '10px', color: '#7f8c8d', fontWeight: 'bold', cursor: 'pointer', marginTop: '10px', fontSize: '1rem' },

    label: { display: 'block', marginBottom: '5px', fontWeight: 'bold', fontSize: '13px', color: '#333' },
    input: { width: '100%', padding: '10px', borderRadius: '5px', border: '1px solid #ddd', boxSizing: 'border-box', fontSize: '14px' },

    // Config Modal Styles (Igual que Manual)
    configOverlay: { position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 4000 },
    configModal: { background: 'white', width: '90%', maxWidth: '400px', borderRadius: '15px', maxHeight: '85vh', display: 'flex', flexDirection: 'column', boxShadow: '0 10px 25px rgba(0,0,0,0.2)' },
    configHeader: { padding: '15px', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
    iconBtnBlack: { background: 'none', border: 'none', cursor: 'pointer', padding: '5px' },
    configBody: { padding: '20px', overflowY: 'auto', flex: 1 },
    sectionTitle: { margin: '20px 0 10px 0', color: '#3F51B5', borderBottom: '2px solid #eee', paddingBottom: '5px' },
    closeConfigBtn: { width: '100%', padding: '15px', background: '#333', color: 'white', border: 'none', borderBottomLeftRadius: '15px', borderBottomRightRadius: '15px', fontSize: '16px', cursor: 'pointer' },
    toggleRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', padding: '10px', background: '#f5f5f5', borderRadius: '8px' },
    toggleBtn: { width: '50px', height: '26px', borderRadius: '13px', border: 'none', padding: '2px', cursor: 'pointer', display: 'flex', alignItems: 'center', transition: 'background 0.3s' },
    toggleCircle: { width: '22px', height: '22px', background: 'white', borderRadius: '50%', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }
};