import { useState, useEffect } from 'react';
import { Save, X, Trash2, FolderPlus, ArrowUp, ArrowDown, Clock, Trophy, GripVertical, Image as ImageIcon, Type, List, AlignCenter, MoreHorizontal } from 'lucide-react';

export default function EditorPro({ datos, setDatos, onClose, onSave }) {
    const [hojaActiva, setHojaActiva] = useState(0);

    // Asegurar que el recurso se marca como PRO y tiene configuración base
    useEffect(() => {
        if (datos && (!datos.tipo || datos.tipo !== 'PRO')) {
            setDatos(prev => ({
                ...prev,
                tipo: 'PRO', // Marca fundamental para ThinkHootGame
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
        // Estructura base de una pregunta PRO
        const nuevaP = {
            tipo: 'SIMPLE', // Por defecto
            pregunta: '',
            tiempo: 20,
            puntosMax: 100,
            puntosMin: 10,
            // Campos específicos inicializados
            respuesta: '', // Para simple
            correcta: '', incorrectas: ['', '', ''], // Para multiple
            bloques: [], // Para ordenar/rellenar/presentacion
            numBloques: 4 // Auxiliar para ordenar
        };
        nuevas[hojaActiva].preguntas.push(nuevaP);
        setDatos({ ...datos, hojas: nuevas });
    };

    const updatePregunta = (idx, field, val) => {
        const nuevas = [...datos.hojas];
        nuevas[hojaActiva].preguntas[idx][field] = val;
        setDatos({ ...datos, hojas: nuevas });
    };

    // Actualización especial para arrays (bloques, incorrectas)
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

    // --- RENDERIZADO DE CAMPOS ESPECÍFICOS SEGÚN TIPO ---
    const renderCamposPro = (p, i) => {
        const tipo = p.tipo || 'SIMPLE';

        return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '100%' }}>

                {/* 1. SELECTOR DE TIPO Y CONFIGURACIÓN BÁSICA (Tiempo/Puntos) */}
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center', background: '#f0f4f8', padding: '8px', borderRadius: '5px' }}>
                    <select
                        value={tipo}
                        onChange={(e) => updatePregunta(i, 'tipo', e.target.value)}
                        style={{ ...inputStyleSmall, fontWeight: 'bold', width: '150px', border: '1px solid #3498db', color: '#3498db' }}
                    >
                        <option value="SIMPLE">Respuesta Corta</option>
                        <option value="MULTIPLE">Selección Múltiple</option>
                        <option value="ORDENAR">Ordenar</option>
                        <option value="RELLENAR">Rellenar Hueco</option>
                        <option value="PRESENTATION">Presentación</option>
                    </select>

                    {/* Si NO es presentación, mostramos config de puntos y tiempo */}
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

                {/* --- RESPUESTA CORTA --- */}
                {tipo === 'SIMPLE' && (
                    <>
                        <input placeholder="Escribe la pregunta..." value={p.pregunta} onChange={e => updatePregunta(i, 'pregunta', e.target.value)} className="inp" style={{ fontWeight: 'bold' }} />
                        <input placeholder="Respuesta Correcta" value={p.respuesta} onChange={e => updatePregunta(i, 'respuesta', e.target.value)} className="inp" style={{ borderColor: '#2ecc71' }} />
                    </>
                )}

                {/* --- SELECCIÓN MÚLTIPLE --- */}
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

                {/* --- ORDENAR --- */}
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
                                    // Ajustar array de bloques
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
                                <input
                                    key={k}
                                    placeholder={`Parte ${k + 1}`}
                                    value={b}
                                    onChange={e => updatePreguntaArray(i, 'bloques', k, e.target.value)}
                                    className="inp"
                                    style={{ flex: '1 1 45%', minWidth: '100px' }}
                                />
                            ))}
                        </div>
                    </>
                )}

                {/* --- RELLENAR --- */}
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

                {/* --- PRESENTACIÓN --- */}
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
    const inputStyle = { width: '100%', padding: '10px', borderRadius: '5px', border: '1px solid #ccc', boxSizing: 'border-box' };
    const inputStyleSmall = { padding: '5px', borderRadius: '5px', border: '1px solid #ccc', fontSize: '12px' };
    const arrowBtn = { background: '#eee', border: 'none', cursor: 'pointer', fontSize: '10px', padding: '4px', borderRadius: '3px', display: 'flex', alignItems: 'center', justifyContent: 'center' };
    const statBox = { display: 'flex', alignItems: 'center', gap: '3px', background: 'white', padding: '3px 8px', borderRadius: '15px', border: '1px solid #ddd' };
    const miniInput = { width: '40px', border: 'none', borderBottom: '1px solid #ccc', textAlign: 'center', outline: 'none', fontSize: '12px' };
    const miniSelect = { padding: '2px', borderRadius: '3px', border: '1px solid #ccc' };

    return (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.8)', zIndex: 2000, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            <style>{`.inp { padding: 8px; border: 1px solid #ddd; borderRadius: 4px; outline: none; width: 100%; box-sizing: border-box; } .inp:focus { border-color: #2196F3; }`}</style>

            <div style={{ background: 'white', width: '95%', height: '95%', borderRadius: '15px', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 0 20px rgba(0,0,0,0.5)' }}>

                {/* HEADER */}
                <div style={{ padding: '15px', background: '#2c3e50', color: 'white', borderBottom: '1px solid #34495e', display: 'flex', gap: '20px', alignItems: 'center' }}>
                    <h2 style={{ margin: 0, color: '#f1c40f', display: 'flex', alignItems: 'center', gap: '10px' }}><Save size={24} /> Editor PRO</h2>
                    <input placeholder="Título del Recurso PRO" value={datos.titulo} onChange={e => setDatos({ ...datos, titulo: e.target.value })} style={{ ...inputStyle, width: '300px', marginBottom: 0, background: 'rgba(255,255,255,0.1)', color: 'white', border: 'none' }} />

                    {/* Configuración Global Rápida */}
                    <div style={{ display: 'flex', gap: '15px', alignItems: 'center', marginLeft: 'auto', marginRight: '20px' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer', fontSize: '13px' }}>
                            <input type="checkbox" checked={datos.config?.aleatorio || false} onChange={e => updateGlobalConfig('aleatorio', e.target.checked)} />
                            Orden Aleatorio
                        </label>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '13px' }}>
                            <span>Nº Preguntas:</span>
                            <input type="number" value={datos.config?.numPreguntas || 10} onChange={e => updateGlobalConfig('numPreguntas', e.target.value)} style={{ width: '50px', padding: '3px', borderRadius: '3px', border: 'none', color: 'black' }} />
                        </div>
                    </div>

                    <button onClick={onSave} style={{ background: '#27ae60', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '5px' }}>GUARDAR</button>
                    <button onClick={onClose} style={{ background: '#c0392b', color: 'white', border: 'none', padding: '10px', borderRadius: '5px', cursor: 'pointer' }}><X size={18} /></button>
                </div>

                {/* TABS HOJAS */}
                <div style={{ background: '#ecf0f1', padding: '10px 10px 0 10px', display: 'flex', gap: '5px', overflowX: 'auto', borderBottom: '1px solid #bdc3c7' }}>
                    {datos.hojas.map((h, i) => (
                        <div key={i} onClick={() => setHojaActiva(i)} style={{
                            padding: '10px 20px',
                            background: i === hojaActiva ? 'white' : '#bdc3c7',
                            color: i === hojaActiva ? '#2c3e50' : '#555',
                            borderRadius: '8px 8px 0 0',
                            cursor: 'pointer',
                            fontWeight: 'bold',
                            display: 'flex', alignItems: 'center', gap: '8px',
                            minWidth: '100px',
                            boxShadow: i === hojaActiva ? '0 -2px 5px rgba(0,0,0,0.05)' : 'none'
                        }}>
                            <input value={h.nombreHoja} onChange={(e) => renameHoja(i, e.target.value)} style={{ border: 'none', background: 'transparent', fontWeight: 'bold', width: '80px', outline: 'none', color: 'inherit' }} onClick={e => e.stopPropagation()} />
                            {datos.hojas.length > 1 && <Trash2 size={14} onClick={(e) => { e.stopPropagation(); deleteHoja(i) }} style={{ cursor: 'pointer' }} />}
                        </div>
                    ))}
                    <button onClick={addHoja} style={{ padding: '8px', background: 'transparent', border: 'none', cursor: 'pointer', color: '#2c3e50' }} title="Añadir Grupo"><FolderPlus size={24} /></button>
                </div>

                {/* AREA PREGUNTAS */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '30px', background: '#f4f6f7' }}>
                    {datos.hojas[hojaActiva]?.preguntas.length === 0 ? (
                        <div style={{ textAlign: 'center', color: '#95a5a6', marginTop: '50px' }}>
                            <div style={{ fontSize: '3rem', marginBottom: '10px' }}>📭</div>
                            <p style={{ fontSize: '1.2rem' }}>Este grupo no tiene preguntas aún.</p>
                            <button onClick={addPregunta} style={{ marginTop: '20px', padding: '12px 25px', background: '#3498db', color: 'white', border: 'none', borderRadius: '30px', cursor: 'pointer', fontSize: '1rem', boxShadow: '0 4px 10px rgba(52, 152, 219, 0.3)' }}>+ Añadir Primera Pregunta</button>
                        </div>
                    ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', maxWidth: '800px', margin: '0 auto' }}>
                                {datos.hojas[hojaActiva]?.preguntas.map((p, i) => (
                                    <div key={i} style={{ background: 'white', padding: '20px', borderRadius: '12px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)', display: 'flex', alignItems: 'flex-start', gap: '15px', borderLeft: `5px solid ${p.tipo === 'PRESENTATION' ? '#95a5a6' : '#3498db'}` }}>

                                        {/* Controles Izquierda */}
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', alignItems: 'center', paddingTop: '5px' }}>
                                            <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#bdc3c7', marginBottom: '5px' }}>#{i + 1}</div>
                                            <button onClick={() => moverPregunta(i, -1)} disabled={i === 0} style={arrowBtn}><ArrowUp size={14} color="#555" /></button>
                                            <button onClick={() => moverPregunta(i, 1)} disabled={i === datos.hojas[hojaActiva].preguntas.length - 1} style={arrowBtn}><ArrowDown size={14} color="#555" /></button>
                                            <button onClick={() => deletePregunta(i)} style={{ ...arrowBtn, background: '#ffebee', marginTop: '10px' }} title="Borrar"><Trash2 size={14} color="#c62828" /></button>
                                        </div>

                                        {/* Contenido Pregunta */}
                                        <div style={{ flex: 1 }}>
                                            {renderCamposPro(p, i)}
                                        </div>
                                    </div>
                                ))}

                                <button onClick={addPregunta} style={{ width: '100%', padding: '15px', border: '2px dashed #bdc3c7', background: 'transparent', borderRadius: '10px', color: '#7f8c8d', fontWeight: 'bold', cursor: 'pointer', marginTop: '10px', fontSize: '1rem' }}>
                                    + AÑADIR OTRA PREGUNTA
                            </button>
                            </div>
                        )}
                </div>
            </div>
        </div>
    );
}