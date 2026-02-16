import React, { useState, useEffect } from 'react';
import { Save, X, Trash2, Plus, Settings, RotateCcw, RefreshCw, Mail } from 'lucide-react';
import { collection, query, where, getDocs, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';

// CONFIGURACIÓN DE LOS JUEGOS DE DESTINO
const JUEGOS_DESTINO = [
    { id: 'PASAPALABRA', label: 'Pasapalabra' },
    { id: 'CAZABURBUJAS', label: 'CazaBurbujas' },
    { id: 'THINKHOOT', label: 'PiLive (ThinkHoot)' },
    { id: 'RULETA', label: 'La Ruleta' },
    { id: 'PIKATRON', label: 'Pikatron' },
    { id: 'APAREJADOS', label: 'AparejaDOS' }
];

export default function EditorQuestionSender({ datos, setDatos, onClose, onSave }) {
    const [indiceHojaActiva, setIndiceHojaActiva] = useState(0);
    const [mostrandoConfig, setMostrandoConfig] = useState(false);
    const [cargandoMensajes, setCargandoMensajes] = useState(false);

    // 1. INICIALIZACIÓN
    useEffect(() => {
        if (!datos.hojas || datos.hojas.length === 0) {
            setDatos(prev => ({ ...prev, hojas: [{ nombreHoja: 'Grupo A', preguntas: [] }] }));
        }
        // Por defecto, si no hay target, ponemos Pasapalabra
        if (!datos.targetGame) {
            setDatos(prev => ({ ...prev, targetGame: 'PASAPALABRA' }));
        }
    }, []);

    // 2. FUNCIÓN PARA BUSCAR CORREOS (EVITANDO DUPLICADOS)
    // 2. FUNCIÓN PARA BUSCAR CORREOS (CORREGIDA)
    const comprobarBuzon = async () => {
        if (!datos.id) return;
        setCargandoMensajes(true);

        try {
            const q = query(collection(db, "mail_questions"), where("recursoId", "==", datos.id));
            const snap = await getDocs(q);

            if (!snap.empty) {
                // --- CORRECCIÓN CLAVE: DEEP COPY (COPIA PROFUNDA) ---
                // Creamos una copia nueva de CADA hoja y de SU ARRAY de preguntas.
                // Esto rompe cualquier vínculo o "referencia compartida" que cause que se peguen en todas.
                const nuevasHojas = datos.hojas.map(h => ({
                    ...h,
                    preguntas: [...(h.preguntas || [])] // <--- Esto asegura independencia total
                }));
                // ---------------------------------------------------

                let contadordeCambios = 0;

                for (const docMail of snap.docs) {
                    const paquete = docMail.data();
                    const idx = parseInt(paquete.hojaIndex); // Aseguramos que sea un número

                    // Verificamos que la hoja exista
                    if (nuevasHojas[idx]) {

                        // Preparamos las preguntas (manteniendo el nombre del alumno aquí)
                        const preguntasNuevasLimpias = (paquete.preguntas || []).map(p => ({
                            ...p,
                            studentName: p.studentName || 'Anónimo',
                            fecha: p.fecha || new Date().toISOString()
                        }));

                        // Añadimos SOLO a la hoja correspondiente
                        nuevasHojas[idx].preguntas.push(...preguntasNuevasLimpias);
                        contadordeCambios++;

                        // Borramos del buzón
                        await deleteDoc(doc(db, "mail_questions", docMail.id));
                    }
                }

                if (contadordeCambios > 0) {
                    setDatos(prev => ({ ...prev, hojas: nuevasHojas }));
                    alert(`📬 Se han descargado ${contadordeCambios} paquetes de preguntas en sus hojas correspondientes.`);
                }
            } else {
                console.log("Buzón vacío");
            }
        } catch (e) {
            console.error("Error consultando buzón:", e);
            alert("Error al comprobar mensajes.");
        }
        setCargandoMensajes(false);
    };

    // --- GESTIÓN DE HOJAS ---
    const agregarHoja = () => {
        const nuevasHojas = [...datos.hojas, { nombreHoja: `Grupo ${datos.hojas.length + 1}`, preguntas: [], accessCode: '' }];
        setDatos({ ...datos, hojas: nuevasHojas });
        setIndiceHojaActiva(nuevasHojas.length - 1);
    };

    const borrarHoja = () => {
        if (datos.hojas.length <= 1) return alert("Mínimo una hoja.");
        if (confirm("¿Borrar esta hoja y sus preguntas?")) {
            const nuevas = [...datos.hojas];
            nuevas.splice(indiceHojaActiva, 1);
            setDatos({ ...datos, hojas: nuevas });
            setIndiceHojaActiva(0);
        }
    };

    const generarCodigoHoja = () => {
        const codigo = Math.random().toString(36).substring(2, 7).toUpperCase();
        const nuevas = [...datos.hojas];
        nuevas[indiceHojaActiva].accessCode = codigo;
        setDatos({ ...datos, hojas: nuevas });
    };

    // --- GESTIÓN DE PREGUNTAS ---
    const editarPregunta = (idxPregunta, campo, valor) => {
        const nuevas = [...datos.hojas];
        nuevas[indiceHojaActiva].preguntas[idxPregunta][campo] = valor;
        setDatos({ ...datos, hojas: nuevas });
    };

    const editarIncorrecta = (idxPregunta, idxIncorrecta, valor) => {
        const nuevas = [...datos.hojas];
        const p = nuevas[indiceHojaActiva].preguntas[idxPregunta];
        if (!p.incorrectas) p.incorrectas = ['', '', ''];
        p.incorrectas[idxIncorrecta] = valor;
        setDatos({ ...datos, hojas: nuevas });
    };

    const borrarPregunta = (idx) => {
        const nuevas = [...datos.hojas];
        nuevas[indiceHojaActiva].preguntas.splice(idx, 1);
        setDatos({ ...datos, hojas: nuevas });
    };

    const hojaActual = datos.hojas[indiceHojaActiva] || { preguntas: [] };
    const juegoDestinoActual = datos.targetGame || 'PASAPALABRA';

    // --- RENDERIZADO DINÁMICO SEGÚN JUEGO DE DESTINO ---
    const renderCamposDinamicos = (p, i) => {
        // CASO 1: PASAPALABRA (Letra, Pregunta, Respuesta)
        if (juegoDestinoActual === 'PASAPALABRA') {
            return (
                <div style={styles.grid2}>
                    <div style={{ width: '60px' }}>
                        <label style={styles.labelMini}>Letra</label>
                        <input
                            value={p.letra || ''}
                            onChange={e => editarPregunta(i, 'letra', e.target.value.toUpperCase())}
                            style={{ ...styles.input, textAlign: 'center', fontWeight: 'bold', color: '#3F51B5' }}
                            maxLength={1}
                            placeholder="A"
                        />
                    </div>
                    <div style={{ flex: 1 }}>
                        <label style={styles.labelMini}>Pregunta / Definición</label>
                        <input
                            value={p.pregunta || ''}
                            onChange={e => editarPregunta(i, 'pregunta', e.target.value)}
                            style={styles.input}
                            placeholder="Definición..."
                        />
                    </div>
                    <div style={{ flex: 1 }}>
                        <label style={styles.labelMini}>Respuesta Correcta</label>
                        <input
                            value={p.respuesta || p.correcta || ''}
                            onChange={e => editarPregunta(i, 'respuesta', e.target.value)}
                            style={{ ...styles.input, borderColor: '#4CAF50' }}
                            placeholder="Palabra"
                        />
                    </div>
                </div>
            );
        }

        // CASO 2: APAREJADOS (Parejas)
        if (juegoDestinoActual === 'APAREJADOS') {
            return (
                <div style={styles.grid2}>
                    <div style={{ flex: 1 }}>
                        <label style={styles.labelMini}>Pregunta (Lado A)</label>
                        <input
                            value={p.pregunta || p.terminoA || ''}
                            onChange={e => editarPregunta(i, 'pregunta', e.target.value)}
                            style={styles.input}
                            placeholder="Ej: País"
                        />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', paddingTop: '15px' }}>↔️</div>
                    <div style={{ flex: 1 }}>
                        <label style={styles.labelMini}>Respuesta (Lado B)</label>
                        <input
                            value={p.respuesta || p.terminoB || ''}
                            onChange={e => editarPregunta(i, 'respuesta', e.target.value)}
                            style={{ ...styles.input, borderColor: '#FF9800' }}
                            placeholder="Ej: Capital"
                        />
                    </div>
                </div>
            );
        }

        // CASO 3: RESTO (Burbujas, Pikatron, PiLive, Ruleta) -> Tipo Test
        // "Debe aparecer pregunta, respuesta correcta y tres incorrectas"
        return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={styles.grid2}>
                    <div style={{ flex: 2 }}>
                        <label style={styles.labelMini}>Pregunta</label>
                        <input
                            value={p.pregunta || ''}
                            onChange={e => editarPregunta(i, 'pregunta', e.target.value)}
                            style={styles.input}
                            placeholder="Enunciado..."
                        />
                    </div>
                    <div style={{ flex: 1 }}>
                        <label style={styles.labelMini}>Respuesta Correcta</label>
                        <input
                            value={p.respuesta || p.correcta || ''}
                            onChange={e => editarPregunta(i, 'respuesta', e.target.value)}
                            style={{ ...styles.input, borderColor: '#4CAF50', background: '#e8f5e9' }}
                            placeholder="Correcta"
                        />
                    </div>
                </div>

                {/* Incorrectas */}
                <div>
                    <label style={styles.labelMini}>Respuestas Incorrectas (3)</label>
                    <div style={{ display: 'flex', gap: '10px' }}>
                        {[0, 1, 2].map(idxInc => (
                            <input
                                key={idxInc}
                                value={p.incorrectas ? p.incorrectas[idxInc] : ''}
                                onChange={e => editarIncorrecta(i, idxInc, e.target.value)}
                                style={{ ...styles.input, borderColor: '#ef9a9a', fontSize: '13px' }}
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
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <Mail color="white" />
                        <div>
                            <h2 style={{ margin: 0, fontSize: '16px', color: 'white' }}>QUESTION SENDER</h2>
                            <div style={{ fontSize: '11px', color: '#bbdefb' }}>Recibiendo para: <b>{JUEGOS_DESTINO.find(g => g.id === juegoDestinoActual)?.label}</b></div>
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: '10px' }}>
                        <button onClick={comprobarBuzon} disabled={cargandoMensajes} style={styles.refreshBtn}>
                            <RefreshCw size={18} className={cargandoMensajes ? 'spin' : ''} /> {cargandoMensajes ? '...' : 'Comprobar Buzón'}
                        </button>
                        <button onClick={() => setMostrandoConfig(true)} style={styles.iconBtn}><Settings /></button>
                        <button onClick={onSave} style={styles.saveBtn}><Save size={18} /> Guardar</button>
                        <button onClick={onClose} style={styles.iconBtn}><X /></button>
                    </div>
                </div>

                {/* SUB-HEADER HOJAS */}
                <div style={styles.subHeader}>
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                        <span style={{ fontWeight: 'bold', color: '#555' }}>Hoja/Grupo:</span>
                        <select value={indiceHojaActiva} onChange={e => setIndiceHojaActiva(parseInt(e.target.value))} style={styles.select}>
                            {datos.hojas.map((h, i) => <option key={i} value={i}>{h.nombreHoja || `Hoja ${i + 1}`}</option>)}
                        </select>
                        <button onClick={borrarHoja} style={styles.iconBtnRed}><Trash2 size={16} /></button>
                        <button onClick={agregarHoja} style={styles.btnAdd}><Plus size={16} /> Añadir Hoja</button>
                    </div>
                </div>

                {/* BODY */}
                <div style={styles.body}>

                    {/* PANEL DE CÓDIGO (INFO DE LA HOJA) */}
                    <div style={styles.codePanel}>
                        <div style={{ flex: 1 }}>
                            <label style={styles.label}>Nombre del Grupo</label>
                            <input
                                value={hojaActual.nombreHoja}
                                onChange={e => {
                                    const n = [...datos.hojas];
                                    n[indiceHojaActiva].nombreHoja = e.target.value;
                                    setDatos({ ...datos, hojas: n });
                                }}
                                style={styles.input}
                            />
                        </div>

                        {/* --- AÑADIDO: CAMPO NÚMERO DE PREGUNTAS POR HOJA --- */}
                        <div style={{ width: '100px', marginLeft: '10px' }}>
                            <label style={styles.label}>Nº Preguntas</label>
                            <input
                                type="number"
                                min="1"
                                max="20"
                                value={hojaActual.numReq || 3} // Por defecto 3 si no existe
                                onChange={e => {
                                    const n = [...datos.hojas];
                                    n[indiceHojaActiva].numReq = parseInt(e.target.value);
                                    setDatos({ ...datos, hojas: n });
                                }}
                                style={{ ...styles.input, textAlign: 'center', fontWeight: 'bold' }}
                            />
                        </div>
                        {/* --------------------------------------------------- */}







                        <div style={{ textAlign: 'center', borderLeft: '1px solid #ddd', paddingLeft: '20px' }}>
                            <label style={styles.label}>CÓDIGO ALUMNOS</label>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <span style={styles.bigCode}>{hojaActual.accessCode || '---'}</span>
                                <button onClick={generarCodigoHoja} style={styles.btnSmall}><RotateCcw size={14} /> Generar</button>
                            </div>
                        </div>
                    </div>

                    {/* LISTA DE PREGUNTAS */}
                    <h3 style={{ marginTop: '20px', color: '#333' }}>Respuestas Recibidas ({hojaActual.preguntas.length})</h3>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', paddingBottom: '40px' }}>
                        {hojaActual.preguntas.map((p, i) => (
                            <div key={i} style={styles.card}>
                                {/* HEADER DE LA TARJETA CON EL NOMBRE DEL ALUMNO */}
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', borderBottom: '1px solid #eee', paddingBottom: '5px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                        <span style={{ fontWeight: 'bold', color: '#999' }}>#{i + 1}</span>
                                        <div style={styles.studentBadge}>
                                            👤 {p.studentName || 'Anónimo'}
                                        </div>
                                    </div>
                                    <button onClick={() => borrarPregunta(i)} style={styles.iconBtnRed}><Trash2 size={16} /></button>
                                </div>

                                {/* CAMPOS DINÁMICOS */}
                                {renderCamposDinamicos(p, i)}
                            </div>
                        ))}

                        {hojaActual.preguntas.length === 0 && (
                            <div style={{ textAlign: 'center', color: '#999', padding: '40px', border: '2px dashed #ddd', borderRadius: '10px' }}>
                                <p>El buzón de esta hoja está vacío.</p>
                                <p>Dale el código <b>{hojaActual.accessCode}</b> a tus alumnos y pulsa "Comprobar Buzón".</p>
                            </div>
                        )}
                    </div>

                </div>

                {/* MODAL CONFIGURACIÓN (Solo para elegir destino) */}
                {mostrandoConfig && (
                    <div style={styles.modalOverlay}>
                        <div style={styles.modal}>
                            <h3>Configuración Question Sender</h3>
                            <div style={{ marginBottom: '20px' }}>
                                <label style={styles.label}>Título del Recurso</label>
                                <input value={datos.titulo} onChange={e => setDatos({ ...datos, titulo: e.target.value })} style={styles.input} />
                            </div>
                            <div style={{ marginBottom: '20px' }}>
                                <label style={styles.label}>Aplicación de Destino (Formato)</label>
                                <p style={{ fontSize: '12px', color: '#666' }}>¿Para qué juego servirán estas preguntas?</p>
                                <select
                                    value={datos.targetGame || 'PASAPALABRA'}
                                    onChange={e => setDatos({ ...datos, targetGame: e.target.value })}
                                    style={{ ...styles.input, fontWeight: 'bold', border: '2px solid #2196F3', color: '#1565C0' }}
                                >
                                    {JUEGOS_DESTINO.map(g => <option key={g.id} value={g.id}>{g.label}</option>)}
                                </select>
                            </div>
                            <button onClick={() => setMostrandoConfig(false)} style={styles.saveBtnFull}>Cerrar</button>
                        </div>
                    </div>
                )}
            </div>

            <style>{`.spin { animation: spin 1s linear infinite; } @keyframes spin { 100% { transform: rotate(360deg); } }`}</style>
        </div>
    );
}

// ESTILOS SIMPLIFICADOS PARA ESTE EDITOR
const styles = {
    overlay: { position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: '#f0f2f5', zIndex: 3000, display: 'flex', justifyContent: 'center' },
    container: { width: '100%', maxWidth: '900px', background: 'white', display: 'flex', flexDirection: 'column', height: '100%', boxShadow: '0 0 20px rgba(0,0,0,0.1)' },
    header: { background: '#2c3e50', padding: '15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'white' },
    subHeader: { background: '#ecf0f1', padding: '10px 15px', borderBottom: '1px solid #ddd', display: 'flex', justifyContent: 'space-between' },
    body: { padding: '20px', flex: 1, overflowY: 'auto', background: '#f8f9fa' },

    iconBtn: { background: 'transparent', border: 'none', color: 'white', cursor: 'pointer' },
    saveBtn: { background: '#27ae60', border: 'none', color: 'white', padding: '8px 20px', borderRadius: '20px', cursor: 'pointer', display: 'flex', gap: '5px', alignItems: 'center', fontWeight: 'bold' },
    refreshBtn: { background: '#e67e22', border: 'none', color: 'white', padding: '8px 15px', borderRadius: '20px', cursor: 'pointer', display: 'flex', gap: '5px', alignItems: 'center', fontSize: '12px', marginRight: '10px' },
    btnAdd: { background: 'white', border: '1px solid #27ae60', color: '#27ae60', padding: '5px 10px', borderRadius: '5px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' },
    iconBtnRed: { background: '#ffebee', border: 'none', color: '#c62828', cursor: 'pointer', padding: '5px', borderRadius: '4px' },

    select: { padding: '5px', borderRadius: '5px', border: '1px solid #ccc' },
    input: { width: '100%', padding: '8px', borderRadius: '5px', border: '1px solid #ddd', boxSizing: 'border-box' },
    label: { display: 'block', fontSize: '12px', fontWeight: 'bold', marginBottom: '5px', color: '#555' },
    labelMini: { display: 'block', fontSize: '10px', fontWeight: 'bold', color: '#7f8c8d', textTransform: 'uppercase', marginBottom: '2px' },

    codePanel: { background: 'white', padding: '15px', borderRadius: '8px', border: '1px solid #bdc3c7', display: 'flex', gap: '20px', alignItems: 'center' },
    bigCode: { fontSize: '24px', fontWeight: 'bold', color: '#2980b9', letterSpacing: '2px' },
    btnSmall: { background: '#eee', border: 'none', padding: '5px 10px', borderRadius: '15px', cursor: 'pointer', fontSize: '11px', display: 'flex', gap: '5px' },

    card: { background: 'white', padding: '15px', borderRadius: '8px', border: '1px solid #eee', boxShadow: '0 2px 5px rgba(0,0,0,0.05)' },
    studentBadge: { background: '#E3F2FD', color: '#1565C0', padding: '4px 10px', borderRadius: '15px', fontSize: '12px', fontWeight: 'bold', border: '1px solid #90CAF9' },

    grid2: { display: 'flex', gap: '10px', marginBottom: '10px' },

    modalOverlay: { position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 4000 },
    modal: { background: 'white', padding: '30px', borderRadius: '10px', width: '400px', boxShadow: '0 10px 30px rgba(0,0,0,0.2)' },
    saveBtnFull: { width: '100%', padding: '12px', background: '#2c3e50', color: 'white', border: 'none', borderRadius: '5px', marginTop: '20px', cursor: 'pointer' }
};