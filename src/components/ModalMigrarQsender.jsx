import React, { useState, useEffect } from 'react';
import { X, FilePlus, CopyPlus, ArrowRight, Save, Layers } from 'lucide-react';
import { collection, query, where, getDocs, doc, addDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase'; // Ajusta la ruta si es necesario

// Función helper para generar códigos de 4 o 5 letras si creamos un recurso nuevo
const generarCodigoAcceso = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let result = '';
    for (let i = 0; i < 5; i++) result += chars.charAt(Math.floor(Math.random() * chars.length));
    return result;
};

export default function ModalMigrarQsender({ qsRecurso, usuario, onClose, onMigrateSuccess }) {
    const [fase, setFase] = useState(1);
    const [cargando, setCargando] = useState(false);

    // Origen
    const [hojaOrigen, setHojaOrigen] = useState('ALL');

    // Destino
    const [recursosExistentes, setRecursosExistentes] = useState([]);
    const [recursoDestinoId, setRecursoDestinoId] = useState('');
    const [hojaDestino, setHojaDestino] = useState('NEW');

    const tieneVariasHojas = qsRecurso.hojas && qsRecurso.hojas.length > 1;

    // --- LÓGICA DE TRANSFORMACIÓN (Inyectada desde tu código) ---
    const transformarPreguntas = (preguntas, appDestino) => {
        return preguntas.map(p => {
            // CASO A: PASAPALABRA
            if (appDestino === 'PASAPALABRA') {
                return {
                    letra: p.letra || 'A',
                    pregunta: p.pregunta || '',
                    respuesta: p.respuesta || ''
                };
            }
            // CASO B: APAREJADOS
            else if (appDestino === 'APAREJADOS') {
                return {
                    terminoA: p.pregunta || '',
                    terminoB: p.respuesta || ''
                };
            }
            // CASO C: RESTO (Test, Burbujas, Ruleta, etc.)
            else {
                return {
                    pregunta: p.pregunta || '',
                    correcta: p.respuesta || '',
                    respuesta: p.respuesta || '',
                    incorrectas: Array.isArray(p.incorrectas)
                        ? p.incorrectas
                        : [p.incorrecta1, p.incorrecta2, p.incorrecta3].filter(Boolean)
                };
            }
            // Nota: Al crear objetos nuevos, limpiamos datos extra como el nombre del alumno que lo envió.
        });
    };

    // --- ACCIÓN 1: CREAR NUEVO RECURSO ---
    const handleCrearNuevo = async () => {
        setCargando(true);
        try {
            const appDestino = qsRecurso.targetGame || 'PASAPALABRA';

            // 1. Seleccionar hojas de origen
            let hojasSeleccionadas = hojaOrigen === 'ALL' ? qsRecurso.hojas : [qsRecurso.hojas[hojaOrigen]];

            // 2. Aplicar la transformación de formato
            const hojasTransformadas = hojasSeleccionadas.map(h => ({
                nombreHoja: h.nombreHoja,
                preguntas: transformarPreguntas(h.preguntas || [], appDestino)
            }));

            // 3. Crear en Firebase
            const nuevoDoc = {
                titulo: `[IMPORTADO] ${qsRecurso.titulo}`,
                temas: qsRecurso.temas || '',
                tipoJuego: appDestino,
                profesorUid: usuario.uid,
                profesorNombre: usuario.displayName || 'Profesor',
                fechaCreacion: new Date().toISOString(), // O new Date() según uses en tu BD
                hojas: hojasTransformadas,
                config: { numPreguntas: 10 }, // Puedes ajustar esto si necesitas la config por defecto
                isPrivate: true,
                origen: 'question_sender',
                playCount: 0,
                accessCode: generarCodigoAcceso()
            };

            await addDoc(collection(db, 'resources'), nuevoDoc);
            onMigrateSuccess("¡Nuevo recurso creado con éxito y preguntas adaptadas!");
        } catch (e) {
            console.error(e);
            alert("Error al crear el nuevo recurso: " + e.message);
        }
        setCargando(false);
    };

    // --- BUSCAR RECURSOS EXISTENTES ---
    const handleIrAExistente = async () => {
        setCargando(true);
        try {
            const appDestino = qsRecurso.targetGame;
            const q = query(
                collection(db, 'resources'),
                where('profesorUid', '==', usuario.uid),
                where('tipoJuego', '==', appDestino)
            );
            const snap = await getDocs(q);
            const res = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            setRecursosExistentes(res);
            setFase(2);
        } catch (e) {
            console.error(e);
            alert("Error al cargar tus recursos.");
        }
        setCargando(false);
    };

    // --- ACCIÓN 2: AÑADIR A RECURSO EXISTENTE ---
    const handleConfirmarIntegracion = async () => {
        if (!recursoDestinoId) return alert("Selecciona un recurso de destino.");
        setCargando(true);

        try {
            const appDestino = qsRecurso.targetGame;
            const targetRecurso = recursosExistentes.find(r => r.id === recursoDestinoId);
            const targetRef = doc(db, 'resources', recursoDestinoId);
            const nuevasHojas = targetRecurso.hojas ? [...targetRecurso.hojas] : [];

            // 1. Recopilamos y transformamos las hojas de origen
            let hojasSeleccionadas = hojaOrigen === 'ALL' ? qsRecurso.hojas : [qsRecurso.hojas[hojaOrigen]];

            const hojasAInsertar = hojasSeleccionadas.map(h => ({
                nombreHoja: `${h.nombreHoja} (Q-Sender)`,
                preguntas: transformarPreguntas(h.preguntas || [], appDestino)
            }));

            // 2. Insertamos según lo que eligió el profe
            if (hojaDestino === 'NEW') {
                // Crear nuevas hojas al final del recurso
                hojasAInsertar.forEach(h => nuevasHojas.push(h));
            } else {
                // Añadir todas las preguntas transformadas al final de la hoja seleccionada
                let preguntasExtra = [];
                hojasAInsertar.forEach(h => preguntasExtra.push(...h.preguntas));

                if (!nuevasHojas[hojaDestino]) {
                    nuevasHojas[hojaDestino] = { nombreHoja: 'Hoja 1', preguntas: [] };
                }

                nuevasHojas[hojaDestino].preguntas.push(...preguntasExtra);
            }

            // 3. Guardamos en Firebase
            await updateDoc(targetRef, { hojas: nuevasHojas });
            onMigrateSuccess("¡Preguntas añadidas y adaptadas con éxito al recurso!");

        } catch (e) {
            console.error(e);
            alert("Error al actualizar el recurso: " + e.message);
        }
        setCargando(false);
    };

    const recursoSeleccionadoObj = recursosExistentes.find(r => r.id === recursoDestinoId);

    return (
        <div style={styles.overlay}>
            <div style={styles.modal}>
                <div style={styles.header}>
                    <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <ArrowRight size={20} /> Migrar Preguntas
                    </h3>
                    <button onClick={onClose} style={styles.closeBtn}><X size={20} /></button>
                </div>

                <div style={styles.body}>
                    <p style={{ color: '#666', marginBottom: '20px' }}>
                        Migrando datos de: <b>{qsRecurso.titulo}</b> <br />
                        Hacia el formato: <span style={{ color: '#3498db', fontWeight: 'bold' }}>{qsRecurso.targetGame}</span>
                    </p>

                    {fase === 1 && (
                        <div style={{ animation: 'fadeIn 0.3s' }}>
                            {tieneVariasHojas && (
                                <div style={{ background: '#f8f9fa', padding: '15px', borderRadius: '10px', marginBottom: '25px', border: '1px solid #ddd' }}>
                                    <label style={styles.label}><Layers size={16} /> ¿Qué quieres migrar?</label>
                                    <select value={hojaOrigen} onChange={e => setHojaOrigen(e.target.value)} style={styles.select}>
                                        <option value="ALL">📦 Todas las hojas ({qsRecurso.hojas.length})</option>
                                        {qsRecurso.hojas.map((h, i) => (
                                            <option key={i} value={i}>📄 Solo: {h.nombreHoja} ({h.preguntas.length} preg.)</option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            <label style={styles.label}>¿Qué deseas hacer con estas preguntas?</label>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                                <button onClick={handleCrearNuevo} disabled={cargando} style={styles.btnCard}>
                                    <FilePlus size={32} color="#2ecc71" style={{ marginBottom: '10px' }} />
                                    <h4 style={{ margin: '0 0 5px 0', color: '#2c3e50' }}>Crear Nuevo</h4>
                                    <p style={{ margin: 0, fontSize: '0.8rem', color: '#7f8c8d' }}>Se creará un recurso desde cero adaptado al juego.</p>
                                </button>

                                <button onClick={handleIrAExistente} disabled={cargando} style={styles.btnCard}>
                                    <CopyPlus size={32} color="#3498db" style={{ marginBottom: '10px' }} />
                                    <h4 style={{ margin: '0 0 5px 0', color: '#2c3e50' }}>Añadir a Existente</h4>
                                    <p style={{ margin: 0, fontSize: '0.8rem', color: '#7f8c8d' }}>Inserta las preguntas en un juego que ya tienes.</p>
                                </button>
                            </div>
                        </div>
                    )}

                    {fase === 2 && (
                        <div style={{ animation: 'fadeIn 0.3s' }}>
                            <div style={{ background: '#e3f2fd', padding: '15px', borderRadius: '10px', marginBottom: '20px', border: '1px solid #90caf9' }}>

                                <label style={styles.label}>1. Elige a qué recurso enviarlo:</label>
                                <select value={recursoDestinoId} onChange={e => setRecursoDestinoId(e.target.value)} style={{ ...styles.select, marginBottom: '15px' }}>
                                    <option value="">-- Selecciona un juego tuyo --</option>
                                    {recursosExistentes.map(r => (
                                        <option key={r.id} value={r.id}>{r.titulo} ({(r.hojas || []).length} hojas)</option>
                                    ))}
                                </select>

                                {recursoDestinoId && recursoSeleccionadoObj && (
                                    <>
                                        <label style={styles.label}>2. ¿En qué hoja de destino?</label>
                                        <select value={hojaDestino} onChange={e => setHojaDestino(e.target.value)} style={styles.select}>
                                            <option value="NEW" style={{ fontWeight: 'bold', color: '#27ae60' }}>➕ Añadir como nueva hoja</option>
                                            {recursoSeleccionadoObj.hojas && recursoSeleccionadoObj.hojas.map((h, i) => (
                                                <option key={i} value={i}>⬇️ Añadir al final de: {h.nombreHoja}</option>
                                            ))}
                                        </select>
                                    </>
                                )}
                            </div>

                            <div style={{ display: 'flex', gap: '10px' }}>
                                <button onClick={() => setFase(1)} style={styles.btnSecondary} disabled={cargando}>Volver</button>
                                <button onClick={handleConfirmarIntegracion} style={styles.btnPrimary} disabled={cargando || !recursoDestinoId}>
                                    {cargando ? 'Guardando...' : 'Confirmar e Integrar'} <Save size={16} />
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

const styles = {
    overlay: { position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 5000 },
    modal: { background: 'white', borderRadius: '15px', width: '90%', maxWidth: '500px', overflow: 'hidden', boxShadow: '0 20px 50px rgba(0,0,0,0.3)' },
    header: { background: '#2c3e50', padding: '15px 20px', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
    closeBtn: { background: 'transparent', border: 'none', color: 'white', cursor: 'pointer' },
    body: { padding: '25px' },
    label: { display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.9rem', fontWeight: 'bold', color: '#333', marginBottom: '8px' },
    select: { width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #ccc', fontSize: '1rem', outline: 'none' },
    btnCard: { background: 'white', border: '2px solid #ddd', borderRadius: '12px', padding: '20px', cursor: 'pointer', textAlign: 'center', transition: 'all 0.2s', outline: 'none' },
    btnSecondary: { padding: '12px', background: '#f0f0f0', color: '#555', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', flex: 1 },
    btnPrimary: { padding: '12px', background: '#3498db', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', flex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }
};