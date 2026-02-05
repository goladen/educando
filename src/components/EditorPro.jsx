import { useState, useEffect } from 'react';
import { Save, X, Trash2, FolderPlus, ArrowUp, ArrowDown, Clock, Trophy, GripVertical, Image as ImageIcon, Type, List, AlignCenter, MoreHorizontal, Settings } from 'lucide-react';

export default function EditorPro({ datos, setDatos, onClose, onSave }) {
    const [hojaActiva, setHojaActiva] = useState(0);
    const [mostrandoConfig, setMostrandoConfig] = useState(false);

    // Asegurar que el recurso se marca como PRO y tiene configuración base
    useEffect(() => {
        if (datos && (!datos.tipo || datos.tipo !== 'PRO')) {
            setDatos(prev => ({
                ...prev,
                tipo: 'PRO',
                config: {
                    ...prev.config,
                    aleatorio: true,
                    numPreguntas: 10
                }
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
                        <button onClick={onSave} style={styles.saveBtn}>
                            <Save size={18} /> <span className="hide-mobile">Guardar</span>
                        </button>
                        <button onClick={onClose} style={styles.iconBtn}>
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
                                    <div key={i} style={{ background: 'white', padding: '15px', borderRadius: '12px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)', display: 'flex', alignItems: 'flex-start', gap: '10px', borderLeft: `5px solid ${p.tipo === 'PRESENTATION' ? '#95a5a6' : '#3498db'}` }}>

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
                {mostrandoConfig && (
                    <div style={styles.configOverlay}>
                        <div style={styles.configModal}>
                            <div style={styles.configHeader}>
                                <h3>Configuración</h3>
                                <button onClick={() => setMostrandoConfig(false)} style={styles.iconBtnBlack}><X /></button>
                            </div>
                            <div style={styles.configBody}>
                                <h4 style={styles.sectionTitle}>Ubicación</h4>
                                <InputConfig label="País" val={datos.pais} set={v => setDatos({ ...datos, pais: v })} />
                                <InputConfig label="Región" val={datos.region} set={v => setDatos({ ...datos, region: v })} />
                                <InputConfig label="Población" val={datos.poblacion} set={v => setDatos({ ...datos, poblacion: v })} />
                                <InputConfig label="Temas" val={datos.temas} set={v => setDatos({ ...datos, temas: v })} />

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