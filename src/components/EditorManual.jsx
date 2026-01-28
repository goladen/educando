import { useState } from 'react';
import { Save, X, Trash2, FolderPlus, ArrowUp, ArrowDown } from 'lucide-react';

export default function EditorManual({ datos, setDatos, configJuego, onClose, onSave }) {
    const [hojaActiva, setHojaActiva] = useState(0);

    // --- LOGICA DE ACTUALIZACIÓN ---
    const updateConfig = (k, v) => setDatos({ ...datos, config: { ...datos.config, [k]: v } });

    // Gestión Hojas
    const addHoja = () => setDatos({ ...datos, hojas: [...datos.hojas, { nombreHoja: `Hoja ${datos.hojas.length + 1}`, preguntas: [] }] });

    const deleteHoja = (idx) => {
        if (datos.hojas.length <= 1) return alert("Debe haber al menos una hoja.");
        if (confirm("¿Borrar hoja y sus preguntas?")) {
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
        let p = {};
        if (configJuego.id === 'PASAPALABRA') p = { letra: '', pregunta: '', respuesta: '' };
        else if (configJuego.id === 'APAREJADOS') p = { terminoA: '', terminoB: '' };
        else p = { pregunta: '', correcta: '', incorrectas: ['', '', ''] }; // ThinkHoot y CazaBurbujas
        nuevas[hojaActiva].preguntas.push(p);
        setDatos({ ...datos, hojas: nuevas });
    };

    const updatePregunta = (idx, field, val) => {
        const nuevas = [...datos.hojas];
        nuevas[hojaActiva].preguntas[idx][field] = val;
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

    // --- RENDERIZADO DE CAMPOS ESPECÍFICOS ---
    const renderCampos = (p, i) => {
        if (configJuego.id === 'PASAPALABRA') {
            return (
                <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
                    <input style={{ width: '40px', textAlign: 'center' }} placeholder="A" value={p.letra} onChange={e => updatePregunta(i, 'letra', e.target.value.toUpperCase())} className="inp" />
                    <input style={{ flex: 2 }} placeholder="Pregunta" value={p.pregunta} onChange={e => updatePregunta(i, 'pregunta', e.target.value)} className="inp" />
                    <input style={{ flex: 1 }} placeholder="Respuesta" value={p.respuesta} onChange={e => updatePregunta(i, 'respuesta', e.target.value)} className="inp" />
                </div>
            );
        } else if (configJuego.id === 'APAREJADOS') {
            return (
                <div style={{ display: 'flex', gap: '10px' }}>
                    <input style={{ flex: 1 }} placeholder="Término A" value={p.terminoA} onChange={e => updatePregunta(i, 'terminoA', e.target.value)} className="inp" />
                    <span style={{ paddingTop: '5px' }}>↔️</span>
                    <input style={{ flex: 1 }} placeholder="Término B" value={p.terminoB} onChange={e => updatePregunta(i, 'terminoB', e.target.value)} className="inp" />
                </div>
            );
        } else {
            // THINKHOOT y CAZABURBUJAS
            return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', width: '100%' }}>
                    <input placeholder="Pregunta..." value={p.pregunta} onChange={e => updatePregunta(i, 'pregunta', e.target.value)} className="inp" style={{ fontWeight: 'bold' }} />
                    <div style={{ display: 'flex', gap: '5px' }}>
                        <input style={{ flex: 1, borderColor: '#2ecc71' }} placeholder="✅ Correcta" value={p.correcta} onChange={e => updatePregunta(i, 'correcta', e.target.value)} className="inp" />
                        <input style={{ flex: 2, borderColor: '#e74c3c' }} placeholder="❌ Incorrectas (sep. por comas)" value={Array.isArray(p.incorrectas) ? p.incorrectas.join(',') : p.incorrectas} onChange={e => updatePregunta(i, 'incorrectas', e.target.value.split(','))} className="inp" />
                    </div>
                </div>
            );
        }
    };

    // Estilos locales
    const inputStyle = { width: '100%', padding: '10px', borderRadius: '5px', border: '1px solid #ccc', boxSizing: 'border-box' };
    const inputStyleSmall = { ...inputStyle, fontSize: '13px', padding: '8px', marginBottom: 0 };
    const arrowBtn = { background: '#eee', border: 'none', cursor: 'pointer', fontSize: '10px', padding: '4px', borderRadius: '3px', display: 'flex', alignItems: 'center', justifyContent: 'center' };

    return (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.8)', zIndex: 2000, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            <style>{`.inp { padding: 8px; border: 1px solid #ddd; borderRadius: 4px; outline: none; width: 100%; box-sizing: border-box; } .inp:focus { border-color: #2196F3; }`}</style>

            <div style={{ background: 'white', width: '95%', height: '95%', borderRadius: '15px', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 0 20px rgba(0,0,0,0.5)' }}>

                {/* HEADER */}
                <div style={{ padding: '15px', background: '#f5f5f5', borderBottom: '1px solid #ddd', display: 'flex', gap: '20px', alignItems: 'center' }}>
                    <h2 style={{ margin: 0, color: configJuego.color }}>{configJuego.label}</h2>
                    <input placeholder="Título del Recurso" value={datos.titulo} onChange={e => setDatos({ ...datos, titulo: e.target.value })} style={{ ...inputStyle, width: '300px', marginBottom: 0 }} />
                    <div style={{ flex: 1 }}></div>
                    <button onClick={onSave} style={{ background: '#2ecc71', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '5px' }}><Save size={18} /> GUARDAR</button>
                    <button onClick={onClose} style={{ background: '#e74c3c', color: 'white', border: 'none', padding: '10px', borderRadius: '5px', cursor: 'pointer' }}><X size={18} /></button>
                </div>

                {/* CONFIGURACIÓN */}
                <div style={{ padding: '15px', background: '#fff', borderBottom: '1px solid #eee', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '10px' }}>
                    {configJuego.camposConfig.map(c => (
                        <div key={c.key}>
                            <label style={{ fontSize: '11px', color: '#666', display: 'block' }}>{c.label}</label>
                            <input type={c.type} value={datos.config[c.key]} onChange={e => updateConfig(c.key, e.target.value)} style={inputStyleSmall} />
                        </div>
                    ))}
                    <div><label style={{ fontSize: '11px', color: '#666' }}>País</label><input value={datos.pais} onChange={e => setDatos({ ...datos, pais: e.target.value })} style={inputStyleSmall} /></div>
                    <div><label style={{ fontSize: '11px', color: '#666' }}>Población</label><input value={datos.poblacion} onChange={e => setDatos({ ...datos, poblacion: e.target.value })} style={inputStyleSmall} /></div>
                </div>

                {/* TABS HOJAS */}
                <div style={{ background: '#e0e0e0', padding: '10px 10px 0 10px', display: 'flex', gap: '5px', overflowX: 'auto' }}>
                    {datos.hojas.map((h, i) => (
                        <div key={i} onClick={() => setHojaActiva(i)} style={{
                            padding: '8px 15px',
                            background: i === hojaActiva ? 'white' : '#ccc',
                            borderRadius: '8px 8px 0 0',
                            cursor: 'pointer',
                            fontWeight: 'bold',
                            display: 'flex', alignItems: 'center', gap: '5px',
                            minWidth: '100px'
                        }}>
                            <input value={h.nombreHoja} onChange={(e) => renameHoja(i, e.target.value)} style={{ border: 'none', background: 'transparent', fontWeight: 'bold', width: '80px', outline: 'none' }} onClick={e => e.stopPropagation()} />
                            {datos.hojas.length > 1 && <Trash2 size={14} color="#666" onClick={(e) => { e.stopPropagation(); deleteHoja(i) }} />}
                        </div>
                    ))}
                    <button onClick={addHoja} style={{ padding: '8px', background: 'transparent', border: 'none', cursor: 'pointer' }}><FolderPlus size={20} /></button>
                </div>

                {/* AREA PREGUNTAS */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '20px', background: '#f9f9f9' }}>
                    {datos.hojas[hojaActiva]?.preguntas.length === 0 ? (
                        <div style={{ textAlign: 'center', color: '#888', marginTop: '50px' }}>
                            <p>Hoja vacía.</p>
                            <button onClick={addPregunta} style={{ padding: '10px 20px', background: '#2196F3', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer' }}>+ Añadir Pregunta</button>
                        </div>
                    ) : (
                            datos.hojas[hojaActiva]?.preguntas.map((p, i) => (
                                <div key={i} style={{ background: 'white', padding: '15px', borderRadius: '8px', boxShadow: '0 2px 5px rgba(0,0,0,0.05)', marginBottom: '10px', display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                        <button onClick={() => moverPregunta(i, -1)} disabled={i === 0} style={arrowBtn}><ArrowUp size={12} /></button>
                                        <span style={{ fontSize: '12px', fontWeight: 'bold', textAlign: 'center', color: '#888' }}>{i + 1}</span>
                                        <button onClick={() => moverPregunta(i, 1)} disabled={i === datos.hojas[hojaActiva].preguntas.length - 1} style={arrowBtn}><ArrowDown size={12} /></button>
                                    </div>
                                    <div style={{ flex: 1 }}>{renderCampos(p, i)}</div>
                                    <button onClick={() => deletePregunta(i)} style={{ background: '#ffebee', color: '#c62828', border: 'none', padding: '10px', borderRadius: '5px', cursor: 'pointer' }}><Trash2 size={18} /></button>
                                </div>
                            ))
                        )}
                    {datos.hojas[hojaActiva]?.preguntas.length > 0 &&
                        <button onClick={addPregunta} style={{ width: '100%', padding: '15px', border: '2px dashed #ccc', background: 'transparent', borderRadius: '10px', color: '#666', fontWeight: 'bold', cursor: 'pointer', marginTop: '10px' }}>
                            + AÑADIR OTRA PREGUNTA
                        </button>
                    }
                </div>
            </div>
        </div>
    );
}