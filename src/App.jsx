import { useState, useEffect } from 'react';
import { auth, db } from './firebase';
import { signOut, onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import ProfesorDashboard from './ProfesorDashboard';
import StudentDashboard2 from './StudentDashboard2';
import Login from './Login';
import GamePlayer from './GamePlayer';

function App() {
    const [usuario, setUsuario] = useState(null);
    const [rol, setRol] = useState(null);
    const [cargando, setCargando] = useState(true);

    // ESTADO PARA EL TOKEN DE DRIVE
    const [googleToken, setGoogleToken] = useState(null);
    const [deepLinkGame, setDeepLinkGame] = useState(null);

    // ESTADOS PARA UBICACIÓN
    const [pais, setPais] = useState("");
    const [region, setRegion] = useState("");
    const [poblacion, setPoblacion] = useState("");
    const [temas, setTemas] = useState("");
    // DETECTAR DEEP LINK AL MONTAR (funciona para todos: registrados, sin registrar, invitados)
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const recursoId = params.get('r');
        if (!recursoId) return;
        getDoc(doc(db, 'resources', recursoId)).then(snap => {
            if (snap.exists()) {
                setDeepLinkGame({
                    recurso: { id: snap.id, ...snap.data() },
                    hoja: params.get('h') || 'General',
                    modoInicial: params.get('m') || null
                });
            }
        }).catch(e => console.error('Deep link error:', e));
    }, []);

    // 1. ESCUCHAR SI EL USUARIO YA ESTABA LOGUEADO
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            if (currentUser) {
                setUsuario(currentUser);
                await consultarDatosUsuario(currentUser.uid);
            } else {
                setUsuario(null);
                setRol(null);
                setGoogleToken(null);
            }
            setCargando(false);
        });
        return () => unsubscribe();
    }, []);

    // 2. BUSCAR DATOS EN FIRESTORE
    const consultarDatosUsuario = async (uid) => {
        const docRef = doc(db, "users", uid);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            const data = docSnap.data();
            setRol(data.role);
            setPais(data.pais || "");
            setRegion(data.region || "");
            setPoblacion(data.poblacion || "");
        }
    };

    // 3. GUARDAR NUEVO USUARIO
    const completarRegistro = async (rolElegido) => {
        if (!usuario) return;
        if (!pais || !region || !poblacion) {
            alert("Por favor, completa todos los campos de ubicación.");
            return;
        }

        try {
            await setDoc(doc(db, "users", usuario.uid), {
                uid: usuario.uid,
                email: usuario.email,
                displayName: usuario.displayName,
                photoURL: usuario.photoURL,
                role: rolElegido,
                pais: pais,
                region: region,
                poblacion: poblacion,
                temasPreferidos: temas, // <--- NUEVO CAMPO AÑADIDO
                createdAt: new Date()
            });

            setRol(rolElegido);
        } catch (error) {
            console.error("Error guardando datos:", error);
            alert("Error al guardar en la base de datos.");
        }
    };

    const handleLogout = () => {
        signOut(auth);
        setPais(""); setRegion(""); setPoblacion("");
    };

    if (cargando && !deepLinkGame) return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>Cargando...</div>;

    // DEEP LINK: abrir juego directamente (funciona para todos, incluso sin cuenta)
    if (deepLinkGame) {
        return <GamePlayer
            recurso={deepLinkGame.recurso}
            usuario={usuario}
            alTerminar={() => setDeepLinkGame(null)}
            autoStart={true}
            hojaInicial={deepLinkGame.hoja}
            modoInicial={deepLinkGame.modoInicial}
        />;
    }

    // SI NO HAY USUARIO, MOSTRAMOS EL NUEVO LOGIN
    if (!usuario) {
        return <Login setGoogleToken={setGoogleToken} />;
    }

    // SI HAY USUARIO, MOSTRAMOS LA APP NORMAL
    return (
        <div style={{ fontFamily: 'Arial' }}>

            {/* Si aún no tiene rol, mostramos la pantalla de registro de datos */}
            {!rol && (
                <div style={{ maxWidth: '500px', margin: '50px auto', backgroundColor: '#fff8e1', padding: '30px', borderRadius: '10px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', textAlign: 'center' }}>
                    <h1 style={{ marginBottom: '20px' }}>Bienvenido a PiKT</h1>
                    <img src={usuario.photoURL} alt="Perfil" style={{ borderRadius: '50%', width: '80px', marginBottom: '10px' }} />
                    <h3>Completa tu Perfil</h3>
                    <p>Necesitamos saber de dónde eres para configurar tu cuenta.</p>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
                        <input type="text" placeholder="País (ej: España)" value={pais} onChange={(e) => setPais(e.target.value)} style={{ padding: '10px', borderRadius: '5px', border: '1px solid #ccc' }} />
                        <input type="text" placeholder="Región / Provincia" value={region} onChange={(e) => setRegion(e.target.value)} style={{ padding: '10px', borderRadius: '5px', border: '1px solid #ccc' }} />
                        <input type="text" placeholder="Población / Ciudad" value={poblacion} onChange={(e) => setPoblacion(e.target.value)} style={{ padding: '10px', borderRadius: '5px', border: '1px solid #ccc' }} />
                        <input type="text" placeholder="Temas Preferidos (ej: Historia, Mates...)" value={temas} onChange={(e) => setTemas(e.target.value)} style={{ padding: '10px', borderRadius: '5px', border: '1px solid #ccc' }} />

                    </div>

                    <p style={{ fontWeight: 'bold' }}>¿Cómo vas a usar la app?</p>
                    <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
                        <button onClick={() => completarRegistro('profesor')} style={{ padding: '12px 24px', background: '#2196F3', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' }}>👨‍🏫 Soy Profesor</button>
                        <button onClick={() => completarRegistro('Alumno')} style={{ padding: '12px 24px', background: '#FF9800', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' }}>🎓 Soy Alumno</button>
                    </div>
                    <button onClick={handleLogout} style={{ marginTop: '20px', background: 'none', border: 'none', textDecoration: 'underline', cursor: 'pointer' }}>Cancelar</button>
                </div>
            )}

            {/* Si ya tiene rol, mostramos el Dashboard correspondiente */}
            {rol && (
                <div>
                    {rol === 'profesor' || rol === 'Profesor' ? (
                        <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 20px', background: '#fff', boxShadow: '0 2px 4px rgba(0,0,0,0.1)', alignItems: 'center' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <img src={usuario.photoURL} alt="User" style={{ width: '30px', borderRadius: '50%' }} />
                                    <span>Hola, <b>{usuario.displayName}</b> ({poblacion})</span>
                                </div>
                                <button onClick={handleLogout} style={{ border: 'none', background: 'none', color: 'red', cursor: 'pointer', fontWeight: 'bold' }}>Salir</button>
                            </div>
                            <ProfesorDashboard usuario={usuario} googleToken={googleToken} />
                        </div>
                    ) : (
                            <div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 20px', background: '#2c3e5050', boxShadow: '0 2px 4px rgba(0,0,0,0.1)', alignItems: 'center' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>

                                        

                                        <span>Alumno: <b>{usuario.displayName}</b></span>
                                    </div>
                                    <button onClick={handleLogout} style={{ border: 'none', background: 'none', color: '#666', cursor: 'pointer' }}>Salir</button>
                                </div>
                                <StudentDashboard2 usuario={usuario} />
                            </div>
                        )}
                </div>
            )}
        </div>
    );
}

export default App;