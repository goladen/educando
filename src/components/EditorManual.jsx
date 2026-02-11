import React, { useState, useEffect } from 'react';
import { Save, X, Trash2, Plus, Settings, RotateCcw, HelpCircle } from 'lucide-react'; // <--- AÑADIDO HelpCircle

const JUEGOS_DESTINO = [
    { id: 'PASAPALABRA', label: 'Pasapalabra' },
    { id: 'CAZABURBUJAS', label: 'CazaBurbujas' },
    { id: 'THINKHOOT', label: 'ThinkHoot' },
    { id: 'RULETA', label: 'La Ruleta' },
    { id: 'APAREJADOS', label: 'Aparejados' }
];

// --- TEXTOS DE AYUDA POR JUEGO ---
const HELP_CONTENT = {
    PASAPALABRA: "En Pasapalabra, cada pregunta corresponde a una letra del rosco. Rellena la 'Pregunta/Definición' y la 'Respuesta Correcta'. El sistema asigna las letras automáticamente (A, B, C...).",
    CAZABURBUJAS: "Crea preguntas con una respuesta correcta y varias incorrectas. En el juego, los alumnos deben 'explotar' la burbuja con la respuesta correcta antes de que se acabe el tiempo.",
    THINKHOOT: "Juego tipo Quiz. Añade una pregunta, la respuesta correcta y hasta 3 incorrectas. Los alumnos compiten por puntos y velocidad.",
    RULETA: "Define una 'Frase Oculta' en la configuración de la hoja. Luego, añade preguntas cuyas respuestas den pistas o letras para resolver esa frase.",
    APAREJADOS: "Crea parejas de conceptos (A y B). En el juego, los elementos de la columna A y B aparecerán desordenados y el alumno debe unirlos.",
    QUESTION_SENDER: "Esta herramienta no es un juego en sí, sino un 'Buzón'. Comparte el Código de Acceso con tus alumnos para que ellos te envíen preguntas desde sus dispositivos."
};

export default function EditorManual({ datos, setDatos, configJuego, onClose, onSave, usuario }) {
    const [indiceHojaActiva, setIndiceHojaActiva] = useState(0);
    const [mostrandoConfig, setMostrandoConfig] = useState(false);
    const [mostrandoAyuda, setMostrandoAyuda] = useState(false); // <--- ESTADO NUEVO

    useEffect(() => {
        // Inicializar hojas si no existen
        if (!datos.hojas || datos.hojas.length === 0) {
            setDatos(prev => ({ ...prev, hojas: [{ nombreHoja: 'Hoja 1', preguntas: [] }] }));
        }

        if (configJuego.id === 'CAZABURBUJAS' && !datos.config?.velocidad) {
            setDatos(prev => ({ ...prev, config: { ...prev.config, velocidad: 'MODERADO' } }));
        }

        // Lógica de Autorrelleno de Datos de Búsqueda
        setDatos(prev => ({
            ...prev,
            pais: prev.pais !== undefined ? prev.pais : (usuario?.pais || ''),
            region: prev.region !== undefined ? prev.region : (usuario?.region || ''),
            poblacion: prev.poblacion !== undefined ? prev.poblacion : (usuario?.poblacion || usuario?.localidad || ''),
            ciclo: prev.ciclo !== undefined ? prev.ciclo : (usuario?.ciclo || 'Secundaria'),
            temas: prev.temas || usuario?.temasPreferidos || '',


        }));
    }, []);

    // --- MANEJO DE HOJAS ---
    const cambiarHoja = (e) => setIndiceHojaActiva(parseInt(e.target.value));

    const agregarHoja = () => {
        if (datos.hojas.length >= 3) return alert("Máximo 3 hojas permitidas.");
        const nuevasHojas = [...datos.hojas, { nombreHoja: `Hoja ${datos.hojas.length + 1}`, preguntas: [] }];
        setDatos({ ...datos, hojas: nuevasHojas });
        setIndiceHojaActiva(nuevasHojas.length - 1);
    };

    const borrarHoja = () => {
        if (datos.hojas.length <= 1) return alert("No puedes borrar la última hoja.");
        if (confirm("Si eliminas la hoja no se puede recuperar. ¿Estás seguro?")) {
            const nuevasHojas = [...datos.hojas];
            nuevasHojas.splice(indiceHojaActiva, 1);
            let nuevoIndice = indiceHojaActiva >= nuevasHojas.length ? nuevasHojas.length - 1 : indiceHojaActiva;
            setDatos({ ...datos, hojas: nuevasHojas });
            setIndiceHojaActiva(nuevoIndice);
        }
    };

    const actualizarNombreHoja = (val) => {
        const nuevasHojas = [...datos.hojas];
        nuevasHojas[indiceHojaActiva].nombreHoja = val;
        setDatos({ ...datos, hojas: nuevasHojas });
    };

    const actualizarFraseRuleta = (val) => {
        const nuevasHojas = [...datos.hojas];
        nuevasHojas[indiceHojaActiva].fraseOculta = val;
        setDatos({ ...datos, hojas: nuevasHojas });
    };

    // --- QUESTION SENDER: GESTIÓN DE CÓDIGOS Y TARGET ---
    const generarCodigoHoja = () => {
        const codigo = Math.random().toString(36).substring(2, 7).toUpperCase();
        const nuevasHojas = [...datos.hojas];
        nuevasHojas[indiceHojaActiva].accessCode = codigo;
        setDatos({ ...datos, hojas: nuevasHojas });
    };

    const cambiarTargetGame = (nuevoTarget) => {
        setDatos({ ...datos, targetGame: nuevoTarget });
    };

    // --- MANEJO DE PREGUNTAS (Para juegos normales) ---
    const agregarPregunta = () => {
        const nuevasHojas = [...datos.hojas];
        const nuevaP = { pregunta: '', respuesta: '', correcta: '', incorrectas: ['', '', ''] };

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

    const editarIncorrecta = (idxPregunta, idxIncorrecta, valor) => {
        const nuevasHojas = [...datos.hojas];
        const pregunta = nuevasHojas[indiceHojaActiva].preguntas[idxPregunta];
        if (!pregunta.incorrectas) pregunta.incorrectas = ['', '', ''];
        pregunta.incorrectas[idxIncorrecta] = valor;
        setDatos({ ...datos, hojas: nuevasHojas });
    };

    const borrarPregunta = (idx) => {
        const nuevasHojas = [...datos.hojas];
        nuevasHojas[indiceHojaActiva].preguntas.splice(idx, 1);
        setDatos({ ...datos, hojas: nuevasHojas });
    };

    // --- TOGGLES ---
    const togglePermitirCopia = () => setDatos(prev => ({ ...prev, isPrivate: !prev.isPrivate }));
    const toggleTerminado = () => setDatos(prev => ({ ...prev, isFinished: !prev.isFinished }));
    // NUEVO TOGGLE: ORDEN ALEATORIO
    const toggleAleatorio = () => setDatos(prev => ({ ...prev, config: { ...prev.config, aleatorio: !prev.config?.aleatorio } }));

    const hojaActual = datos.hojas[indiceHojaActiva] || { preguntas: [] };
    const esQuestionSender = configJuego.id === 'QUESTION_SENDER';

    // --- RENDERIZADO DE CAMPOS SEGÚN JUEGO ---
    const renderCamposPregunta = (p, i) => {
        const tipo = configJuego.id;

        if (tipo === 'PASAPALABRA') {
            return (
                <div style={styles.inputsGrid}>
                    <div style={{ flex: 1 }}>
                        <label style={styles.miniLabel}>Pregunta / Definición</label>
                        <input value={p.pregunta} onChange={(e) => editarPregunta(i, 'pregunta', e.target.value)} style={styles.input} placeholder="Empieza por..." />
                    </div>
                    <div style={{ flex: 1 }}>
                        <label style={styles.miniLabel}>Respuesta Correcta</label>
                        <input value={p.respuesta || p.correcta} onChange={(e) => editarPregunta(i, 'respuesta', e.target.value)} style={{ ...styles.input, borderColor: '#4CAF50' }} placeholder="Solución" />
                    </div>
                </div>
            );
        }

        if (tipo === 'APAREJADOS') {
            return (
                <div style={styles.inputsGrid}>
                    <div style={{ flex: 1 }}>
                        <label style={styles.miniLabel}>Concepto A (Texto o URL Imagen)</label>
                        <input value={p.pregunta} onChange={(e) => editarPregunta(i, 'pregunta', e.target.value)} style={styles.input} placeholder="Ej: Perro" />
                    </div>
                    <div style={{ flex: 1 }}>
                        <label style={styles.miniLabel}>Concepto B (Pareja)</label>
                        <input value={p.respuesta || p.correcta} onChange={(e) => editarPregunta(i, 'respuesta', e.target.value)} style={{ ...styles.input, borderColor: '#FF9800' }} placeholder="Ej: Dog" />
                    </div>
                </div>
            );
        }

        return (
            <div style={styles.inputsGrid}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div>
                        <label style={styles.miniLabel}>Pregunta</label>
                        <input value={p.pregunta} onChange={(e) => editarPregunta(i, 'pregunta', e.target.value)} style={styles.input} placeholder="Enunciado..." />
                    </div>
                    <div>
                        <label style={styles.miniLabel}>Respuesta Correcta</label>
                        <input value={p.respuesta || p.correcta} onChange={(e) => editarPregunta(i, tipo === 'CAZABURBUJAS' ? 'correcta' : 'respuesta', e.target.value)} style={{ ...styles.input, borderColor: '#4CAF50', background: '#e8f5e9' }} placeholder="Solución" />
                    </div>
                </div>
                <div>
                    <label style={styles.miniLabel}>Respuestas Incorrectas (Opcional)</label>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                        {[0, 1, 2].map(idxInc => (
                            <input
                                key={idxInc}
                                value={p.incorrectas ? p.incorrectas[idxInc] : ''}
                                onChange={(e) => editarIncorrecta(i, idxInc, e.target.value)}
                                style={{ ...styles.input, borderColor: '#e57373', fontSize: '13px', padding: '8px' }}
                                placeholder={`Incorrecta ${idxInc + 1}`}
                            />
                        ))}
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div style={styles.overlay}>
            <div style={styles.container}>

                {/* HEADER */}
                <div style={styles.header}>
                    <div style={{ flex: 1 }}>
                        <h2 style={{ margin: 0, fontSize: '18px', color: 'white' }}>{configJuego.label}</h2>
                        <input value={datos.titulo} onChange={(e) => setDatos({ ...datos, titulo: e.target.value })} style={styles.titleInput} placeholder="Título del Recurso" />
                    </div>
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                        {/* --- NUEVO BOTÓN DE AYUDA --- */}
                        <button onClick={() => setMostrandoAyuda(true)} style={styles.iconBtn} title="Ayuda"><HelpCircle size={24} /></button>

                        <button onClick={() => setMostrandoConfig(true)} style={styles.iconBtn} title="Configuración"><Settings size={24} /></button>
                        <button onClick={onSave} style={styles.saveBtn}><Save size={20} /> <span className="hide-mobile">Guardar</span></button>
                        <button onClick={onClose} style={styles.iconBtn}><X size={24} /></button>
                    </div>
                </div>

                {/* SUB-HEADER HOJAS */}
                <div style={styles.subHeader}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1 }}>
                        <span style={{ fontWeight: 'bold', color: '#555' }}>Hoja:</span>
                        <select value={indiceHojaActiva} onChange={cambiarHoja} style={styles.sheetSelect}>
                            {datos.hojas.map((h, i) => <option key={i} value={i}>{h.nombreHoja || `Hoja ${i + 1}`}</option>)}
                        </select>
                    </div>
                    <div style={{ display: 'flex', gap: '5px' }}>
                        <button onClick={borrarHoja} style={styles.deleteSheetBtn} title="Eliminar Hoja"><Trash2 size={16} /></button>
                        {datos.hojas.length < 3 && <button onClick={agregarHoja} style={styles.addSheetBtn}><Plus size={16} /> Nueva</button>}
                    </div>
                </div>

                {/* BODY PRINCIPAL */}
                <div style={styles.body}>

                    {/* NOMBRE HOJA */}
                    <div style={{ marginBottom: '15px', background: 'white', padding: '10px', borderRadius: '8px', border: '1px solid #ddd' }}>
                        <div style={{ marginBottom: '10px' }}>
                            <label style={styles.label}>Nombre de la Hoja:</label>
                            <input value={hojaActual.nombreHoja} onChange={(e) => actualizarNombreHoja(e.target.value)} style={styles.input} />
                        </div>

                        {configJuego.id === 'RULETA' && (
                            <div>
                                <label style={{ ...styles.label, color: '#E91E63' }}>🎯 Frase a Resolver (OBLIGATORIA):</label>
                                <input
                                    value={hojaActual.fraseOculta || ''}
                                    onChange={(e) => actualizarFraseRuleta(e.target.value)}
                                    style={{ ...styles.input, border: '2px solid #E91E63', fontWeight: 'bold' }}
                                    placeholder="Ej: LA CAPITAL DE FRANCIA"
                                />
                            </div>
                        )}
                    </div>

                    {/* === LOGICA DIFERENCIADA PARA QUESTION SENDER === */}
                    {esQuestionSender ? (
                        <div style={{ padding: '10px', background: '#e3f2fd', borderRadius: '10px', border: '1px solid #2196F3' }}>
                            <h3 style={{ color: '#1565C0', marginTop: 0 }}>Configuración de Envío</h3>

                            <div style={{ marginBottom: '20px' }}>
                                <label style={styles.label}>Aplicación Destino (Formato para Alumnos):</label>
                                <select
                                    value={datos.targetGame || 'PASAPALABRA'}
                                    onChange={(e) => cambiarTargetGame(e.target.value)}
                                    style={{ ...styles.input, fontWeight: 'bold', color: '#333' }}
                                >
                                    {JUEGOS_DESTINO.map(g => <option key={g.id} value={g.id}>{g.label}</option>)}
                                </select>
                                <p style={{ fontSize: '12px', color: '#666', marginTop: '5px' }}>
                                    Los alumnos verán el formulario adaptado para: <b>{JUEGOS_DESTINO.find(g => g.id === (datos.targetGame || 'PASAPALABRA'))?.label}</b>.
                                    <br />(Ej: Si es Pasapalabra, se pedirá Letra, Pregunta y Respuesta).
                                </p>
                            </div>

                            <div style={{ background: 'white', padding: '15px', borderRadius: '10px', textAlign: 'center', border: '2px dashed #2196F3' }}>
                                <label style={{ display: 'block', marginBottom: '10px', fontWeight: 'bold', color: '#555' }}>CÓDIGO DE ACCESO PARA ESTA HOJA</label>
                                <div style={{ fontSize: '32px', letterSpacing: '5px', fontWeight: 'bold', color: '#2196F3', marginBottom: '15px' }}>
                                    {hojaActual.accessCode || '-----'}
                                </div>
                                <button onClick={generarCodigoHoja} style={{ background: '#2196F3', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '20px', cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px', margin: '0 auto' }}>
                                    <RotateCcw size={18} /> Generar Nuevo Código
                                </button>
                                <p style={{ fontSize: '13px', color: '#888', marginTop: '15px' }}>
                                    Comparte este código con tus alumnos para que envíen sus preguntas a esta hoja.
                                </p>
                            </div>
                        </div>
                    ) : (
                            // === LÓGICA NORMAL PARA OTROS JUEGOS ===
                            <>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                                    <h3 style={{ margin: 0, color: '#333' }}>Preguntas ({hojaActual.preguntas.length})</h3>
                                    <button onClick={agregarPregunta} style={styles.addQuestionBtn}><Plus size={18} /> Añadir Pregunta</button>
                                </div>

                                <div style={styles.questionsList}>
                                    {hojaActual.preguntas.map((p, i) => (
                                        <div key={i} style={styles.questionCard}>
                                            <div style={styles.questionHeader}>
                                                <span style={styles.qNumber}>#{i + 1}</span>
                                                {configJuego.id === 'PASAPALABRA' && (
                                                    <input value={p.letra} onChange={(e) => editarPregunta(i, 'letra', e.target.value.toUpperCase())} style={styles.letraInput} maxLength={1} />
                                                )}
                                                <button onClick={() => borrarPregunta(i)} style={styles.deleteBtn}><Trash2 size={16} /></button>
                                            </div>
                                            {renderCamposPregunta(p, i)}
                                        </div>
                                    ))}
                                    {hojaActual.preguntas.length === 0 && (
                                        <div style={{ textAlign: 'center', padding: '40px', color: '#999', border: '2px dashed #ccc', borderRadius: '10px' }}>
                                            No hay preguntas. Pulsa "Añadir Pregunta".
                                    </div>
                                    )}
                                </div>
                            </>
                        )}
                </div>

                {/* MODAL CONFIGURACIÓN */}
                {mostrandoConfig && (
                    <div style={styles.configOverlay}>
                        <div style={styles.configModal}>
                            <div style={styles.configHeader}>
                                <h3>Configuración</h3>
                                <button onClick={() => setMostrandoConfig(false)} style={styles.iconBtnBlack}><X /></button>
                            </div>
                            <div style={styles.configBody}>
                                {/* --- SECCIÓN DATOS DE BÚSQUEDA ESTANDARIZADA --- */}
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
                                <h4 style={styles.sectionTitle}>Ajustes de Juego</h4>
                                {configJuego.camposConfig.map(campo => (
                                    <div key={campo.key} style={{ marginBottom: '10px' }}>
                                        <label style={styles.label}>{campo.label}</label>
                                        <input type={campo.type} value={datos.config?.[campo.key] || campo.default} onChange={(e) => setDatos({ ...datos, config: { ...datos.config, [campo.key]: e.target.value } })} style={styles.input} />
                                    </div>
                                ))}

                                {/* --- AÑADIR ESTO AQUÍ: SELECTOR DE VELOCIDAD (SOLO CAZABURBUJAS) --- */}
                                {configJuego.id === 'CAZABURBUJAS' && (
                                    <div style={{ marginBottom: '15px', background: '#e3f2fd', padding: '10px', borderRadius: '8px', border: '1px solid #bbdefb' }}>
                                        <label style={styles.label}>Velocidad de Movimiento</label>
                                        <select
                                            value={datos.config?.velocidad || 'MODERADO'}
                                            onChange={(e) => setDatos({ ...datos, config: { ...datos.config, velocidad: e.target.value } })}
                                            style={{ ...styles.input, fontWeight: 'bold', color: '#1565C0' }}
                                        >
                                            <option value="LENTO">🐢 Lento</option>
                                            <option value="MODERADO">🚶 Moderado</option>
                                            <option value="RAPIDO">🐇 Rápido</option>
                                        </select>
                                    </div>
                                )}

                                {/* --- NUEVA OPCIÓN: ORDEN ALEATORIO --- */}
                                <div style={styles.toggleRow}>
                                    <div><div style={{ fontWeight: 'bold' }}>Orden Aleatorio</div><div style={{ fontSize: '12px', color: '#666' }}>Mezclar preguntas al jugar.</div></div>
                                    <button onClick={toggleAleatorio} style={{ ...styles.toggleBtn, background: datos.config?.aleatorio ? '#2196F3' : '#ccc', justifyContent: datos.config?.aleatorio ? 'flex-end' : 'flex-start' }}><div style={styles.toggleCircle}></div></button>
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

                {/* MODAL DE AYUDA (NUEVO) */}
                {mostrandoAyuda && (
                    <div style={styles.configOverlay}>
                        <div style={styles.configModal}>
                            <div style={styles.configHeader}>
                                <h3>Ayuda: {configJuego.label}</h3>
                                <button onClick={() => setMostrandoAyuda(false)} style={styles.iconBtnBlack}><X /></button>
                            </div>
                            <div style={{ padding: '20px', lineHeight: '1.6', color: '#444' }}>
                                <p>{HELP_CONTENT[configJuego.id] || "Rellena los campos para crear tu recurso."}</p>
                            </div>
                            <button onClick={() => setMostrandoAyuda(false)} style={styles.closeConfigBtn}>Entendido</button>
                        </div>
                    </div>
                )}

            </div>
            <style>{`.hide-mobile { display: inline; } @media (max-width: 600px) { .hide-mobile { display: none; } }`}</style>
        </div>
    );
}

const InputConfig = ({ label, val, set }) => (<div style={{ marginBottom: '10px' }}><label style={{ display: 'block', fontSize: '12px', color: '#666', fontWeight: 'bold' }}>{label}</label><input value={val || ''} onChange={(e) => set(e.target.value)} style={styles.input} /></div>);

const styles = {
    overlay: { position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: '#f0f2f5', zIndex: 3000, display: 'flex', flexDirection: 'column' },
    container: { display: 'flex', flexDirection: 'column', height: '100%', width: '100%', maxWidth: '1000px', margin: '0 auto', background: 'white', boxShadow: '0 0 20px rgba(0,0,0,0.1)' },
    header: { background: '#3F51B5', padding: '10px 15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'white' },
    titleInput: { background: 'rgba(255,255,255,0.2)', border: 'none', color: 'white', fontSize: '16px', padding: '5px 10px', borderRadius: '4px', width: '90%', marginTop: '5px', outline: 'none' },
    iconBtn: { background: 'none', border: 'none', color: 'white', cursor: 'pointer', padding: '5px' },
    saveBtn: { background: '#4CAF50', border: 'none', color: 'white', padding: '8px 15px', borderRadius: '20px', display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer', fontWeight: 'bold' },
    subHeader: { background: '#e8eaf6', padding: '10px 15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #ccc' },
    sheetSelect: { padding: '8px', borderRadius: '5px', border: '1px solid #ccc', fontSize: '14px', flex: 1, maxWidth: '200px' },
    addSheetBtn: { background: 'white', border: '1px solid #3F51B5', color: '#3F51B5', padding: '5px 10px', borderRadius: '5px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', fontWeight: 'bold' },
    deleteSheetBtn: { background: '#FFEBEE', border: '1px solid #FFCDD2', color: '#C62828', padding: '5px 10px', borderRadius: '5px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' },
    body: { flex: 1, padding: '15px', overflowY: 'auto', background: '#f9f9f9' },
    label: { display: 'block', marginBottom: '5px', fontWeight: 'bold', fontSize: '13px', color: '#333' },
    input: { width: '100%', padding: '10px', borderRadius: '5px', border: '1px solid #ddd', boxSizing: 'border-box', fontSize: '14px' },
    addQuestionBtn: { background: '#2196F3', color: 'white', border: 'none', padding: '8px 15px', borderRadius: '20px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px', fontSize: '13px' },
    questionsList: { display: 'flex', flexDirection: 'column', gap: '15px' },
    questionCard: { background: 'white', padding: '15px', borderRadius: '8px', border: '1px solid #eee', boxShadow: '0 2px 5px rgba(0,0,0,0.05)' },
    questionHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' },
    qNumber: { fontWeight: 'bold', color: '#999', fontSize: '12px' },
    letraInput: { width: '40px', textAlign: 'center', fontSize: '16px', fontWeight: 'bold', border: '2px solid #3F51B5', borderRadius: '5px', color: '#3F51B5' },
    deleteBtn: { background: '#ffebee', color: '#c62828', border: 'none', padding: '5px', borderRadius: '4px', cursor: 'pointer' },
    inputsGrid: { display: 'flex', flexDirection: 'column', gap: '10px' },
    miniLabel: { fontSize: '11px', color: '#777', marginBottom: '2px', display: 'block', textTransform: 'uppercase' },
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