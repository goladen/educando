import { useState } from 'react';
import { Trash2, Plus, Save, X, RefreshCw } from 'lucide-react';

export default function EditorManual({ datos, setDatos, configJuego, onClose, onSave }) {
    const [hojaActiva, setHojaActiva] = useState(0);

    const generarCodigoHoja = () => {
        const c = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let r = ''; for (let i = 0; i < 5; i++) r += c.charAt(Math.floor(Math.random() * c.length));
        return r;
    };

    // --- MANEJO DE HOJAS ---
    const addHoja = () => {
        const codigo = configJuego.id === 'QUESTION_SENDER' ? generarCodigoHoja() : null;
        const nuevasHojas = [...datos.hojas, { nombreHoja: `Hoja ${datos.hojas.length + 1}`, preguntas: [], accessCode: codigo }];
        setDatos({ ...datos, hojas: nuevasHojas });
        setHojaActiva(nuevasHojas.length - 1);
    };

    const generarCodigoParaHojaActiva = () => {
        const nuevasHojas = [...datos.hojas];
        nuevasHojas[hojaActiva].accessCode = generarCodigoHoja();
        setDatos({ ...datos, hojas: nuevasHojas });
    };

    const removeHoja = (index) => { if (datos.hojas.length === 1) return alert("Mínimo una hoja."); setDatos({ ...datos, hojas: datos.hojas.filter((_, i) => i !== index) }); setHojaActiva(0); };
    const updateNombreHoja = (index, nombre) => { const h = [...datos.hojas]; h[index].nombreHoja = nombre; setDatos({ ...datos, hojas: h }); };
    const updateFraseHoja = (index, frase) => { const h = [...datos.hojas]; h[index].frase = frase; setDatos({ ...datos, hojas: h }); };

    // --- MANEJO DE PREGUNTAS ---
    const addPregunta = (indexHoja) => {
        const h = [...datos.hojas];
        h[indexHoja].preguntas.push({ pregunta: '', respuesta: '', incorrectas: ['', '', ''], letra: '' });
        setDatos({ ...datos, hojas: h });
    };

    const updatePregunta = (idxHoja, idxPreg, field, val) => { const h = [...datos.hojas]; h[idxHoja].preguntas[idxPreg][field] = val; setDatos({ ...datos, hojas: h }); };
    const removePregunta = (idxHoja, idxPreg) => { const h = [...datos.hojas]; h[idxHoja].preguntas = h[idxHoja].preguntas.filter((_, i) => i !== idxPreg); setDatos({ ...datos, hojas: h }); };
    const updateIncorrecta = (hIdx, pIdx, iIdx, val) => { const h = [...datos.hojas]; h[hIdx].preguntas[pIdx].incorrectas[iIdx] = val; setDatos({ ...datos, hojas: h }); };

    const updateConfig = (key, val) => setDatos({ ...datos, config: { ...datos.config, [key]: val } });

    // --- DETERMINAR QUÉ CAMPOS MOSTRAR ---
    // Si es Question Sender, miramos el targetGame. Si no, miramos el configJuego.id actual.
    const juegoActual = configJuego.id === 'QUESTION_SENDER' ? (datos.targetGame || 'PASAPALABRA') : configJuego.id;

    const esPasapalabra = juegoActual === 'PASAPALABRA';
    const esAparejados = juegoActual === 'APAREJADOS';
    const usaIncorrectas = ['THINKHOOT', 'CAZABURBUJAS', 'RULETA'].includes(juegoActual);

    return (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 2000 }}>
            <div style={{ background: 'white', width: '90%', maxWidth: '900px', height: '90%', borderRadius: '10px', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

                {/* HEADER */}
                <div style={{ padding: '15px', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: configJuego.color, color: 'white' }}>
                    <h2 style={{ margin: 0 }}>{configJuego.id === 'QUESTION_SENDER' ? 'Configurar Recogida de Preguntas' : `Editor: ${configJuego.label}`}</h2>
                    <div style={{ display: 'flex', gap: '10px' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '14px', cursor: 'pointer' }}>
                            <input type="checkbox" checked={datos.isPrivate || false} onChange={e => setDatos({ ...datos, isPrivate: e.target.checked })} /> Privado
                        </label>
                        <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer' }}><X /></button>
                    </div>
                </div>

                {/* BODY */}
                <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

                    {/* SIDEBAR (HOJAS) */}
                    <div style={{ width: '200px', background: '#f5f5f5', borderRight: '1px solid #ddd', padding: '10px', overflowY: 'auto' }}>
                        {datos.hojas.map((h, i) => (
                            <div key={i} onClick={() => setHojaActiva(i)} style={{ padding: '10px', marginBottom: '5px', background: hojaActiva === i ? 'white' : 'transparent', borderRadius: '5px', cursor: 'pointer', border: hojaActiva === i ? '1px solid #ccc' : 'none', fontWeight: hojaActiva === i ? 'bold' : 'normal', display: 'flex', justifyContent: 'space-between' }}>
                                <span>{h.nombreHoja}</span>
                                {datos.hojas.length > 1 && <Trash2 size={14} color="#999" onClick={(e) => { e.stopPropagation(); removeHoja(i); }} />}
                            </div>
                        ))}
                        <button onClick={addHoja} style={{ width: '100%', padding: '8px', border: '1px dashed #ccc', background: 'white', marginTop: '10px', cursor: 'pointer', color: '#666' }}><Plus size={14} /> Nueva Hoja</button>
                    </div>

                    {/* CONTENIDO PRINCIPAL */}
                    <div style={{ flex: 1, padding: '20px', overflowY: 'auto' }}>

                        <div style={{ marginBottom: '20px', paddingBottom: '20px', borderBottom: '1px solid #eee' }}>
                            <label style={lbl}>Nombre de la Hoja</label>
                            <input value={datos.hojas[hojaActiva].nombreHoja} onChange={e => updateNombreHoja(hojaActiva, e.target.value)} style={{ ...inputStyle, fontSize: '18px', fontWeight: 'bold' }} />

                            {configJuego.id === 'QUESTION_SENDER' && (
                                <div style={{ marginTop: '10px', background: '#e3f2fd', padding: '10px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <div><label style={lbl}>Código Alumnos:</label><div style={{ fontSize: '20px', fontWeight: 'bold', color: '#1565C0', letterSpacing: '2px' }}>{datos.hojas[hojaActiva].accessCode || '---'}</div></div>
                                    <button onClick={generarCodigoParaHojaActiva} style={{ background: 'white', border: '1px solid #ccc', borderRadius: '50%', width: '40px', height: '40px', cursor: 'pointer' }} title="Generar Nuevo"><RefreshCw size={18} color="#1565C0" /></button>
                                </div>
                            )}

                            {(juegoActual === 'RULETA') && (
                                <div style={{ marginTop: '15px', background: '#fff9c4', padding: '15px', borderRadius: '8px', border: '1px solid #f1c40f' }}>
                                    <label style={{ ...lbl, color: '#d35400', fontWeight: 'bold' }}>🎡 Frase a adivinar</label>
                                    <input value={datos.hojas[hojaActiva].frase || ''} onChange={e => updateFraseHoja(hojaActiva, e.target.value)} style={{ ...inputStyle, marginBottom: 0 }} />
                                </div>
                            )}
                        </div>

                        {/* LISTA PREGUNTAS */}
                        <h4 style={{ color: '#666' }}>{configJuego.id === 'QUESTION_SENDER' ? `Preguntas Recibidas (${datos.hojas[hojaActiva].preguntas.length})` : 'Preguntas'}</h4>

                        {datos.hojas[hojaActiva].preguntas.map((p, i) => (
                            <div key={i} style={{ background: 'white', border: '1px solid #ddd', borderRadius: '8px', padding: '15px', marginBottom: '15px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                                    <span style={{ fontWeight: 'bold', color: '#ccc' }}>#{i + 1} {p.studentEmail && <span style={{ fontSize: '11px', color: '#2196F3' }}>({p.studentEmail})</span>}</span>
                                    <button onClick={() => removePregunta(hojaActiva, i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#e74c3c' }}><Trash2 size={16} /></button>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: esPasapalabra ? '80px 1fr 1fr' : '1fr 1fr', gap: '10px', alignItems: 'start' }}>

                                    {/* CAMPO LETRA (SOLO PASAPALABRA) */}
                                    {esPasapalabra && (
                                        <div>
                                            <label style={lbl}>Letra</label>
                                            <input value={p.letra || ''} onChange={e => updatePregunta(hojaActiva, i, 'letra', e.target.value.toUpperCase())} style={{ ...inputStyle, textAlign: 'center', fontWeight: 'bold' }} maxLength={1} placeholder="A" />
                                        </div>
                                    )}

                                    {/* CAMPO PREGUNTA (COMÚN) */}
                                    <div>
                                        <label style={lbl}>{esAparejados ? 'Elemento A (Pregunta)' : 'Pregunta'}</label>
                                        <input value={p.pregunta} onChange={e => updatePregunta(hojaActiva, i, 'pregunta', e.target.value)} style={inputStyle} placeholder={esAparejados ? "Ej: Perro" : "Enunciado..."} />
                                    </div>

                                    {/* CAMPO RESPUESTA (COMÚN) */}
                                    <div>
                                        <label style={lbl}>{esAparejados ? 'Elemento B (Pareja)' : 'Respuesta Correcta'}</label>
                                        <input value={p.respuesta || p.correcta || ''} onChange={e => updatePregunta(hojaActiva, i, 'respuesta', e.target.value)} style={{ ...inputStyle, background: '#f0fff4' }} placeholder={esAparejados ? "Ej: Dog" : "Respuesta..."} />

                                        {/* INCORRECTAS (SOLO SI APLICA) */}
                                        {usaIncorrectas && (
                                            <div style={{ marginTop: '5px', paddingTop: '5px', borderTop: '1px dashed #eee' }}>
                                                <label style={lbl}>Opciones Incorrectas</label>
                                                {(p.incorrectas || ['', '', '']).map((inc, k) => (
                                                    <input key={k} value={inc} onChange={e => updateIncorrecta(hojaActiva, i, k, e.target.value)} style={{ ...inputStyle, marginBottom: '2px', fontSize: '12px', background: '#fff5f5' }} placeholder={`Opción ${k + 1}`} />
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}

                        {configJuego.id !== 'QUESTION_SENDER' && (
                            <button onClick={() => addPregunta(hojaActiva)} style={{ width: '100%', padding: '15px', border: '2px dashed #ccc', borderRadius: '10px', background: 'none', color: '#666', fontWeight: 'bold', cursor: 'pointer' }}><Plus /> Añadir Pregunta</button>
                        )}
                    </div>

                    {/* SIDEBAR DERECHO */}
                    <div style={{ width: '250px', background: 'white', borderLeft: '1px solid #ddd', padding: '15px', overflowY: 'auto' }}>
                        <h4 style={{ margin: '0 0 15px 0' }}>Configuración</h4>

                        {configJuego.id === 'QUESTION_SENDER' && (
                            <div style={{ marginBottom: '20px', background: '#fff3e0', padding: '10px', borderRadius: '8px' }}>
                                <label style={{ ...lbl, color: '#e65100', fontWeight: 'bold' }}>Aplicación a generar:</label>
                                <select value={datos.targetGame || 'PASAPALABRA'} onChange={e => setDatos({ ...datos, targetGame: e.target.value })} style={inputStyle}>
                                    <option value="PASAPALABRA">Pasapalabra</option>
                                    <option value="CAZABURBUJAS">Caza Burbujas</option>
                                    <option value="APAREJADOS">Aparejados</option>
                                    <option value="THINKHOOT">ThinkHoot</option>
                                    <option value="RULETA">La Ruleta</option>
                                </select>
                            </div>
                        )}

                        <div style={{ marginBottom: '15px' }}><label style={lbl}>País</label><input value={datos.pais} onChange={e => setDatos({ ...datos, pais: e.target.value })} style={inputStyle} /></div>
                        <div style={{ marginBottom: '15px' }}><label style={lbl}>Región</label><input value={datos.region} onChange={e => setDatos({ ...datos, region: e.target.value })} style={inputStyle} /></div>
                        <div style={{ marginBottom: '15px' }}><label style={lbl}>Población</label><input value={datos.poblacion} onChange={e => setDatos({ ...datos, poblacion: e.target.value })} style={inputStyle} /></div>

                        <hr style={{ border: 'none', borderTop: '1px solid #eee', margin: '15px 0' }} />
                        {configJuego.camposConfig.map(campo => (
                            <div key={campo.key} style={{ marginBottom: '10px' }}>
                                <label style={lbl}>{campo.label}</label>
                                <input type={campo.type} value={datos.config?.[campo.key] || campo.default} onChange={e => updateConfig(campo.key, e.target.value)} style={inputStyle} />
                            </div>
                        ))}
                    </div>
                </div>

                {/* FOOTER */}
                <div style={{ padding: '15px', borderTop: '1px solid #eee', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                    <button onClick={onClose} style={{ padding: '10px 20px', border: '1px solid #ccc', background: 'white', borderRadius: '5px', cursor: 'pointer' }}>Cancelar</button>
                    <button onClick={onSave} style={{ padding: '10px 20px', border: 'none', background: configJuego.color, color: 'white', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '5px' }}><Save size={18} /> Guardar Recurso</button>
                </div>
            </div>
        </div>
    );
}

const inputStyle = { width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc', boxSizing: 'border-box', marginBottom: '5px', fontSize: '14px' };
const lbl = { fontSize: '11px', color: '#666', fontWeight: 'bold', display: 'block', marginBottom: '3px' };