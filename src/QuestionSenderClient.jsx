import { useState } from 'react';
import { db } from './firebase';
// Añade 'addDoc' a los imports
import { collection, query, where, getDocs, doc, updateDoc, getDoc, addDoc } from 'firebase/firestore';
import { Send, CheckCircle, AlertCircle, ArrowLeft, User, Info } from 'lucide-react';
import Confetti from 'react-confetti';
export default function QuestionSenderClient({ usuario, onBack }) {
    const [codigo, setCodigo] = useState('');
    const [fase, setFase] = useState('CODIGO'); // CODIGO, FORMULARIO, EXITO, COMPLETADO
    const [datosHoja, setDatosHoja] = useState(null); // { recursoId, hojaIndex, nombreHoja, profesor, targetGame, config }
    const [respuestas, setRespuestas] = useState([]); // Array de objetos { pregunta, respuesta, letra... }
    const [error, setError] = useState('');
    const [enviando, setEnviando] = useState(false);
    // --- AÑADE ESTO ---
    const [nombreGuest, setNombreGuest] = useState('');
    const [letrasOcupadas, setLetrasOcupadas] = useState([]);
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
    // --- 3. ENVIAR (VERSIÓN BUZÓN / RESULTADO) ---
    const enviar = async () => {
        // 1. Validar Nombre
        let nombreFinal = '';
        let emailFinal = 'invitado';

        if (usuario && usuario.email) {
            nombreFinal = usuario.displayName || usuario.email.split('@')[0];
            emailFinal = usuario.email;
        } else {
            if (!nombreGuest.trim()) return setError("Por favor, escribe tu nombre antes de enviar.");
            nombreFinal = nombreGuest.trim();
        }

        // 2. Validar Preguntas (Igual que antes)
        const tipo = datosHoja.targetGame;
        for (let i = 0; i < respuestas.length; i++) {
            const r = respuestas[i];
            if (!r.pregunta.trim()) return setError(`Falta la Pregunta #${i + 1}`);
            if (tipo === 'PASAPALABRA' && (!r.letra.trim() || !r.respuesta.trim())) return setError(`Falta Letra/Respuesta en #${i + 1}`);
            if (tipo === 'CAZABURBUJAS' && (!r.respuesta.trim() || !r.incorrecta1.trim())) return setError(`Faltan respuestas en #${i + 1}`);
        }

        setEnviando(true);
        try {
            // 3. EN LUGAR DE TOCAR EL RECURSO, CREAMOS UN "RESULTADO" EN EL BUZÓN
            // Preparamos las preguntas limpias
            const preguntasParaEnviar = respuestas.map(r => {
                const base = {
                    pregunta: r.pregunta,
                    studentName: nombreFinal,
                    studentEmail: emailFinal,
                    fecha: new Date().toISOString()
                };

                if (tipo === 'PASAPALABRA') {
                    base.letra = r.letra.toUpperCase();
                    base.respuesta = r.respuesta;
                } else if (tipo === 'CAZABURBUJAS') {
                    base.correcta = r.respuesta;
                    base.incorrectas = [r.incorrecta1, r.incorrecta2, r.incorrecta3];
                } else {
                    base.respuesta = r.respuesta;
                }
                return base;
            });

            // GUARDAMOS EN UNA COLECCIÓN NUEVA "mail_questions" (Como si fuera un ranking)
            await addDoc(collection(db, "mail_questions"), {
                recursoId: datosHoja.recursoId,     // Para saber a qué recurso pertenecen
                hojaIndex: datosHoja.hojaIndex,     // Para saber a qué hoja van
                nombreHoja: datosHoja.nombreHoja,
                preguntas: preguntasParaEnviar,     // El paquete de preguntas
                fechaEnvio: new Date(),
                estado: 'PENDIENTE'                 // Para que el profe sepa que son nuevas
            });

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

                    {/* CASO CAZABURBUJAS */}
                    {datosHoja.targetGame === 'CAZABURBUJAS' ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            <div><label style={lbl}>Pregunta</label><input value={r.pregunta} onChange={e => updateRespuesta(i, 'pregunta', e.target.value)} style={inputForm} /></div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                <div><label style={{ ...lbl, color: 'green' }}>Correcta</label><input value={r.respuesta} onChange={e => updateRespuesta(i, 'respuesta', e.target.value)} style={{ ...inputForm, borderColor: 'green' }} /></div>
                                <div><label style={{ ...lbl, color: 'red' }}>Incorrecta 1</label><input value={r.incorrecta1} onChange={e => updateRespuesta(i, 'incorrecta1', e.target.value)} style={{ ...inputForm, borderColor: 'red' }} /></div>
                                <div><label style={{ ...lbl, color: 'red' }}>Incorrecta 2</label><input value={r.incorrecta2} onChange={e => updateRespuesta(i, 'incorrecta2', e.target.value)} style={{ ...inputForm, borderColor: 'red' }} /></div>
                                <div><label style={{ ...lbl, color: 'red' }}>Incorrecta 3</label><input value={r.incorrecta3} onChange={e => updateRespuesta(i, 'incorrecta3', e.target.value)} style={{ ...inputForm, borderColor: 'red' }} /></div>
                            </div>
                        </div>
                    ) : (
                            /* CASO PASAPALABRA Y OTROS */
                            <div style={{ display: 'grid', gridTemplateColumns: datosHoja.targetGame === 'PASAPALABRA' ? '60px 1fr 1fr' : '1fr 1fr', gap: '10px' }}>
                                {datosHoja.targetGame === 'PASAPALABRA' && (
                                    <div><label style={lbl}>Letra</label><input maxLength={1} value={r.letra} onChange={e => updateRespuesta(i, 'letra', e.target.value.toUpperCase())} style={{ ...inputForm, textAlign: 'center', fontWeight: 'bold' }} /></div>
                                )}
                                <div><label style={lbl}>Pregunta</label><input value={r.pregunta} onChange={e => updateRespuesta(i, 'pregunta', e.target.value)} style={inputForm} /></div>
                                <div><label style={lbl}>Respuesta</label><input value={r.respuesta} onChange={e => updateRespuesta(i, 'respuesta', e.target.value)} style={inputForm} /></div>
                            </div>
                        )}
                </div>
            ))}
                {/* CAMPO INVITADO */}
                {!usuario && (
                    <div style={{ marginBottom: '20px', padding: '15px', background: '#fff3cd', borderRadius: '10px', border: '1px solid #ffeeba', textAlign: 'left' }}>
                        <label style={{ display: 'block', fontWeight: 'bold', color: '#856404', marginBottom: '5px' }}>Tu Nombre:</label>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <User size={20} color="#856404" />
                            <input
                                value={nombreGuest}
                                onChange={e => setNombreGuest(e.target.value)}
                                placeholder="Nombre y Apellido"
                                style={{ ...inputForm, border: '1px solid #856404' }}
                            />
                        </div>
                    </div>
                )}
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