import { useState } from 'react';
import { db } from './firebase';
import { collection, query, where, getDocs, doc, updateDoc, arrayUnion, getDoc } from 'firebase/firestore';
import { Send, CheckCircle, AlertCircle, ArrowLeft } from 'lucide-react';
import Confetti from 'react-confetti';
export default function QuestionSenderClient({ usuario, onBack }) {
    const [codigo, setCodigo] = useState('');
    const [fase, setFase] = useState('CODIGO'); // CODIGO, FORMULARIO, EXITO, COMPLETADO
    const [datosHoja, setDatosHoja] = useState(null); // { recursoId, hojaIndex, nombreHoja, profesor, targetGame, config }
    const [respuestas, setRespuestas] = useState([]); // Array de objetos { pregunta, respuesta, letra... }
    const [error, setError] = useState('');
    const [enviando, setEnviando] = useState(false);

    // --- 1. ENTRAR EN LA HOJA ---
    const entrar = async () => {
        if (!codigo.trim()) return setError("Escribe el código.");
        setEnviando(true); setError('');

        try {
            // Buscamos recursos que tengan el código en su array 'hojasCodes' (Optimización)
            const q = query(collection(db, "resources"), where("hojasCodes", "array-contains", codigo.toUpperCase().trim()));
            const snap = await getDocs(q);

            if (snap.empty) {
                setEnviando(false);
                return setError("Código no encontrado. Verifica con tu profesor.");
            }

            const docData = snap.docs[0].data();
            const recursoId = snap.docs[0].id;

            // Buscar qué hoja tiene este código
            const hojaIndex = docData.hojas.findIndex(h => h.accessCode === codigo.toUpperCase().trim());
            const hoja = docData.hojas[hojaIndex];

            // Comprobar si ya completó
            if (hoja.completedBy && hoja.completedBy.includes(usuario.email)) {
                setFase('COMPLETADO');
                setEnviando(false);
                return;
            }

            // Preparar formulario
            const numPreguntas = parseInt(docData.config?.numPreguntas) || 3;
            // Inicializar respuestas vacías según el juego
            const plantillas = Array.from({ length: numPreguntas }, () => ({ pregunta: '', respuesta: '', letra: '' }));

            setRespuestas(plantillas);
            setDatosHoja({
                recursoId,
                hojaIndex,
                nombreHoja: hoja.nombreHoja,
                profesor: docData.profesorNombre,
                targetGame: docData.targetGame || 'PASAPALABRA',
                numPreguntas
            });
            setFase('FORMULARIO');

        } catch (e) {
            console.error(e);
            setError("Error al buscar. Inténtalo de nuevo.");
        }
        setEnviando(false);
    };

    // --- 2. MANEJAR INPUTS ---
    const updateRespuesta = (index, campo, valor) => {
        const nuevas = [...respuestas];
        nuevas[index][campo] = valor;
        setRespuestas(nuevas);
        setError(''); // Limpiar errores al escribir
    };

    // --- 3. ENVIAR ---
    const enviar = async () => {
        // Validación
        for (let i = 0; i < respuestas.length; i++) {
            const r = respuestas[i];
            if (!r.pregunta.trim() || !r.respuesta.trim()) return setError(`Faltan datos en la pregunta #${i + 1}`);
            if (datosHoja.targetGame === 'PASAPALABRA' && !r.letra.trim()) return setError(`Falta la Letra en la pregunta #${i + 1}`);
        }

        setEnviando(true);
        try {
            const ref = doc(db, "resources", datosHoja.recursoId);

            // Obtenemos el recurso fresco para no machacar datos
            const snap = await getDoc(ref); // Necesitas importar getDoc arriba si no lo tienes, pero usaremos arrayUnion que es más seguro para concurrencia?
            // Firestore arrayUnion no sirve para modificar objetos dentro de arrays complejos fácilmente.
            // Para editar un objeto especifico dentro del array 'hojas', lo mejor es leer, modificar y escribir.

            // ACTUALIZACIÓN SEGURA:
            // 1. Leer todo el doc
            // 2. Modificar el array hojas en memoria
            // 3. Update doc

            // Nota: En un entorno real con muchos alumnos a la vez, esto podría tener condiciones de carrera. 
            // Para una clase es aceptable.

            // IMPORTANTE: Como no tengo getDoc importado, lo simularé con la lógica que ya tenemos si el usuario lo acepta, 
            // pero lo ideal es importar getDoc. Voy a asumir que puedo usar updateDoc con la lógica de reemplazo de array si es necesario,
            // pero lo más seguro es leer y escribir.

            // Vamos a hacerlo con la data que ya tenemos, asumiendo bajo tráfico.
            // O mejor: leer de nuevo para asegurar.
            // (Añado getDoc a los imports)

            // Como no puedo editar imports arriba en este bloque, asumo que los tienes. Si no, añádelo.
            // Voy a usar getDocs de nuevo con ID para leerlo.
            const q = query(collection(db, "resources"), where("__name__", "==", datosHoja.recursoId));
            const s = await getDocs(q);
            const docSnapshot = s.docs[0];
            const data = docSnapshot.data();

            const nuevasHojas = [...data.hojas];
            const hojaActual = nuevasHojas[datosHoja.hojaIndex];

            // Añadir preguntas con email
            const preguntasNuevas = respuestas.map(r => ({
                ...r,
                studentEmail: usuario.email,
                fecha: new Date().toISOString()
            }));

            if (!hojaActual.preguntas) hojaActual.preguntas = [];
            hojaActual.preguntas.push(...preguntasNuevas);

            // Añadir a completados
            if (!hojaActual.completedBy) hojaActual.completedBy = [];
            hojaActual.completedBy.push(usuario.email);

            nuevasHojas[datosHoja.hojaIndex] = hojaActual;

            await updateDoc(doc(db, "resources", datosHoja.recursoId), { hojas: nuevasHojas });

            setFase('EXITO');

        } catch (e) {
            console.error(e);
            setError("Error al enviar. Inténtalo de nuevo.");
        }
        setEnviando(false);
    };

    // --- RENDERIZADO ---

    if (fase === 'CODIGO') return (
        <div style={estiloContenedor}>
            <button onClick={onBack} style={btnVolver}><ArrowLeft size={16} /> Volver</button>
            <div style={cardStyle}>
                <h2 style={{ color: '#2c3e50' }}>📮 Question Sender</h2>
                <p>Introduce el código que te dio el profesor:</p>
                <input
                    value={codigo}
                    onChange={e => setCodigo(e.target.value.toUpperCase())}
                    placeholder="CÓDIGO DE LA HOJA"
                    style={inputCodigo}
                    maxLength={5}
                />
                {error && <p style={{ color: 'red' }}>{error}</p>}
                <button onClick={entrar} disabled={enviando} style={btnPrincipal}>
                    {enviando ? 'Verificando...' : 'ENTRAR'}
                </button>
            </div>
        </div>
    );

    if(fase === 'COMPLETADO') return (
        <div style={estiloContenedor}>
            <div style={cardStyle}>
                <CheckCircle size={60} color="#2ecc71" style={{ margin: '0 auto' }} />
                <h2 style={{ color: '#27ae60' }}>¡Tarea Completada!</h2>
                <p>Ya has enviado tus preguntas para este reto anteriormente.</p>
                <p>¡Gracias por participar!</p>
                {/* BOTÓN AÑADIDO AQUÍ 👇 */}
                <button onClick={onBack} style={btnPrincipal}>Volver al Inicio</button>
            </div>
        </div>
    );

    if (fase === 'EXITO') return (
        <div style={estiloContenedor}>
            <Confetti recycle={false} />
            <div style={cardStyle}>
                <CheckCircle size={60} color="#2ecc71" style={{ margin: '0 auto' }} />
                <h2 style={{ color: '#27ae60' }}>¡Muy bien!</h2>
                <p>Tus preguntas han sido enviadas correctamente.</p>
                <p>Has completado el reto.</p>
                {/* BOTÓN VOLVER A INICIO AÑADIDO */}
                <button onClick={onBack} style={btnPrincipal}>Volver al Inicio</button>
            </div>
        </div>
    );

    // FASE FORMULARIO
    return (
        <div style={{ ...estiloContenedor, justifyContent: 'flex-start', paddingTop: '20px' }}>
            <div style={{ ...cardStyle, maxWidth: '800px', width: '95%' }}>
                <h2 style={{ color: '#3498db', margin: '0' }}>{datosHoja.targetGame}</h2>
                <div style={{ background: '#e3f2fd', padding: '15px', borderRadius: '10px', margin: '20px 0', borderLeft: '5px solid #2196F3', textAlign: 'left' }}>
                    <p style={{ margin: 0, fontSize: '1.1rem' }}>
                        Para superar este reto debes completar <b>{datosHoja.numPreguntas} preguntas</b> para <b>{datosHoja.nombreHoja}</b> del profesor <b>{datosHoja.profesor}</b>.
                    </p>
                </div>

                {respuestas.map((r, i) => (
                    <div key={i} style={{ marginBottom: '20px', padding: '15px', border: '1px solid #ddd', borderRadius: '10px', textAlign: 'left' }}>
                        <h4 style={{ margin: '0 0 10px 0', color: '#666' }}>Pregunta {i + 1}</h4>
                        <div style={{ display: 'grid', gridTemplateColumns: datosHoja.targetGame === 'PASAPALABRA' ? '80px 1fr 1fr' : '1fr 1fr', gap: '10px' }}>

                            {datosHoja.targetGame === 'PASAPALABRA' && (
                                <div>
                                    <label style={lbl}>Letra</label>
                                    <input
                                        maxLength={1}
                                        value={r.letra}
                                        onChange={e => updateRespuesta(i, 'letra', e.target.value.toUpperCase())}
                                        style={{ ...inputForm, textAlign: 'center', fontWeight: 'bold' }}
                                        placeholder="A"
                                    />
                                </div>
                            )}

                            <div>
                                <label style={lbl}>Pregunta</label>
                                <input
                                    value={r.pregunta}
                                    onChange={e => updateRespuesta(i, 'pregunta', e.target.value)}
                                    style={inputForm}
                                    placeholder="Escribe la definición..."
                                />
                            </div>

                            <div>
                                <label style={lbl}>Respuesta</label>
                                <input
                                    value={r.respuesta}
                                    onChange={e => updateRespuesta(i, 'respuesta', e.target.value)}
                                    style={inputForm}
                                    placeholder="Respuesta correcta"
                                />
                            </div>
                        </div>
                    </div>
                ))}

                {error && <div style={{ color: '#e74c3c', fontWeight: 'bold', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '5px', justifyContent: 'center' }}><AlertCircle size={18} /> {error}</div>}

                <button onClick={enviar} disabled={enviando} style={{ ...btnPrincipal, background: enviando ? '#ccc' : '#2ecc71' }}>
                    {enviando ? 'Enviando...' : 'ENVIAR RESPUESTAS'}
                </button>
            </div>
        </div>
    );
}

// Estilos
const estiloContenedor = { minHeight: '100vh', background: '#2c3e50', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '10px' };
const cardStyle = { background: 'white', padding: '30px', borderRadius: '15px', width: '90%', maxWidth: '400px', textAlign: 'center', boxShadow: '0 10px 30px rgba(0,0,0,0.3)' };
const inputCodigo = { width: '100%', padding: '15px', fontSize: '24px', textAlign: 'center', letterSpacing: '5px', textTransform: 'uppercase', marginBottom: '15px', borderRadius: '8px', border: '2px solid #ddd' };
const btnPrincipal = { width: '100%', padding: '15px', background: '#3498db', color: 'white', border: 'none', borderRadius: '8px', fontSize: '1.2rem', cursor: 'pointer', fontWeight: 'bold' };
const btnVolver = { background: 'transparent', border: 'none', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '10px', alignSelf: 'flex-start', marginLeft: '10px' };
const inputForm = { width: '100%', padding: '10px', borderRadius: '5px', border: '1px solid #ccc', boxSizing: 'border-box' };
const lbl = { display: 'block', fontSize: '12px', color: '#777', marginBottom: '5px', fontWeight: 'bold' };