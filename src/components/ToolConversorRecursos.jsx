import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, where, getDocs, addDoc } from 'firebase/firestore';
import { RefreshCw, FileText, CheckCircle, AlertTriangle, ArrowRight, Loader } from 'lucide-react';

const TARGET_APPS = [
    { id: 'PASAPALABRA', name: 'Pasapalabra (Letra, Pregunta, Respuesta)' },
    // Añadimos el flag "hasPro" para saber si hay que mostrar el selector doble
    { id: 'CAZABURBUJAS', name: 'Burbujas / Pikatron (Test Múltiple)', hasPro: true },
    { id: 'THINKHOOT', name: 'PiLive (Test Múltiple / Kahoot)', hasPro: true },
    { id: 'APAREJADOS', name: 'AparejaDOS (Término A y B)' },
    { id: 'RULETA', name: 'La Ruleta (Pregunta, Respuesta)' },
    { id: 'WORDLE', name: 'Wordle / Sopa de Letras (Solo palabras)' }
];

export default function ToolConversorRecursos({ usuario, onBack }) {
    const [misRecursos, setMisRecursos] = useState([]);
    const [cargando, setCargando] = useState(false);
    const [busqueda, setBusqueda] = useState('');

    // Estados del conversor
    const [recursoOrigen, setRecursoOrigen] = useState(null);
    const [appDestino, setAppDestino] = useState('');
    const [modoDestino, setModoDestino] = useState('PRO'); // 'PRO' o 'CLASICO'
    const [procesando, setProcesando] = useState(false);
    const [mensaje, setMensaje] = useState(null);

    useEffect(() => {
        const cargar = async () => {
            setCargando(true);
            try {
                const q = query(collection(db, "resources"), where("profesorUid", "==", usuario.uid));
                const snap = await getDocs(q);

                const docs = snap.docs
                    .map(d => ({ ...d.data(), id: d.id }))
                    // --- CORRECCIÓN: Filtramos WORDLE, SOPA y QUESTION_SENDER ---
                    .filter(r => r.tipoJuego !== 'WORDLE' && r.tipoJuego !== 'SOPA' && r.tipoJuego !== 'QUESTION_SENDER');
                setMisRecursos(docs);
            } catch (e) { console.error(e); }
            setCargando(false);
        };
        if (usuario) cargar();
    }, [usuario]);

    const generarCodigoAcceso = () => {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let res = '';
        for (let i = 0; i < 5; i++) res += chars.charAt(Math.floor(Math.random() * chars.length));
        return res;
    };

    // Función para poner nombres bonitos en la lista (evitar que ponga Thinkhoot)
    const getNombreJuegoBonito = (id) => {
        if (id === 'THINKHOOT') return 'PiLive';
        if (id === 'CAZABURBUJAS') return 'Burbujas / Pikatron';
        return id;
    };

    const ejecutarConversion = async () => {
        if (!recursoOrigen || !appDestino) return;
        setProcesando(true);
        setMensaje(null);

        try {
            const r = recursoOrigen;
            let nuevasHojas = [];

            // RECORREMOS LAS HOJAS ORIGINALES
            r.hojas.forEach(hoja => {
                let preguntasHoja = [];
                let palabrasHoja = [];

                // Extraemos todas las respuestas de esta hoja por si necesitamos generar opciones incorrectas
                const todasLasRespuestas = (hoja.preguntas || [])
                    .map(p => p.respuesta || p.correcta || p.terminoB)
                    .filter(Boolean);

                (hoja.preguntas || []).forEach(p => {
                    // --- IGNORAR PREGUNTAS ESPECIALES ---
                    const tiposIgnorados = ['ORDENAR', 'PRESENTATION', 'DIBUJO', 'RELLENAR', 'MATH'];
                    if (p.tipo && tiposIgnorados.includes(p.tipo)) return;

                    const pregStr = String(p.pregunta || p.terminoA || '').trim();
                    const respStr = String(p.respuesta || p.correcta || p.terminoB || '').trim();

                    if (!pregStr && !respStr) return;

                    // Mapeo hacia PASAPALABRA (Inicial, Pregunta, Respuesta)
                    if (appDestino === 'PASAPALABRA') {
                        let letraInicial = 'A';
                        if (respStr && /^[a-zA-ZñÑ]/.test(respStr)) {
                            letraInicial = respStr.charAt(0).toUpperCase();
                        }
                        preguntasHoja.push({ letra: letraInicial, pregunta: pregStr, respuesta: respStr });
                    }

                    // Mapeo hacia OPCIÓN MÚLTIPLE (Burbujas / PiLive)
                    else if (appDestino === 'CAZABURBUJAS' || appDestino === 'THINKHOOT') {
                        let incorrectas = p.incorrectas || [];
                        if (incorrectas.length === 0) {
                            incorrectas = todasLasRespuestas
                                .filter(res => res !== respStr)
                                .sort(() => 0.5 - Math.random())
                                .slice(0, 3);
                            while (incorrectas.length < 3) incorrectas.push(`Falsa ${incorrectas.length + 1}`);
                        }
                        preguntasHoja.push({ pregunta: pregStr, correcta: respStr, respuesta: respStr, incorrectas: incorrectas.slice(0, 3) });
                    }

                    // Mapeo hacia APAREJADOS (Termino A y B)
                    else if (appDestino === 'APAREJADOS') {
                        preguntasHoja.push({ terminoA: pregStr, terminoB: respStr });
                    }

                    // Mapeo hacia RULETA
                    else if (appDestino === 'RULETA') {
                        preguntasHoja.push({ pregunta: pregStr, respuesta: respStr });
                    }

                    // Mapeo hacia WORDLE / SOPA DE LETRAS (Solo extraer palabras válidas)
                    else if (appDestino === 'WORDLE') {
                        if (respStr) {
                            const limpia = respStr.toUpperCase();
                            const isNumber = !isNaN(limpia);
                            const isLink = limpia.startsWith('HTTP') || limpia.includes('WWW');
                            const isWord = /^[A-ZÑÁÉÍÓÚ ]+$/.test(limpia);

                            if (!isNumber && !isLink && isWord && limpia.length >= 4) {
                                palabrasHoja.push(limpia.split(' ')[0]);
                            }
                        }
                    }
                });

                if (appDestino === 'WORDLE' && palabrasHoja.length > 0) {
                    nuevasHojas.push({ nombreHoja: hoja.nombreHoja, palabras: Array.from(new Set(palabrasHoja)) });
                } else if (appDestino !== 'WORDLE' && preguntasHoja.length > 0) {
                    nuevasHojas.push({ nombreHoja: hoja.nombreHoja, preguntas: preguntasHoja });
                }
            });

            if (nuevasHojas.length === 0) throw new Error("No se han podido extraer datos compatibles para este tipo de juego.");

            // --- CORRECCIÓN: ASIGNAR EL TIPO CORRECTO SEGÚN EL SELECTOR PRO/CLÁSICO ---
            let tipoAppFinal = 'CLASICO';
            if (appDestino === 'WORDLE') {
                tipoAppFinal = 'PRO';
            } else if (appDestino === 'CAZABURBUJAS') {
                tipoAppFinal = modoDestino === 'PRO' ? 'PRO-BURBUJAS' : 'CLASICO';
            } else if (appDestino === 'THINKHOOT') {
                tipoAppFinal = modoDestino === 'PRO' ? 'PRO' : 'CLASICO';
            }

            const nuevoRecurso = {
                titulo: `[Convertido] ${r.titulo}`,
                temas: r.temas || '',
                profesorUid: usuario.uid,
                profesorNombre: usuario.displayName,
                pais: r.pais || '', region: r.region || '', poblacion: r.poblacion || '', ciclo: r.ciclo || '',
                tipoJuego: appDestino,
                tipo: tipoAppFinal,
                hojas: nuevasHojas,
                isPrivate: true,
                playCount: 0,
                fechaCreacion: new Date(),
                accessCode: generarCodigoAcceso(),
                config: {}
            };

            await addDoc(collection(db, "resources"), nuevoRecurso);
            setMensaje({ tipo: 'exito', texto: `¡Convertido a ${TARGET_APPS.find(a => a.id === appDestino).name} con éxito!` });

            setTimeout(() => {
                setRecursoOrigen(null);
                setAppDestino('');
                setMensaje(null);
            }, 3000);

        } catch (error) {
            setMensaje({ tipo: 'error', texto: error.message });
        }
        setProcesando(false);
    };

    const recursosFiltrados = misRecursos.filter(r => r.titulo.toLowerCase().includes(busqueda.toLowerCase()));

    return (
        <div style={{ padding: '20px', background: 'white', borderRadius: '15px', minHeight: '80vh', boxShadow: '0 4px 15px rgba(0,0,0,0.05)' }}>
            {/* Cabecera */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px', borderBottom: '1px solid #eee', paddingBottom: '15px' }}>
                <h2 style={{ color: '#E65100', margin: 0, display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <RefreshCw size={28} /> Conversor Mágico de Recursos
                </h2>
                <button onClick={onBack} style={{ background: '#95a5a6', color: 'white', border: 'none', padding: '8px 15px', borderRadius: '8px', cursor: 'pointer' }}>Volver</button>
            </div>

            {/* Alerta de Configuración */}
            <div style={{ background: '#FFF3E0', borderLeft: '5px solid #FF9800', padding: '15px', borderRadius: '5px', marginBottom: '25px', display: 'flex', gap: '10px', color: '#E65100' }}>
                <AlertTriangle size={24} />
                <p style={{ margin: 0, fontSize: '0.95rem' }}>
                    <b>Nota importante:</b> La conversión adapta las preguntas y respuestas. Sin embargo, <b>la configuración de tiempos o puntos no se copia</b>. Tras convertir, ve a tus recursos, abre el nuevo juego y <b>revisa manualmente la configuración</b> antes de usarlo con los alumnos.
                </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '30px' }}>

                {/* COLUMNA 1: SELECCIONAR ORIGEN */}
                <div style={{ background: '#f9f9f9', padding: '20px', borderRadius: '15px', border: '1px solid #eee' }}>
                    <h3 style={{ marginTop: 0, color: '#2c3e50', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={badgeStep}>1</span> Elige el Recurso Original
                    </h3>

                    {!recursoOrigen ? (
                        <>
                            <input
                                placeholder="Buscar recurso..."
                                value={busqueda}
                                onChange={e => setBusqueda(e.target.value)}
                                style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #ccc', boxSizing: 'border-box', marginBottom: '15px' }}
                            />
                            {cargando ? <div style={{ textAlign: 'center', padding: '20px' }}><Loader className="spin" /></div> : (
                                <div style={{ maxHeight: '350px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                    {recursosFiltrados.map(r => (
                                        <div key={r.id} onClick={() => setRecursoOrigen(r)} style={{ padding: '12px', background: 'white', borderRadius: '8px', border: '1px solid #ddd', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <div>
                                                <div style={{ fontWeight: 'bold', color: '#333' }}>{r.titulo}</div>
                                                <div style={{ fontSize: '0.8rem', color: '#888' }}>Tipo: {getNombreJuegoBonito(r.tipoJuego)} {r.tipo ? `(${r.tipo})` : ''}</div>
                                            </div>
                                            <ArrowRight size={18} color="#999" />
                                        </div>
                                    ))}
                                </div>
                            )}
                        </>
                    ) : (
                            <div style={{ padding: '15px', background: '#E8F5E9', border: '2px solid #4CAF50', borderRadius: '10px', textAlign: 'center' }}>
                                <FileText size={40} color="#4CAF50" style={{ marginBottom: '10px' }} />
                                <h3 style={{ margin: '0 0 5px 0', color: '#2E7D32' }}>{recursoOrigen.titulo}</h3>
                                <p style={{ margin: 0, color: '#666', fontSize: '0.9rem' }}>Formato actual: {getNombreJuegoBonito(recursoOrigen.tipoJuego)}</p>
                                <button onClick={() => setRecursoOrigen(null)} style={{ background: 'transparent', border: 'none', color: '#d32f2f', marginTop: '15px', cursor: 'pointer', textDecoration: 'underline' }}>Cambiar recurso</button>
                            </div>
                        )}
                </div>

                {/* COLUMNA 2: SELECCIONAR DESTINO Y CONVERTIR */}
                <div style={{ background: '#f9f9f9', padding: '20px', borderRadius: '15px', border: '1px solid #eee', opacity: recursoOrigen ? 1 : 0.5, pointerEvents: recursoOrigen ? 'auto' : 'none', transition: 'all 0.3s' }}>
                    <h3 style={{ marginTop: 0, color: '#2c3e50', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={badgeStep}>2</span> Convertir A...
                    </h3>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '15px' }}>
                        {TARGET_APPS.map(app => {
                            if (recursoOrigen?.tipoJuego === app.id) return null;
                            return (
                                <label key={app.id} style={{ padding: '12px', background: appDestino === app.id ? '#FFF3E0' : 'white', border: `2px solid ${appDestino === app.id ? '#FF9800' : '#ddd'}`, borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <input
                                        type="radio"
                                        name="targetApp"
                                        checked={appDestino === app.id}
                                        onChange={() => { setAppDestino(app.id); setModoDestino('PRO'); }}
                                    />
                                    <span style={{ fontWeight: appDestino === app.id ? 'bold' : 'normal', color: '#333' }}>{app.name}</span>
                                </label>
                            );
                        })}
                    </div>

                    {/* --- NUEVO: SELECTOR PRO/CLÁSICO --- */}
                    {TARGET_APPS.find(a => a.id === appDestino)?.hasPro && (
                        <div style={{ padding: '15px', background: '#e3f2fd', borderRadius: '8px', marginBottom: '20px', border: '1px solid #bbdefb' }}>
                            <p style={{ margin: '0 0 10px 0', fontSize: '0.9rem', color: '#1565c0', fontWeight: 'bold' }}>¿Qué versión prefieres?</p>
                            <div style={{ display: 'flex', gap: '10px' }}>
                                <label style={{ flex: 1, padding: '10px', background: modoDestino === 'PRO' ? '#2196F3' : 'white', color: modoDestino === 'PRO' ? 'white' : '#333', borderRadius: '5px', cursor: 'pointer', textAlign: 'center', fontWeight: 'bold', border: `1px solid ${modoDestino === 'PRO' ? '#1976d2' : '#ccc'}` }}>
                                    <input type="radio" checked={modoDestino === 'PRO'} onChange={() => setModoDestino('PRO')} style={{ display: 'none' }} />
                                    🌟 PRO (Recomendada)
                                </label>
                                <label style={{ flex: 1, padding: '10px', background: modoDestino === 'CLASICO' ? '#95a5a6' : 'white', color: modoDestino === 'CLASICO' ? 'white' : '#333', borderRadius: '5px', cursor: 'pointer', textAlign: 'center', fontWeight: 'bold', border: `1px solid ${modoDestino === 'CLASICO' ? '#7f8c8d' : '#ccc'}` }}>
                                    <input type="radio" checked={modoDestino === 'CLASICO'} onChange={() => setModoDestino('CLASICO')} style={{ display: 'none' }} />
                                    📺 Clásica
                                </label>
                            </div>
                        </div>
                    )}

                    {mensaje && (
                        <div style={{ padding: '10px', borderRadius: '8px', marginBottom: '15px', background: mensaje.tipo === 'exito' ? '#E8F5E9' : '#FFEBEE', color: mensaje.tipo === 'exito' ? '#2E7D32' : '#C62828', display: 'flex', alignItems: 'center', gap: '10px' }}>
                            {mensaje.tipo === 'exito' ? <CheckCircle size={18} /> : <AlertTriangle size={18} />} {mensaje.texto}
                        </div>
                    )}

                    <button
                        onClick={ejecutarConversion}
                        disabled={!recursoOrigen || !appDestino || procesando}
                        style={{ width: '100%', padding: '15px', background: (!recursoOrigen || !appDestino || procesando) ? '#ccc' : '#FF9800', color: 'white', border: 'none', borderRadius: '10px', fontSize: '1.2rem', fontWeight: 'bold', cursor: (!recursoOrigen || !appDestino || procesando) ? 'not-allowed' : 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '10px', boxShadow: (!recursoOrigen || !appDestino || procesando) ? 'none' : '0 4px 10px rgba(255, 152, 0, 0.3)' }}
                    >
                        {procesando ? <Loader className="spin" size={24} /> : <RefreshCw size={24} />}
                        {procesando ? 'Transformando...' : '¡Hacer Magia!'}
                    </button>
                </div>

            </div>
            <style>{`.spin { animation: spin 1s linear infinite; } @keyframes spin { 100% { transform: rotate(360deg); } }`}</style>
        </div>
    );
}

const badgeStep = { background: '#2c3e50', color: 'white', width: '28px', height: '28px', borderRadius: '50%', display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: '14px' };