import { useState, useEffect } from 'react';
import { Save, X, Trash2, FolderPlus, ArrowUp, ArrowDown, Clock, Trophy, Settings, Calculator, Plus, Minus, X as Multiply, Divide } from 'lucide-react';

export default function EditorProBurbujasPikatron({ datos, setDatos, onClose, onSave, ususario }) {
    const [hojaActiva, setHojaActiva] = useState(0);
    const [mostrandoConfig, setMostrandoConfig] = useState(false);

    // Inicialización de datos con estructura específica para Burbujas/Pikatron
    // Inicialización de datos
    useEffect(() => {
        if (datos) {
            setDatos(prev => {
                const nuevaConfig = { ...prev.config };

                // --- AÑADIR ESTO: Valores por defecto estilo MathLive ---
                if (nuevaConfig.mathCount === undefined) nuevaConfig.mathCount = 8;
                if (nuevaConfig.mathTime === undefined) nuevaConfig.mathTime = 30;
                if (nuevaConfig.mathPuntosMax === undefined) nuevaConfig.mathPuntosMax = 30;
                if (nuevaConfig.mathPuntosMin === undefined) nuevaConfig.mathPuntosMin = 20;
                if (nuevaConfig.mathMin === undefined) nuevaConfig.mathMin = 1;
                if (nuevaConfig.mathMax === undefined) nuevaConfig.mathMax = 10;
                if (!nuevaConfig.mathTypes) nuevaConfig.mathTypes = ['POSITIVOS']; // Opciones: POSITIVOS, NEGATIVOS, DECIMALES, FRACCIONES
                if (!nuevaConfig.mathOps) nuevaConfig.mathOps = ['SUMA'];
                // --------------------------------------------------------
                if (!nuevaConfig.velocidad) nuevaConfig.velocidad = 'MODERADO';
                // ---------------------------------------------------
         

                   
               
                return {
                    ...prev,
                    tipo: 'PRO-BURBUJAS',
                    config: {
                        ...nuevaConfig,
                        aleatorio: true,
                        numPreguntas: prev.config?.numPreguntas || 10,
                        puntosAcierto: prev.config?.puntosAcierto || 10,
                        puntosFallo: prev.config?.puntosFallo || 2,
                        tiempoPregunta: prev.config?.tiempoPregunta || 20
                    },



               pais: prev.pais !== undefined ? prev.pais : (usuario?.pais || ''),

                    region: prev.region !== undefined ? prev.region : (usuario?.region || ''),

                    // Nota: En tu código usas 'poblacion', en el perfil suele ser 'localidad'
                    poblacion: prev.poblacion !== undefined ? prev.poblacion : (usuario?.localidad || usuario?.poblacion || ''),

                    ciclo: prev.ciclo !== undefined ? prev.ciclo : (usuario?.ciclo || 'Secundaria'),

                    temas: prev.temas !== undefined ? prev.temas : (usuario?.temas || ''),
                };
            });
        }
    }, []);

    // --- LÓGICA DE ACTUALIZACIÓN ---
    // --- LÓGICA DE ACTUALIZACIÓN ---
    const updateGlobalConfig = (k, v) => {
        setDatos({ ...datos, config: { ...datos.config, [k]: v } });
    };
    // --- NUEVAS FUNCIONES PARA LA CONFIGURACIÓN ---
    const togglePermitirCopia = () => setDatos(prev => ({ ...prev, isPrivate: !prev.isPrivate }));
    const toggleTerminado = () => setDatos(prev => ({ ...prev, isFinished: !prev.isFinished }));

    // AÑADIR ESTA FUNCIÓN
    const toggleConfigArray = (key, value) => {
        const currentArr = datos.config[key] || [];
        let newArr;
        if (currentArr.includes(value)) {
            newArr = currentArr.filter(item => item !== value);
        } else {
            newArr = [...currentArr, value];
        }
        updateGlobalConfig(key, newArr);
    };

    // Gestión Hojas
    const addHoja = () => {
        setDatos({
            ...datos,
            hojas: [
                ...datos.hojas,
                {
                    nombreHoja: `Nivel ${datos.hojas.length + 1}`,
                    preguntas: [],
                    // Configuración del Generador por defecto para la nueva hoja
                    generador: {
                        activo: false,
                        cantidad: 5,
                        tipos: ['SUMA'],
                        min: 1,
                        max: 10
                    }
                }
            ]
        });
    };

    const deleteHoja = (idx) => {
        if (datos.hojas.length <= 1) return alert("Debe haber al menos un nivel.");
        if (confirm("¿Borrar este nivel y sus preguntas?")) {
            const nuevas = datos.hojas.filter((_, i) => i !== idx);
            setDatos({ ...datos, hojas: nuevas });
            setHojaActiva(0);
        }
    };

    const renameHoja = (idx, val) => {
        const n = [...datos.hojas]; n[idx].nombreHoja = val; setDatos({ ...datos, hojas: n });
    };

    // Gestión Generador Matemático
    const updateGenerador = (field, val) => {
        const n = [...datos.hojas];
        if (!n[hojaActiva].generador) {
            n[hojaActiva].generador = { activo: false, cantidad: 5, tipos: ['SUMA'], min: 1, max: 10 };
        }
        n[hojaActiva].generador[field] = val;
        setDatos({ ...datos, hojas: n });
    };

    const toggleTipoGenerador = (tipo) => {
        const n = [...datos.hojas];
        const gen = n[hojaActiva].generador;
        if (gen.tipos.includes(tipo)) {
            gen.tipos = gen.tipos.filter(t => t !== tipo);
        } else {
            gen.tipos.push(tipo);
        }
        setDatos({ ...datos, hojas: n });
    };

    // Gestión Preguntas Manuales (SOLO MULTIPLE)
    const addPregunta = () => {
        const nuevas = [...datos.hojas];
        const nuevaP = {
            tipo: 'MULTIPLE', // Forzado
            pregunta: '',
            correcta: '',
            incorrectas: ['', '', ''],
            // Opcionales por pregunta (si se quiere override)
            tiempo: datos.config.tiempoPregunta,
            puntosMax: datos.config.puntosAcierto,
            puntosMin: datos.config.puntosFallo
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

    // Estilos locales
    const inputStyleSmall = { padding: '8px', borderRadius: '5px', border: '1px solid #ddd', fontSize: '14px', width: '100%', boxSizing: 'border-box' };
    const arrowBtn = { background: '#eee', border: 'none', cursor: 'pointer', fontSize: '10px', padding: '6px', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' };
    const opBtn = (activo) => ({
        flex: 1, padding: '8px', border: `2px solid ${activo ? '#3498db' : '#ddd'}`,
        background: activo ? '#e8f4fc' : 'white', borderRadius: '8px', cursor: 'pointer',
        display: 'flex', justifyContent: 'center', alignItems: 'center', color: activo ? '#3498db' : '#888'
    });

    // --- COMPONENTE VISUAL GENERADOR (Estilo MathLive) ---
    const MathLiveBlock = () => {
        const config = datos.config || {};
        return (
            <div style={styles.mathBlock}>
                <div style={styles.mathHeader}>
                    <Calculator size={24} /> Configuración de Operaciones (Generador)
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '15px', marginBottom: '15px' }}>
                    <div>
                        <label style={styles.label}>Cantidad a Generar</label>
                        <input type="number" value={config.mathCount} onChange={e => updateGlobalConfig('mathCount', parseInt(e.target.value))} style={styles.input} />
                    </div>
                    <div>
                        <label style={styles.label}>Tiempo (s)</label>
                        <input type="number" value={config.mathTime} onChange={e => updateGlobalConfig('mathTime', parseInt(e.target.value))} style={styles.input} />
                    </div>
                    {/* Nota: En Pikatron los puntos suelen ser globales, pero si quieres específicos para mates: */}
                    <div>
                        <label style={styles.label}>Pts Max</label>
                        <input type="number" value={config.mathPuntosMax} onChange={e => updateGlobalConfig('mathPuntosMax', parseInt(e.target.value))} style={styles.input} />
                    </div>
                    <div>
                        <label style={styles.label}>Pts Min</label>
                        <input type="number" value={config.mathPuntosMin} onChange={e => updateGlobalConfig('mathPuntosMin', parseInt(e.target.value))} style={styles.input} />
                    </div>
                </div>

                <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', marginBottom: '15px' }}>
                    <div style={{ flex: 1, minWidth: '200px' }}>
                        <label style={styles.label}>Tipos de Números</label>
                        <div style={styles.checkboxGroup}>
                            <label><input type="checkbox" checked={config.mathTypes?.includes('POSITIVOS')} onChange={() => toggleConfigArray('mathTypes', 'POSITIVOS')} /> Positivos</label>
                            <label><input type="checkbox" checked={config.mathTypes?.includes('NEGATIVOS')} onChange={() => toggleConfigArray('mathTypes', 'NEGATIVOS')} /> Negativos</label>
                            <label><input type="checkbox" checked={config.mathTypes?.includes('DECIMALES')} onChange={() => toggleConfigArray('mathTypes', 'DECIMALES')} /> Decimales</label>
                            <label><input type="checkbox" checked={config.mathTypes?.includes('FRACCIONES')} onChange={() => toggleConfigArray('mathTypes', 'FRACCIONES')} /> Fracciones</label>
                        </div>
                    </div>
                    <div style={{ flex: 1, minWidth: '200px' }}>
                        <label style={styles.label}>Operaciones</label>
                        <div style={styles.checkboxGroup}>
                            <label><input type="checkbox" checked={config.mathOps?.includes('SUMA')} onChange={() => toggleConfigArray('mathOps', 'SUMA')} /> <Plus size={14} /> Suma</label>
                            <label><input type="checkbox" checked={config.mathOps?.includes('RESTA')} onChange={() => toggleConfigArray('mathOps', 'RESTA')} /> <Minus size={14} /> Resta</label>
                            <label><input type="checkbox" checked={config.mathOps?.includes('MULT')} onChange={() => toggleConfigArray('mathOps', 'MULT')} /> <Multiply size={14} /> Multiplicación</label>
                            <label><input type="checkbox" checked={config.mathOps?.includes('DIV')} onChange={() => toggleConfigArray('mathOps', 'DIV')} /> <Divide size={14} /> División</label>
                        </div>
                    </div>
                </div>

                <div>
                    <label style={styles.label}>Rango de Números (Min - Max)</label>
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                        <input type="number" value={config.mathMin} onChange={e => updateGlobalConfig('mathMin', parseInt(e.target.value))} style={{ ...styles.input, width: '80px' }} />
                        <span>a</span>
                        <input type="number" value={config.mathMax} onChange={e => updateGlobalConfig('mathMax', parseInt(e.target.value))} style={{ ...styles.input, width: '80px' }} />
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
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1 }}>
                        <h2 style={{ margin: 0, color: '#f1c40f', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Settings size={24} /> <span>Editor Games</span>
                        </h2>
                        <input
                            placeholder="Título del Recurso..."
                            value={datos.titulo}
                            onChange={e => setDatos({ ...datos, titulo: e.target.value })}
                            style={styles.titleInput}
                        />
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <button onClick={() => setMostrandoConfig(true)} style={styles.iconBtn} title="Configuración Global">
                            <Settings size={22} />
                        </button>
                        <button onClick={onSave} style={styles.saveBtn}>
                            <Save size={18} /> Guardar
                        </button>
                        <button onClick={onClose} style={styles.iconBtn}>
                            <X size={22} />
                        </button>
                    </div>
                </div>

                {/* TABS (HOJAS/NIVELES) */}
                <div style={styles.tabsContainer}>
                    {datos.hojas.map((h, i) => (
                        <div key={i} onClick={() => setHojaActiva(i)} style={{
                            ...styles.tab,
                            background: i === hojaActiva ? 'white' : '#ecf0f1',
                            color: i === hojaActiva ? '#2c3e50' : '#7f8c8d',
                            borderBottom: i === hojaActiva ? '3px solid #3498db' : 'none'
                        }}>
                            <input value={h.nombreHoja} onChange={(e) => renameHoja(i, e.target.value)} style={styles.tabInput} onClick={e => e.stopPropagation()} />
                            {datos.hojas.length > 1 && <Trash2 size={14} onClick={(e) => { e.stopPropagation(); deleteHoja(i) }} className="trash-icon" />}
                        </div>
                    ))}
                    <button onClick={addHoja} style={styles.addTabBtn} title="Añadir Nivel"><FolderPlus size={20} /></button>
                </div>

                {/* CUERPO PRINCIPAL */}
                <div style={styles.body}>




                    {/* 1. SECCIÓN GENERADOR MATEMÁTICO */}

                    <MathLiveBlock />


                             

                    {/* 2. LISTA PREGUNTAS MANUALES */}
                    <div style={{ maxWidth: '800px', margin: '20px auto' }}>
                        <h4 style={{ color: '#7f8c8d', borderBottom: '2px solid #ddd', paddingBottom: '10px', marginBottom: '15px' }}>
                            Preguntas Manuales ({datos.hojas[hojaActiva].preguntas.length})
                        </h4>

                        {datos.hojas[hojaActiva].preguntas.length === 0 && !datos.hojas[hojaActiva].generador?.activo && (
                            <div style={{ textAlign: 'center', color: '#aaa', padding: '30px' }}>
                                No hay preguntas. Añade manuales o activa el generador.
                            </div>
                        )}

                        {datos.hojas[hojaActiva].preguntas.map((p, i) => (
                            <div key={i} style={{ background: 'white', padding: '15px', borderRadius: '12px', boxShadow: '0 2px 5px rgba(0,0,0,0.05)', display: 'flex', alignItems: 'flex-start', gap: '10px', marginBottom: '15px', borderLeft: '5px solid #3498db' }}>
                                {/* Controles Orden */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', alignItems: 'center', paddingTop: '5px' }}>
                                    <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#bdc3c7' }}>#{i + 1}</span>
                                    <button onClick={() => moverPregunta(i, -1)} disabled={i === 0} style={arrowBtn}><ArrowUp size={14} color="#555" /></button>
                                    <button onClick={() => moverPregunta(i, 1)} disabled={i === datos.hojas[hojaActiva].preguntas.length - 1} style={arrowBtn}><ArrowDown size={14} color="#555" /></button>
                                    <button onClick={() => deletePregunta(i)} style={{ ...arrowBtn, background: '#ffebee', marginTop: '5px' }} title="Borrar"><Trash2 size={14} color="#c62828" /></button>
                                </div>

                                {/* Campos Pregunta (SOLO MULTIPLE) */}
                                <div style={{ flex: 1 }}>
                                    <div style={{ marginBottom: '10px' }}>
                                        <input
                                            placeholder="Escribe la pregunta..."
                                            value={p.pregunta}
                                            onChange={e => updatePregunta(i, 'pregunta', e.target.value)}
                                            style={{ ...inputStyleSmall, fontWeight: 'bold', fontSize: '16px', border: '1px solid #bdc3c7' }}
                                        />
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                        <div style={{ position: 'relative' }}>
                                            <input
                                                placeholder="Respuesta Correcta"
                                                value={p.correcta}
                                                onChange={e => updatePregunta(i, 'correcta', e.target.value)}
                                                style={{ ...inputStyleSmall, borderColor: '#2ecc71', background: '#eafaf1', paddingLeft: '30px' }}
                                            />
                                            <div style={{ position: 'absolute', left: '8px', top: '8px' }}>✅</div>
                                        </div>
                                        {[0, 1, 2].map(k => (
                                            <div key={k} style={{ position: 'relative' }}>
                                                <input
                                                    placeholder={`Incorrecta ${k + 1}`}
                                                    value={p.incorrectas?.[k] || ''}
                                                    onChange={e => updatePreguntaArray(i, 'incorrectas', k, e.target.value)}
                                                    style={{ ...inputStyleSmall, borderColor: '#e74c3c', background: '#fdedec', paddingLeft: '30px' }}
                                                />
                                                <div style={{ position: 'absolute', left: '8px', top: '8px' }}>❌</div>
                                            </div>
                                        ))}
                                    </div>
                                    {/* Config Individual Opcional */}
                                    <div style={{ marginTop: '10px', display: 'flex', gap: '15px', fontSize: '12px', color: '#7f8c8d' }}>
                                        <div title="Si se deja vacío usa el global">
                                            <Trophy size={12} /> Acierto:
                                            <input
                                                type="number"
                                                placeholder={datos.config.puntosAcierto}
                                                value={p.puntosMax || ''}
                                                onChange={e => updatePregunta(i, 'puntosMax', e.target.value)}
                                                style={{ width: '40px', marginLeft: '5px', border: 'none', borderBottom: '1px solid #ccc', textAlign: 'center' }}
                                            />
                                        </div>
                                        <div title="Si se deja vacío usa el global">
                                            <Trophy size={12} color="#e74c3c" /> Fallo:
                                            <input
                                                type="number"
                                                placeholder={datos.config.puntosFallo}
                                                value={p.puntosMin || ''}
                                                onChange={e => updatePregunta(i, 'puntosMin', e.target.value)}
                                                style={{ width: '40px', marginLeft: '5px', border: 'none', borderBottom: '1px solid #ccc', textAlign: 'center' }}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}

                        <button onClick={addPregunta} style={styles.addMoreBtn}>
                            + AÑADIR PREGUNTA MANUAL
                        </button>
                    </div>
                </div>

                {/* MODAL CONFIGURACIÓN GLOBAL */}
                {mostrandoConfig && (
                    <div style={styles.configOverlay}>
                        <div style={styles.configModal}>
                            <div style={styles.configHeader}>
                                <h3>Configuración del Recurso</h3>
                                <button onClick={() => setMostrandoConfig(false)} style={styles.iconBtnBlack}><X /></button>
                            </div>

                            <div style={styles.configBody}>
                                {/* --- SECCIÓN 1: METADATOS Y BÚSQUEDA --- */}
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
                                    <select
                                        value={datos.ciclo || 'Primaria'}
                                        onChange={e => setDatos({ ...datos, ciclo: e.target.value })}
                                        style={styles.input}
                                    >
                                        <option value="Infantil">Infantil</option>
                                        <option value="Primaria">Primaria</option>
                                        <option value="Secundaria">Secundaria</option>
                                        <option value="Bachillerato">Bachillerato</option>
                                        <option value="Otros">Otros</option>
                                    </select>
                                </div>

                                {/* --- SECCIÓN 2: JUEGO (Lo que ya tenías) --- */}


                                {/* --- SECCIÓN 2: JUEGO --- */}
                                <h4 style={styles.sectionTitle}>Configuración del Juego</h4>

                                {/* Puntos y Tiempo */}
                                <div style={{ display: 'flex', gap: '15px', marginBottom: '15px' }}>
                                    <div style={{ flex: 1 }}>
                                        <label style={styles.label}>Pts Acierto</label>
                                        <input type="number" value={datos.config?.puntosAcierto || 10} onChange={e => updateGlobalConfig('puntosAcierto', e.target.value)} style={styles.input} />
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <label style={styles.label}>Resta Fallo</label>
                                        <input type="number" value={datos.config?.puntosFallo || 2} onChange={e => updateGlobalConfig('puntosFallo', e.target.value)} style={styles.input} />
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <label style={styles.label}>Tiempo (s)</label>
                                        <input type="number" value={datos.config?.tiempoPregunta || 20} onChange={e => updateGlobalConfig('tiempoPregunta', e.target.value)} style={styles.input} />
                                    </div>
                                </div>

                                {/* AQUI EL NUEVO SELECTOR DE VELOCIDAD */}
                                <div style={{ marginBottom: '15px' }}>
                                    <label style={styles.label}>Velocidad de Movimiento</label>
                                    <select
                                        value={datos.config?.velocidad || 'MODERADO'}
                                        onChange={e => updateGlobalConfig('velocidad', e.target.value)}
                                        style={styles.input}
                                    >
                                        <option value="LENTO">🐢 Lento</option>
                                        <option value="MODERADO">🚶 Moderado</option>
                                        <option value="RAPIDO">🐇 Rápido</option>
                                    </select>
                                </div>

                                {/* Orden Aleatorio */}
                                <div style={styles.toggleRow}>
                                    <div><div style={{ fontWeight: 'bold' }}>Orden Aleatorio</div></div>
                                    <button onClick={() => updateGlobalConfig('aleatorio', !datos.config?.aleatorio)} style={{ ...styles.toggleBtn, background: datos.config?.aleatorio ? '#2196F3' : '#ccc', justifyContent: datos.config?.aleatorio ? 'flex-end' : 'flex-start' }}><div style={styles.toggleCircle}></div></button>
                                </div>

                                {/* --- SECCIÓN 3: OPCIONES DE PUBLICACIÓN --- */}
                                <h4 style={styles.sectionTitle}>Publicación</h4>
                                <div style={styles.toggleRow}>
                                    <div>
                                        <div style={{ fontWeight: 'bold' }}>Terminado</div>
                                        <div style={{ fontSize: '11px', color: '#666' }}>Visible para alumnos.</div>
                                    </div>
                                    <button onClick={toggleTerminado} style={{ ...styles.toggleBtn, background: datos.isFinished ? '#27ae60' : '#ccc', justifyContent: datos.isFinished ? 'flex-end' : 'flex-start' }}>
                                        <div style={styles.toggleCircle}></div>
                                    </button>
                                </div>

                                <div style={styles.toggleRow}>
                                    <div>
                                        <div style={{ fontWeight: 'bold' }}>Permitir Copia</div>
                                        <div style={{ fontSize: '11px', color: '#666' }}>Otros profesores pueden usarlo.</div>
                                    </div>
                                    <button onClick={togglePermitirCopia} style={{ ...styles.toggleBtn, background: !datos.isPrivate ? '#9b59b6' : '#ccc', justifyContent: !datos.isPrivate ? 'flex-end' : 'flex-start' }}>
                                        <div style={styles.toggleCircle}></div>
                                    </button>
                                </div>
                            </div>

                            <button onClick={() => setMostrandoConfig(false)} style={styles.closeConfigBtn}>Guardar y Cerrar</button>
                        </div>
                        
                    </div>
                )}

            </div>
        </div>
    );
}

// Componente auxiliar para inputs de texto simples
const InputConfig = ({ label, val, set }) => (
    <div style={{ marginBottom: '10px' }}>
        <label style={{ display: 'block', fontSize: '12px', color: '#666', fontWeight: 'bold', marginBottom: '5px' }}>{label}</label>
        <input value={val || ''} onChange={(e) => set(e.target.value)} style={styles.input} />
    </div>
);




const styles = {
    overlay: { position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: '#f4f6f7', zIndex: 3000, display: 'flex', flexDirection: 'column' },
    container: { display: 'flex', flexDirection: 'column', height: '100%', width: '100%', maxWidth: '1000px', margin: '0 auto', background: 'white', boxShadow: '0 0 25px rgba(0,0,0,0.1)' },

    header: { background: '#2c3e50', padding: '15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'white' },
    titleInput: { background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', color: 'white', fontSize: '18px', padding: '8px 12px', borderRadius: '6px', flex: 1, outline: 'none', marginLeft: '15px' },
    iconBtn: { background: 'none', border: 'none', color: 'white', cursor: 'pointer', padding: '8px', borderRadius: '50%', transition: 'background 0.2s' },
    saveBtn: { background: '#2ecc71', border: 'none', color: 'white', padding: '8px 20px', borderRadius: '20px', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px', boxShadow: '0 2px 5px rgba(0,0,0,0.2)' },

    mathBlock: { background: 'white', borderRadius: '12px', padding: '20px', boxShadow: '0 4px 15px rgba(0,0,0,0.1)', borderTop: '5px solid #9C27B0', marginBottom: '20px' },
    mathHeader: { display: 'flex', alignItems: 'center', gap: '10px', fontSize: '1.2rem', fontWeight: 'bold', color: '#9C27B0', marginBottom: '15px', borderBottom: '1px solid #eee', paddingBottom: '10px' },
    checkboxGroup: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', background: '#f9f9f9', padding: '10px', borderRadius: '8px' },



    tabsContainer: { background: '#f8f9fa', padding: '10px 10px 0 10px', display: 'flex', gap: '5px', overflowX: 'auto', borderBottom: '1px solid #ddd' },
    tab: { padding: '12px 20px', borderRadius: '10px 10px 0 0', cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '10px', minWidth: '120px', transition: 'all 0.2s' },
    tabInput: { border: 'none', background: 'transparent', fontWeight: 'bold', width: '90px', outline: 'none', color: 'inherit', fontSize: '14px' },
    addTabBtn: { padding: '10px', background: 'transparent', border: 'none', cursor: 'pointer', color: '#3498db' },

    body: { flex: 1, padding: '20px', overflowY: 'auto', background: '#f4f6f7' },

    generatorBox: { background: '#e8f4fc', padding: '20px', borderRadius: '15px', border: '2px dashed #3498db', marginBottom: '30px', maxWidth: '800px', margin: '0 auto 30px auto' },

    addMoreBtn: { width: '100%', padding: '15px', border: '2px dashed #bdc3c7', background: 'white', borderRadius: '10px', color: '#7f8c8d', fontWeight: 'bold', cursor: 'pointer', fontSize: '1rem', transition: 'background 0.2s' },

    label: { display: 'block', marginBottom: '8px', fontWeight: 'bold', fontSize: '13px', color: '#34495e' },
    input: { width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #ccc', boxSizing: 'border-box', fontSize: '14px' },

    // Config Modal
    configOverlay: { position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 4000 },
    configModal: { background: 'white', width: '90%', maxWidth: '450px', borderRadius: '15px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 10px 40px rgba(0,0,0,0.3)' },
    configHeader: { padding: '20px', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
    iconBtnBlack: { background: 'none', border: 'none', cursor: 'pointer', padding: '5px', color: '#333' },
    configBody: { padding: '25px', overflowY: 'auto', flex: 1 },
    sectionTitle: { margin: '0 0 15px 0', color: '#2980b9', borderBottom: '2px solid #eee', paddingBottom: '8px', fontSize: '16px' },
    closeConfigBtn: { width: '100%', padding: '15px', background: '#34495e', color: 'white', border: 'none', borderBottomLeftRadius: '15px', borderBottomRightRadius: '15px', fontSize: '16px', cursor: 'pointer', fontWeight: 'bold' },
    toggleRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', padding: '12px', background: '#f8f9fa', borderRadius: '8px' },
    toggleBtn: { width: '50px', height: '28px', borderRadius: '14px', border: 'none', padding: '3px', cursor: 'pointer', display: 'flex', alignItems: 'center', transition: 'background 0.3s' },
    toggleCircle: { width: '22px', height: '22px', background: 'white', borderRadius: '50%', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }
};