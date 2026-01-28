import { useState } from 'react';
import { Trash2, Plus, Save, X, ChevronDown, ChevronUp } from 'lucide-react';

export default function EditorManual({ datos, setDatos, configJuego, onClose, onSave }) {
    const [hojaActiva, setHojaActiva] = useState(0);

    // --- MANEJO DE HOJAS ---
    const addHoja = () => {
        const nuevasHojas = [...datos.hojas, { nombreHoja: `Hoja ${datos.hojas.length + 1}`, preguntas: [] }];
        setDatos({ ...datos, hojas: nuevasHojas });
        setHojaActiva(nuevasHojas.length - 1);
    };

    const removeHoja = (index) => {
        if (datos.hojas.length === 1) return alert("Debe haber al menos una hoja.");
        const nuevasHojas = datos.hojas.filter((_, i) => i !== index);
        setDatos({ ...datos, hojas: nuevasHojas });
        setHojaActiva(0);
    };

    const updateNombreHoja = (index, nombre) => {
        const nuevasHojas = [...datos.hojas];
        nuevasHojas[index].nombreHoja = nombre;
        setDatos({ ...datos, hojas: nuevasHojas });
    };

    // --- CAMPO ESPECIAL PARA LA RULETA (FRASE) ---
    const updateFraseHoja = (index, frase) => {
        const nuevasHojas = [...datos.hojas];
        nuevasHojas[index].frase = frase; // Guardamos la frase en la hoja
        setDatos({ ...datos, hojas: nuevasHojas });
    };

    // --- MANEJO DE PREGUNTAS ---
    const addPregunta = (indexHoja) => {
        const nuevasHojas = [...datos.hojas];
        // Estructura base de pregunta
        nuevasHojas[indexHoja].preguntas.push({
            pregunta: '',
            respuesta: '', // Correcta
            incorrectas: ['', '', ''] // Opcionales
        });
        setDatos({ ...datos, hojas: nuevasHojas });
    };

    const updatePregunta = (indexHoja, indexPregunta, campo, valor) => {
        const nuevasHojas = [...datos.hojas];
        nuevasHojas[indexHoja].preguntas[indexPregunta][campo] = valor;
        setDatos({ ...datos, hojas: nuevasHojas });
    };

    const updateIncorrecta = (indexHoja, indexPregunta, indexInc, valor) => {
        const nuevasHojas = [...datos.hojas];
        const incorrectas = [...nuevasHojas[indexHoja].preguntas[indexPregunta].incorrectas];
        incorrectas[indexInc] = valor;
        nuevasHojas[indexHoja].preguntas[indexPregunta].incorrectas = incorrectas;
        setDatos({ ...datos, hojas: nuevasHojas });
    };

    const removePregunta = (indexHoja, indexPregunta) => {
        const nuevasHojas = [...datos.hojas];
        nuevasHojas[indexHoja].preguntas = nuevasHojas[indexHoja].preguntas.filter((_, i) => i !== indexPregunta);
        setDatos({ ...datos, hojas: nuevasHojas });
    };

    // --- CONFIGURACIÓN GLOBAL ---
    const updateConfig = (key, val) => {
        setDatos({ ...datos, config: { ...datos.config, [key]: val } });
    };

    return (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 2000 }}>
            <div style={{ background: 'white', width: '90%', maxWidth: '900px', height: '90%', borderRadius: '10px', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

                {/* HEADER */}
                <div style={{ padding: '15px', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: configJuego.color, color: 'white' }}>
                    <h2 style={{ margin: 0 }}>Editor: {configJuego.label}</h2>
                    <div style={{ display: 'flex', gap: '10px' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '14px', cursor: 'pointer' }}>
                            <input type="checkbox" checked={datos.isPrivate || false} onChange={e => setDatos({ ...datos, isPrivate: e.target.checked })} />
                            Privado
                        </label>
                        <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer' }}><X /></button>
                    </div>
                </div>

                {/* BODY */}
                <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

                    {/* SIDEBAR (HOJAS) */}
                    <div style={{ width: '200px', background: '#f5f5f5', borderRight: '1px solid #ddd', padding: '10px', overflowY: 'auto' }}>
                        <h4 style={{ margin: '0 0 10px 0', fontSize: '12px', color: '#666', textTransform: 'uppercase' }}>Hojas / Categorías</h4>
                        {datos.hojas.map((h, i) => (
                            <div key={i} onClick={() => setHojaActiva(i)} style={{ padding: '10px', marginBottom: '5px', background: hojaActiva === i ? 'white' : 'transparent', borderRadius: '5px', cursor: 'pointer', border: hojaActiva === i ? '1px solid #ccc' : 'none', fontWeight: hojaActiva === i ? 'bold' : 'normal', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '140px' }}>{h.nombreHoja}</span>
                                {datos.hojas.length > 1 && <Trash2 size={14} color="#999" onClick={(e) => { e.stopPropagation(); removeHoja(i); }} />}
                            </div>
                        ))}
                        <button onClick={addHoja} style={{ width: '100%', padding: '8px', border: '1px dashed #ccc', background: 'white', marginTop: '10px', cursor: 'pointer', color: '#666', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '5px' }}>
                            <Plus size={14} /> Nueva Hoja
                        </button>
                    </div>

                    {/* CONTENIDO PRINCIPAL */}
                    <div style={{ flex: 1, padding: '20px', overflowY: 'auto' }}>

                        {/* CONFIGURACIÓN DE LA HOJA */}
                        <div style={{ marginBottom: '20px', paddingBottom: '20px', borderBottom: '1px solid #eee' }}>
                            <label style={lbl}>Nombre de la Hoja / Categoría</label>
                            <input
                                value={datos.hojas[hojaActiva].nombreHoja}
                                onChange={e => updateNombreHoja(hojaActiva, e.target.value)}
                                style={{ ...inputStyle, fontSize: '18px', fontWeight: 'bold' }}
                            />

                            {/* 🟢 CAMPO ESPECIAL: FRASE DE RULETA */}
                            {configJuego.id === 'RULETA' && (
                                <div style={{ marginTop: '15px', background: '#fff9c4', padding: '15px', borderRadius: '8px', border: '1px solid #f1c40f' }}>
                                    <label style={{ ...lbl, color: '#d35400', fontWeight: 'bold' }}>🎡 Frase a adivinar (Panel Oculto)</label>
                                    <input
                                        placeholder="Ej: A QUIEN MADRUGA DIOS LE AYUDA"
                                        value={datos.hojas[hojaActiva].frase || ''}
                                        onChange={e => updateFraseHoja(hojaActiva, e.target.value)}
                                        style={{ ...inputStyle, marginBottom: 0, borderColor: '#f1c40f' }}
                                    />
                                    <small style={{ color: '#666', fontSize: '11px' }}>Esta es la frase que los alumnos tendrán que resolver al final.</small>
                                </div>
                            )}
                        </div>

                        {/* LISTA DE PREGUNTAS */}
                        {datos.hojas[hojaActiva].preguntas.map((p, i) => (
                            <div key={i} style={{ background: 'white', border: '1px solid #ddd', borderRadius: '8px', padding: '15px', marginBottom: '15px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                                    <span style={{ fontWeight: 'bold', color: '#ccc' }}>#{i + 1}</span>
                                    <button onClick={() => removePregunta(hojaActiva, i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#e74c3c' }}><Trash2 size={16} /></button>
                                </div>

                                <div style={{ marginBottom: '10px' }}>
                                    <input placeholder="Pregunta" value={p.pregunta} onChange={e => updatePregunta(hojaActiva, i, 'pregunta', e.target.value)} style={inputStyle} />
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                    <div>
                                        <label style={{ ...lbl, color: '#27ae60' }}>Respuesta Correcta</label>
                                        <input placeholder="Respuesta Correcta" value={p.respuesta || p.correcta || ''} onChange={e => updatePregunta(hojaActiva, i, 'respuesta', e.target.value)} style={{ ...inputStyle, borderColor: '#2ecc71', background: '#f0fff4' }} />
                                    </div>
                                    <div>
                                        <label style={lbl}>Incorrectas (Opcional - Para Test)</label>
                                        {(p.incorrectas || ['', '', '']).map((inc, k) => (
                                            <input key={k} placeholder={`Incorrecta ${k + 1}`} value={inc} onChange={e => updateIncorrecta(hojaActiva, i, k, e.target.value)} style={{ ...inputStyle, marginBottom: '5px', fontSize: '13px' }} />
                                        ))}
                                    </div>
                                </div>
                            </div>
                        ))}

                        <button onClick={() => addPregunta(hojaActiva)} style={{ width: '100%', padding: '15px', border: '2px dashed #ccc', borderRadius: '10px', background: 'none', color: '#666', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                            <Plus /> Añadir Pregunta
                        </button>
                    </div>

                    {/* SIDEBAR DERECHO (CONFIGURACIÓN) */}
                    <div style={{ width: '250px', background: 'white', borderLeft: '1px solid #ddd', padding: '15px', overflowY: 'auto' }}>
                        <h4 style={{ margin: '0 0 15px 0' }}>Configuración</h4>

                        {/* INPUTS DE METADATOS */}
                        <div style={{ marginBottom: '15px' }}><label style={lbl}>País</label><input value={datos.pais} onChange={e => setDatos({ ...datos, pais: e.target.value })} style={inputStyle} /></div>
                        <div style={{ marginBottom: '15px' }}><label style={lbl}>Región</label><input value={datos.region} onChange={e => setDatos({ ...datos, region: e.target.value })} style={inputStyle} /></div>
                        <div style={{ marginBottom: '15px' }}><label style={lbl}>Población</label><input value={datos.poblacion} onChange={e => setDatos({ ...datos, poblacion: e.target.value })} style={inputStyle} /></div>

                        <hr style={{ border: 'none', borderTop: '1px solid #eee', margin: '15px 0' }} />

                        <h4 style={{ margin: '0 0 10px 0', fontSize: '13px', color: '#555' }}>Parámetros del Juego</h4>
                        {configJuego.camposConfig.map(campo => (
                            <div key={campo.key} style={{ marginBottom: '10px' }}>
                                <label style={lbl}>{campo.label}</label>
                                <input
                                    type={campo.type}
                                    value={datos.config?.[campo.key] || campo.default}
                                    onChange={e => updateConfig(campo.key, e.target.value)}
                                    style={inputStyle}
                                />
                            </div>
                        ))}
                    </div>
                </div>

                {/* FOOTER */}
                <div style={{ padding: '15px', borderTop: '1px solid #eee', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                    <button onClick={onClose} style={{ padding: '10px 20px', border: '1px solid #ccc', background: 'white', borderRadius: '5px', cursor: 'pointer' }}>Cancelar</button>
                    <button onClick={onSave} style={{ padding: '10px 20px', border: 'none', background: configJuego.color, color: 'white', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <Save size={18} /> Guardar Recurso
                    </button>
                </div>
            </div>
        </div>
    );
}

const inputStyle = { width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc', boxSizing: 'border-box', marginBottom: '5px', fontSize: '14px' };
const lbl = { fontSize: '11px', color: '#666', fontWeight: 'bold', display: 'block', marginBottom: '3px' };