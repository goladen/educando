import React, { useState, useEffect } from 'react';
import { Save, X, Trash2, Plus, Settings, ChevronDown, Check, Copy, Eye, EyeOff } from 'lucide-react';

export default function EditorManual({ datos, setDatos, configJuego, onClose, onSave }) {
    // Estado para saber qué hoja estamos editando (0, 1 o 2)
    const [indiceHojaActiva, setIndiceHojaActiva] = useState(0);
    // Estado para mostrar/ocultar la configuración (Rueda dentada)
    const [mostrandoConfig, setMostrandoConfig] = useState(false);

    // Asegurar que existe al menos una hoja al iniciar
    useEffect(() => {
        if (!datos.hojas || datos.hojas.length === 0) {
            setDatos(prev => ({ ...prev, hojas: [{ nombreHoja: 'Hoja 1', preguntas: [] }] }));
        }
    }, []);

    // --- MANEJO DE HOJAS ---
    const cambiarHoja = (e) => setIndiceHojaActiva(parseInt(e.target.value));

    const agregarHoja = () => {
        if (datos.hojas.length >= 3) return alert("Máximo 3 hojas permitidas.");
        const nuevasHojas = [...datos.hojas, { nombreHoja: `Hoja ${datos.hojas.length + 1}`, preguntas: [] }];
        setDatos({ ...datos, hojas: nuevasHojas });
        setIndiceHojaActiva(nuevasHojas.length - 1); // Cambiar a la nueva
    };

    // --- NUEVA FUNCIÓN: BORRAR HOJA ---
    const borrarHoja = () => {
        if (datos.hojas.length <= 1) {
            return alert("No puedes borrar la última hoja. El recurso debe tener al menos una.");
        }

        if (confirm("Si eliminas la hoja no se puede recuperar. ¿Estás seguro?")) {
            const nuevasHojas = [...datos.hojas];
            nuevasHojas.splice(indiceHojaActiva, 1);

            // Ajustamos el índice si borramos la última o la actual
            let nuevoIndice = indiceHojaActiva;
            if (nuevoIndice >= nuevasHojas.length) {
                nuevoIndice = nuevasHojas.length - 1;
            }

            setDatos({ ...datos, hojas: nuevasHojas });
            setIndiceHojaActiva(nuevoIndice);
        }
    };

    const actualizarNombreHoja = (nuevoNombre) => {
        const nuevasHojas = [...datos.hojas];
        nuevasHojas[indiceHojaActiva].nombreHoja = nuevoNombre;
        setDatos({ ...datos, hojas: nuevasHojas });
    };

    // --- MANEJO DE PREGUNTAS ---
    const agregarPregunta = () => {
        const nuevasHojas = [...datos.hojas];
        const nuevaP = { pregunta: '', respuesta: '', correcta: '', incorrectas: [] };

        // Si es Pasapalabra, añadimos letra automática
        if (configJuego.id === 'PASAPALABRA') {
            const abecedario = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
            const letraToca = abecedario[nuevasHojas[indiceHojaActiva].preguntas.length % 26] || '?';
            nuevaP.letra = letraToca;
        }

        nuevasHojas[indiceHojaActiva].preguntas.push(nuevaP);
        setDatos({ ...datos, hojas: nuevasHojas });
    };

    const editarPregunta = (idx, campo, valor) => {
        const nuevasHojas = [...datos.hojas];
        nuevasHojas[indiceHojaActiva].preguntas[idx][campo] = valor;
        setDatos({ ...datos, hojas: nuevasHojas });
    };

    const borrarPregunta = (idx) => {
        const nuevasHojas = [...datos.hojas];
        nuevasHojas[indiceHojaActiva].preguntas.splice(idx, 1);
        setDatos({ ...datos, hojas: nuevasHojas });
    };

    // --- TOGGLES DE CONFIGURACIÓN ---
    const togglePermitirCopia = () => {
        // isPrivate: true significa NO permitir copia. isPrivate: false significa SÍ.
        setDatos(prev => ({ ...prev, isPrivate: !prev.isPrivate }));
    };

    const toggleTerminado = () => {
        // isFinished: true (Disponible para jugar), false (Borrador)
        setDatos(prev => ({ ...prev, isFinished: !prev.isFinished }));
    };

    const hojaActual = datos.hojas[indiceHojaActiva] || { preguntas: [] };

    return (
        <div style={styles.overlay}>
            <div style={styles.container}>

                {/* 1. CABECERA AZUL */}
                <div style={styles.header}>
                    <div style={{ flex: 1 }}>
                        <h2 style={{ margin: 0, fontSize: '18px', color: 'white' }}>{configJuego.label}</h2>
                        <input
                            value={datos.titulo}
                            onChange={(e) => setDatos({ ...datos, titulo: e.target.value })}
                            style={styles.titleInput}
                            placeholder="Título del Recurso"
                        />
                    </div>
                    <div style={{ display: 'flex', gap: '10px' }}>
                        <button onClick={() => setMostrandoConfig(true)} style={styles.iconBtn} title="Configuración">
                            <Settings size={24} />
                        </button>
                        <button onClick={onSave} style={styles.saveBtn}>
                            <Save size={20} /> <span className="hide-mobile">Guardar</span>
                        </button>
                        <button onClick={onClose} style={styles.iconBtn}>
                            <X size={24} />
                        </button>
                    </div>
                </div>

                {/* 2. SUB-CABECERA (Gestión de Hojas y Botones) */}
                <div style={styles.subHeader}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1 }}>
                        <span style={{ fontWeight: 'bold', color: '#555' }}>Hoja:</span>
                        <select
                            value={indiceHojaActiva}
                            onChange={cambiarHoja}
                            style={styles.sheetSelect}
                        >
                            {datos.hojas.map((h, i) => (
                                <option key={i} value={i}>{h.nombreHoja || `Hoja ${i + 1}`}</option>
                            ))}
                        </select>
                    </div>

                    <div style={{ display: 'flex', gap: '5px' }}>
                        {/* BOTÓN ELIMINAR HOJA */}
                        <button onClick={borrarHoja} style={styles.deleteSheetBtn} title="Eliminar Hoja Actual">
                            <Trash2 size={16} />
                        </button>

                        {/* BOTÓN NUEVA HOJA */}
                        {datos.hojas.length < 3 && (
                            <button onClick={agregarHoja} style={styles.addSheetBtn}>
                                <Plus size={16} /> Nueva
                            </button>
                        )}
                    </div>
                </div>

                {/* 3. CUERPO PRINCIPAL */}
                <div style={styles.body}>
                    <div style={{ marginBottom: '15px' }}>
                        <label style={styles.label}>Nombre de esta hoja:</label>
                        <input
                            value={hojaActual.nombreHoja}
                            onChange={(e) => actualizarNombreHoja(e.target.value)}
                            style={styles.input}
                        />
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                        <h3 style={{ margin: 0, color: '#333' }}>Preguntas ({hojaActual.preguntas.length})</h3>
                        <button onClick={agregarPregunta} style={styles.addQuestionBtn}>
                            <Plus size={18} /> Añadir Pregunta
                        </button>
                    </div>

                    <div style={styles.questionsList}>
                        {hojaActual.preguntas.map((p, i) => (
                            <div key={i} style={styles.questionCard}>
                                <div style={styles.questionHeader}>
                                    <span style={styles.qNumber}>#{i + 1}</span>
                                    {configJuego.id === 'PASAPALABRA' && (
                                        <input
                                            value={p.letra}
                                            onChange={(e) => editarPregunta(i, 'letra', e.target.value.toUpperCase())}
                                            style={styles.letraInput}
                                            maxLength={1}
                                        />
                                    )}
                                    <button onClick={() => borrarPregunta(i)} style={styles.deleteBtn}><Trash2 size={16} /></button>
                                </div>

                                <div style={styles.inputsGrid}>
                                    <div style={{ flex: 1 }}>
                                        <label style={styles.miniLabel}>Pregunta</label>
                                        <input
                                            value={p.pregunta}
                                            onChange={(e) => editarPregunta(i, 'pregunta', e.target.value)}
                                            style={styles.input}
                                            placeholder="Enunciado..."
                                        />
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <label style={styles.miniLabel}>Respuesta Correcta</label>
                                        <input
                                            value={p.respuesta || p.correcta}
                                            onChange={(e) => editarPregunta(i, configJuego.id === 'CAZABURBUJAS' ? 'correcta' : 'respuesta', e.target.value)}
                                            style={{ ...styles.input, borderColor: '#4CAF50' }}
                                            placeholder="Solución"
                                        />
                                    </div>
                                </div>
                            </div>
                        ))}
                        {hojaActual.preguntas.length === 0 && (
                            <div style={{ textAlign: 'center', padding: '40px', color: '#999', border: '2px dashed #ccc', borderRadius: '10px' }}>
                                No hay preguntas en esta hoja. Pulsa "Añadir Pregunta".
                            </div>
                        )}
                    </div>
                </div>

                {/* 4. MODAL DE CONFIGURACIÓN */}
                {mostrandoConfig && (
                    <div style={styles.configOverlay}>
                        <div style={styles.configModal}>
                            <div style={styles.configHeader}>
                                <h3>Configuración del Recurso</h3>
                                <button onClick={() => setMostrandoConfig(false)} style={styles.iconBtnBlack}><X /></button>
                            </div>

                            <div style={styles.configBody}>
                                <h4 style={styles.sectionTitle}>Ubicación</h4>
                                <InputConfig label="País" val={datos.pais} set={v => setDatos({ ...datos, pais: v })} />
                                <InputConfig label="Región" val={datos.region} set={v => setDatos({ ...datos, region: v })} />
                                <InputConfig label="Población" val={datos.poblacion} set={v => setDatos({ ...datos, poblacion: v })} />

                                <h4 style={styles.sectionTitle}>Ajustes de {configJuego.label}</h4>
                                {configJuego.camposConfig.map(campo => (
                                    <div key={campo.key} style={{ marginBottom: '10px' }}>
                                        <label style={styles.label}>{campo.label}</label>
                                        <input
                                            type={campo.type}
                                            value={datos.config?.[campo.key] || campo.default}
                                            onChange={(e) => setDatos({
                                                ...datos,
                                                config: { ...datos.config, [campo.key]: e.target.value }
                                            })}
                                            style={styles.input}
                                        />
                                    </div>
                                ))}

                                <h4 style={styles.sectionTitle}>Visibilidad y Permisos</h4>

                                {/* 1. PERMITIR COPIA */}
                                <div style={styles.toggleRow}>
                                    <div>
                                        <div style={{ fontWeight: 'bold' }}>Permitir Copia</div>
                                        <div style={{ fontSize: '12px', color: '#666' }}>Otros profesores podrán duplicar esto.</div>
                                    </div>
                                    <button
                                        onClick={togglePermitirCopia}
                                        style={{
                                            ...styles.toggleBtn,
                                            background: !datos.isPrivate ? '#4CAF50' : '#ccc',
                                            justifyContent: !datos.isPrivate ? 'flex-end' : 'flex-start'
                                        }}
                                    >
                                        <div style={styles.toggleCircle}></div>
                                    </button>
                                </div>

                                {/* 2. TERMINADO */}
                                <div style={styles.toggleRow}>
                                    <div>
                                        <div style={{ fontWeight: 'bold' }}>Terminado</div>
                                        <div style={{ fontSize: '12px', color: '#666' }}>Disponible para jugar alumnos.</div>
                                    </div>
                                    <button
                                        onClick={toggleTerminado}
                                        style={{
                                            ...styles.toggleBtn,
                                            background: datos.isFinished ? '#2196F3' : '#ccc',
                                            justifyContent: datos.isFinished ? 'flex-end' : 'flex-start'
                                        }}
                                    >
                                        <div style={styles.toggleCircle}></div>
                                    </button>
                                </div>

                            </div>
                            <button onClick={() => setMostrandoConfig(false)} style={styles.closeConfigBtn}>Aceptar y Cerrar</button>
                        </div>
                    </div>
                )}
            </div>

            <style>{`
                .hide-mobile { display: inline; }
                @media (max-width: 600px) {
                    .hide-mobile { display: none; }
                }
            `}</style>
        </div>
    );
}

// --- COMPONENTES AUXILIARES ---
const InputConfig = ({ label, val, set }) => (
    <div style={{ marginBottom: '10px' }}>
        <label style={{ display: 'block', fontSize: '12px', color: '#666', fontWeight: 'bold' }}>{label}</label>
        <input value={val || ''} onChange={(e) => set(e.target.value)} style={styles.input} />
    </div>
);

// --- ESTILOS CSS-IN-JS ---
const styles = {
    overlay: { position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: '#f0f2f5', zIndex: 3000, display: 'flex', flexDirection: 'column' },
    container: { display: 'flex', flexDirection: 'column', height: '100%', width: '100%', maxWidth: '1000px', margin: '0 auto', background: 'white', boxShadow: '0 0 20px rgba(0,0,0,0.1)' },

    // Header
    header: { background: '#3F51B5', padding: '10px 15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'white' },
    titleInput: { background: 'rgba(255,255,255,0.2)', border: 'none', color: 'white', fontSize: '16px', padding: '5px 10px', borderRadius: '4px', width: '90%', marginTop: '5px', outline: 'none' },
    iconBtn: { background: 'none', border: 'none', color: 'white', cursor: 'pointer', padding: '5px' },
    saveBtn: { background: '#4CAF50', border: 'none', color: 'white', padding: '8px 15px', borderRadius: '20px', display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer', fontWeight: 'bold' },

    // Sub-header (Hojas)
    subHeader: { background: '#e8eaf6', padding: '10px 15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #ccc' },
    sheetSelect: { padding: '8px', borderRadius: '5px', border: '1px solid #ccc', fontSize: '14px', flex: 1, maxWidth: '200px' },
    addSheetBtn: { background: 'white', border: '1px solid #3F51B5', color: '#3F51B5', padding: '5px 10px', borderRadius: '5px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', fontWeight: 'bold' },
    deleteSheetBtn: { background: '#FFEBEE', border: '1px solid #FFCDD2', color: '#C62828', padding: '5px 10px', borderRadius: '5px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }, // ESTILO NUEVO PARA BORRAR

    // Cuerpo
    body: { flex: 1, padding: '15px', overflowY: 'auto', background: '#f9f9f9' },
    label: { display: 'block', marginBottom: '5px', fontWeight: 'bold', fontSize: '13px', color: '#333' },
    input: { width: '100%', padding: '10px', borderRadius: '5px', border: '1px solid #ddd', boxSizing: 'border-box', fontSize: '14px' },
    addQuestionBtn: { background: '#2196F3', color: 'white', border: 'none', padding: '8px 15px', borderRadius: '20px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px', fontSize: '13px' },

    // Lista preguntas
    questionsList: { display: 'flex', flexDirection: 'column', gap: '15px' },
    questionCard: { background: 'white', padding: '15px', borderRadius: '8px', border: '1px solid #eee', boxShadow: '0 2px 5px rgba(0,0,0,0.05)' },
    questionHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' },
    qNumber: { fontWeight: 'bold', color: '#999', fontSize: '12px' },
    letraInput: { width: '40px', textAlign: 'center', fontSize: '16px', fontWeight: 'bold', border: '2px solid #3F51B5', borderRadius: '5px', color: '#3F51B5' },
    deleteBtn: { background: '#ffebee', color: '#c62828', border: 'none', padding: '5px', borderRadius: '4px', cursor: 'pointer' },
    inputsGrid: { display: 'flex', flexDirection: 'column', gap: '10px' },
    miniLabel: { fontSize: '11px', color: '#777', marginBottom: '2px', display: 'block', textTransform: 'uppercase' },

    // Modal Config
    configOverlay: { position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 4000 },
    configModal: { background: 'white', width: '90%', maxWidth: '400px', borderRadius: '15px', maxHeight: '85vh', display: 'flex', flexDirection: 'column', boxShadow: '0 10px 25px rgba(0,0,0,0.2)' },
    configHeader: { padding: '15px', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
    iconBtnBlack: { background: 'none', border: 'none', cursor: 'pointer', padding: '5px' },
    configBody: { padding: '20px', overflowY: 'auto', flex: 1 },
    sectionTitle: { margin: '20px 0 10px 0', color: '#3F51B5', borderBottom: '2px solid #eee', paddingBottom: '5px' },
    closeConfigBtn: { width: '100%', padding: '15px', background: '#333', color: 'white', border: 'none', borderBottomLeftRadius: '15px', borderBottomRightRadius: '15px', fontSize: '16px', cursor: 'pointer' },

    // Toggles
    toggleRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', padding: '10px', background: '#f5f5f5', borderRadius: '8px' },
    toggleBtn: { width: '50px', height: '26px', borderRadius: '13px', border: 'none', padding: '2px', cursor: 'pointer', display: 'flex', alignItems: 'center', transition: 'background 0.3s' },
    toggleCircle: { width: '22px', height: '22px', background: 'white', borderRadius: '50%', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }
};