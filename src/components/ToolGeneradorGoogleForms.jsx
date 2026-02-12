import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { Search, FileQuestion, CheckCircle, AlertCircle, Loader, Layers, FilePlus, Copy, Settings, Star } from 'lucide-react';

export default function ToolGeneradorGoogleForms({ usuario, googleToken, onBack }) {
    const [misRecursos, setMisRecursos] = useState([]);
    const [resultados, setResultados] = useState([]);
    const [cargando, setCargando] = useState(false);

    // Estado del proceso
    const [procesandoId, setProcesandoId] = useState(null);
    const [mensaje, setMensaje] = useState(null);

    // Modal de Configuración
    const [modalConfig, setModalConfig] = useState(null);
    // Preferencia de Puntuación (true = Recurso, false = 1 punto)
    const [usarPuntosRecurso, setUsarPuntosRecurso] = useState(true);

    // Filtros
    const [busqueda, setBusqueda] = useState('');
    const [filtroApp, setFiltroApp] = useState('');

    // 1. CARGAR RECURSOS (EXCLUYENDO PRO)
    useEffect(() => {
        const cargar = async () => {
            setCargando(true);
            try {
                const q = query(collection(db, "resources"), where("profesorUid", "==", usuario.uid));
                const snap = await getDocs(q);
                // Filtramos para que NO sean PRO
                const docs = snap.docs
                    .map(d => ({ ...d.data(), id: d.id }))
                    .filter(r => r.tipo !== 'PRO' && r.tipo !== 'PRO-BURBUJAS');

                setMisRecursos(docs);
                setResultados(docs);
            } catch (e) { console.error(e); }
            setCargando(false);
        };
        if (usuario) cargar();
    }, [usuario]);

    // 2. FILTROS
    useEffect(() => {
        let f = misRecursos;
        if (busqueda) f = f.filter(r => r.titulo.toLowerCase().includes(busqueda.toLowerCase()));
        if (filtroApp) f = f.filter(r => r.tipoJuego === filtroApp);
        setResultados(f);
    }, [busqueda, filtroApp, misRecursos]);

    // ==============================================================================
    //  LÓGICA CORE: CREAR FORMULARIO EN GOOGLE
    // ==============================================================================

    const crearFormulario = async (tituloForm, preguntas, configPuntos, shufflePreguntas) => {
        // 1. CREAR EL FORMULARIO VACÍO
        const createRes = await fetch('https://forms.googleapis.com/v1/forms', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${googleToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ info: { title: tituloForm } })
        });

        if (!createRes.ok) throw new Error("Error creando Form (Verifica permisos)");
        const formData = await createRes.json();
        const formId = formData.formId;

        // 2. PREPARAR LAS PREGUNTAS (BATCH UPDATE)
        const requests = [];

        // A) CONFIGURACIÓN DEL CUESTIONARIO
        requests.push({
            updateSettings: {
                settings: {
                    quizSettings: { isQuiz: true } // Activa modo examen
                },
                updateMask: 'quizSettings.isQuiz'
            }
        });

        // B) Barajar PREGUNTAS (El orden en que aparecen)
        let preguntasProcesar = [...preguntas];
        if (shufflePreguntas) {
            preguntasProcesar.sort(() => Math.random() - 0.5);
        }

        // C) Generar Items (Preguntas)
        preguntasProcesar.forEach((p, index) => {
            let questionItem = {};
            const puntos = parseInt(configPuntos) || 1;

            // --- PROTECCIÓN CONTRA DATOS VACÍOS ---
            const cleanStr = (val) => (val === null || val === undefined || String(val).trim() === '') ? "" : String(val).trim();

            let respuestaCorrecta = cleanStr(p.respuesta || p.correcta || p.a || p.textoB);
            let tituloPregunta = cleanStr(p.pregunta || p.textoA || (p.letra ? `Empieza/Contiene ${p.letra}: ${p.pregunta}` : ""));

            if (!tituloPregunta) tituloPregunta = `Pregunta ${index + 1}`;
            if (!respuestaCorrecta) respuestaCorrecta = "REVISAR_RESPUESTA_VACIA";

            // --- DETECCIÓN INTELIGENTE DE TIPO ---
            const incorrectasReales = (p.incorrectas || [])
                .map(inc => cleanStr(inc))
                .filter(inc => inc !== "");

            const esRespuestaCorta =
                p.tipoJuego === 'PASAPALABRA' ||
                p.tipoJuego === 'APAREJADOS' ||
                incorrectasReales.length === 0;

            // CASO A: RESPUESTA CORTA (TEXTO)
            if (esRespuestaCorta) {
                questionItem = {
                    question: {
                        required: true,
                        grading: {
                            pointValue: puntos,
                            correctAnswers: { answers: [{ value: respuestaCorrecta }] }
                        },
                        textQuestion: {}
                    }
                };
            }
            // CASO B: SELECCIÓN MÚLTIPLE (RADIO)
            else {
                const opcionesUnicas = new Set();
                const opcionesFinales = [];

                // 1. Añadimos CORRECTA
                opcionesUnicas.add(respuestaCorrecta);
                opcionesFinales.push({ value: respuestaCorrecta });

                // 2. Añadimos INCORRECTAS
                incorrectasReales.forEach(inc => {
                    if (!opcionesUnicas.has(inc)) {
                        opcionesUnicas.add(inc);
                        opcionesFinales.push({ value: inc });
                    }
                });

                // 3. Barajamos las opciones
                opcionesFinales.sort(() => Math.random() - 0.5);

                questionItem = {
                    question: {
                        required: true,
                        grading: {
                            pointValue: puntos,
                            correctAnswers: {
                                answers: [{ value: respuestaCorrecta }]
                            }
                        },
                        choiceQuestion: {
                            type: 'RADIO',
                            options: opcionesFinales,
                            shuffle: true
                        }
                    }
                };
            }

            // Push a la cola de peticiones
            requests.push({
                createItem: {
                    item: {
                        title: tituloPregunta,
                        questionItem: questionItem
                    },
                    location: { index: index }
                }
            });
        });

        // 3. ENVIAR BATCH UPDATE
        if (requests.length > 0) {
            const res = await fetch(`https://forms.googleapis.com/v1/forms/${formId}:batchUpdate`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${googleToken}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ requests })
            });

            if (!res.ok) {
                const errData = await res.json();
                console.error("Detalle Error Google Forms:", errData);
                throw new Error(`Error ${res.status}: ${errData.error?.message || "Datos inválidos"}`);
            }
        }

        return `https://docs.google.com/forms/d/${formId}/edit`;
    };

    // ==============================================================================
    //  GESTOR DE CREACIÓN
    // ==============================================================================

    const ejecutarCreacion = async (modo, indexHoja = null) => {
        if (!modalConfig) return;
        const r = modalConfig.recurso;
        setProcesandoId(r.id);
        setModalConfig(null);
        setMensaje({ tipo: 'info', texto: 'Generando formulario(s), por favor espera...' });

        try {
            // 1. DETERMINAR PUNTOS
            let puntos = 1;
            if (usarPuntosRecurso) {
                if (r.tipoJuego === 'PASAPALABRA') puntos = 1;
                if (r.tipoJuego === 'CAZABURBUJAS') puntos = parseInt(r.config?.puntosAcierto) || 1;
                if (r.tipoJuego === 'APAREJADOS') puntos = parseInt(r.config?.puntosPareja) || 1;
                if (r.tipoJuego === 'THINKHOOT') puntos = parseInt(r.config?.puntosMax) || 1;
            } else {
                puntos = 1;
            }

            const shuffle = true;

            // 2. Preparar datos
            const hojas = r.hojas || [];
            let formsCreados = 0;

            // A) TODO JUNTO (NOMBRE = RECURSO)
            if (modo === 'TODAS') {
                let pool = [];
                hojas.forEach(h => {
                    const preguntasHoja = (h.preguntas || []).map(p => ({ ...p, tipoJuego: r.tipoJuego }));
                    pool = [...pool, ...preguntasHoja];
                });
                if (pool.length > 0) {
                    // --- CAMBIO AQUI: Nombre del recurso tal cual ---
                    await crearFormulario(r.titulo, pool, puntos, shuffle);
                    formsCreados = 1;
                } else {
                    throw new Error("El recurso no tiene preguntas.");
                }
            }
            // B) UNA HOJA (NOMBRE = RECURSO - HOJA)
            else if (modo === 'UNA' && indexHoja !== null) {
                const h = hojas[indexHoja];
                const preguntas = (h.preguntas || []).map(p => ({ ...p, tipoJuego: r.tipoJuego }));
                if (preguntas.length > 0) {
                    // --- CAMBIO AQUI: Recurso + Hoja ---
                    await crearFormulario(`${r.titulo} - ${h.nombreHoja}`, preguntas, puntos, shuffle);
                    formsCreados = 1;
                }
            }
            // C) SEPARADAS (NOMBRE = RECURSO - HOJA)
            else if (modo === 'SEPARADAS') {
                for (const h of hojas) {
                    const preguntas = (h.preguntas || []).map(p => ({ ...p, tipoJuego: r.tipoJuego }));
                    if (preguntas.length > 0) {
                        // --- CAMBIO AQUI: Recurso + Hoja ---
                        await crearFormulario(`${r.titulo} - ${h.nombreHoja}`, preguntas, puntos, shuffle);
                        formsCreados++;
                    }
                }
            }

            setMensaje({ tipo: 'exito', texto: `¡Éxito! Se han creado ${formsCreados} formulario(s) en tu Drive.` });

        } catch (error) {
            console.error(error);
            setMensaje({ tipo: 'error', texto: "Error: " + error.message });
        }
        setProcesandoId(null);
    };

    // ==============================================================================
    //  RENDER
    // ==============================================================================
    return (
        <div style={{ padding: '20px', background: 'white', borderRadius: '15px', minHeight: '80vh' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px', borderBottom: '1px solid #eee', paddingBottom: '15px' }}>
                <h2 style={{ color: '#673AB7', margin: 0, display: 'flex', gap: '10px' }}>
                    <FileQuestion size={28} /> Generador de Exámenes (Google Forms)
                </h2>
                <button onClick={onBack} style={{ background: '#95a5a6', color: 'white', border: 'none', padding: '8px 15px', borderRadius: '8px', cursor: 'pointer' }}>Volver</button>
            </div>

            {/* Mensajes */}
            {mensaje && (
                <div style={{ padding: '15px', borderRadius: '10px', marginBottom: '20px', background: mensaje.tipo === 'exito' ? '#d1c4e9' : (mensaje.tipo === 'error' ? '#ffcdd2' : '#e3f2fd'), color: mensaje.tipo === 'error' ? '#c62828' : '#4527a0', display: 'flex', gap: '10px', alignItems: 'center' }}>
                    {mensaje.tipo === 'exito' ? <CheckCircle size={20} /> : <AlertCircle size={20} />} {mensaje.texto}
                </div>
            )}

            {/* Filtros */}
            <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
                <input placeholder="Buscar..." value={busqueda} onChange={e => setBusqueda(e.target.value)} style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid #ddd' }} />
                <select value={filtroApp} onChange={e => setFiltroApp(e.target.value)} style={{ padding: '10px', borderRadius: '8px', border: '1px solid #ddd' }}>
                    <option value="">Todos los Tipos</option>
                    <option value="PASAPALABRA">Pasapalabra</option>
                    <option value="CAZABURBUJAS">CazaBurbujas / Pikatron</option>
                    <option value="THINKHOOT">Pi-Live</option>
                    <option value="APAREJADOS">AparejaDOS</option>
                </select>
            </div>

            {/* Lista */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '15px' }}>
                {resultados.map(r => (
                    <div key={r.id} style={{ border: '1px solid #eee', borderRadius: '10px', padding: '15px', boxShadow: '0 2px 5px rgba(0,0,0,0.05)' }}>
                        <div style={{ fontSize: '0.8rem', color: '#999', fontWeight: 'bold' }}>{r.tipoJuego}</div>
                        <h3 style={{ margin: '5px 0 10px 0', fontSize: '1.1rem' }}>{r.titulo}</h3>
                        <p style={{ fontSize: '0.9rem', color: '#666' }}>{r.hojas?.length || 1} niveles/hojas</p>

                        <button
                            onClick={() => { setModalConfig({ recurso: r }); setUsarPuntosRecurso(true); }}
                            disabled={procesandoId !== null}
                            style={{ width: '100%', padding: '10px', background: procesandoId === r.id ? '#ccc' : '#673AB7', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', display: 'flex', justifyContent: 'center', gap: '8px' }}
                        >
                            {procesandoId === r.id ? <Loader className="spin" size={18} /> : <FileQuestion size={18} />}
                            Generar Formulario
                        </button>
                    </div>
                ))}
            </div>

            {/* MODAL DE SELECCIÓN DE ALCANCE Y PUNTOS */}
            {modalConfig && (
                <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 2000 }}>
                    <div style={{ background: 'white', padding: '25px', borderRadius: '15px', width: '90%', maxWidth: '400px' }}>
                        <h3 style={{ marginTop: 0, color: '#2c3e50' }}>Configurar Examen</h3>
                        <p style={{ color: '#666' }}>Recurso: <b>{modalConfig.recurso.titulo}</b></p>

                        {/* SECCIÓN DE PUNTUACIÓN */}
                        <div style={{ background: '#f3e5f5', padding: '15px', borderRadius: '10px', marginBottom: '20px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px', color: '#7b1fa2', fontWeight: 'bold' }}>
                                <Star size={18} /> Puntuación
                            </div>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px', cursor: 'pointer' }}>
                                <input
                                    type="radio"
                                    name="puntos"
                                    checked={usarPuntosRecurso === true}
                                    onChange={() => setUsarPuntosRecurso(true)}
                                />
                                <span>Usar puntuación del juego (Ej: {
                                    (modalConfig.recurso.tipoJuego === 'CAZABURBUJAS' ? modalConfig.recurso.config?.puntosAcierto :
                                        modalConfig.recurso.tipoJuego === 'APAREJADOS' ? modalConfig.recurso.config?.puntosPareja : '1') || 1
                                } pts)</span>
                            </label>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                                <input
                                    type="radio"
                                    name="puntos"
                                    checked={usarPuntosRecurso === false}
                                    onChange={() => setUsarPuntosRecurso(false)}
                                />
                                <span>Que todas valgan 1 punto</span>
                            </label>
                        </div>

                        {/* SECCIÓN DE HOJAS */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            <p style={{ margin: '0 0 5px 0', fontWeight: 'bold', color: '#333' }}>¿Qué quieres exportar?</p>

                            <button onClick={() => ejecutarCreacion('TODAS')} style={btnOptionStyle}>
                                <Layers size={20} /> Todas las hojas en 1 Formulario
                            </button>

                            <button onClick={() => ejecutarCreacion('SEPARADAS')} style={btnOptionStyle}>
                                <Copy size={20} /> Un Formulario por cada hoja
                            </button>

                            <p style={{ margin: '10px 0 5px 0', fontSize: '0.9rem', color: '#666' }}>O elige una específica:</p>
                            <div style={{ maxHeight: '150px', overflowY: 'auto', border: '1px solid #eee', borderRadius: '8px' }}>
                                {modalConfig.recurso.hojas.map((h, i) => (
                                    <button key={i} onClick={() => ejecutarCreacion('UNA', i)} style={{ ...btnOptionStyle, borderRadius: 0, borderBottom: '1px solid #eee', textAlign: 'left', background: 'white' }}>
                                        📄 {h.nombreHoja}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <button onClick={() => setModalConfig(null)} style={{ marginTop: '20px', width: '100%', padding: '10px', border: 'none', background: 'transparent', color: '#666', cursor: 'pointer' }}>Cancelar</button>
                    </div>
                </div>
            )}

            <style>{`.spin { animation: spin 1s linear infinite; } @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
        </div>
    );
}

const btnOptionStyle = { padding: '12px', background: '#f5f5f5', border: 'none', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.95rem', color: '#333', transition: 'background 0.2s' };