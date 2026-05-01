import { useState, useEffect } from 'react';
import { auth, db } from './firebase';
import { signOut, onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, setDoc, collection, query, where, getDocs } from "firebase/firestore";
import ProfesorDashboard from './ProfesorDashboard';
import LandingGames from './components/LandingGames3';
import Login from './Login';
import GamePlayer from './GamePlayer';
import PaginaProfesor from './components/PaginaProfesor';
import FuncionesEjecutivas from './FuncionesEjecutivas';
import IrregularVerbsTest from './IrregularVerbsTest';
import { SolarSystemViewer } from './components/LandingGames3';
import PiTutorial from './components/PiTutorial';

const TUTORIAL_ALUMNO = [
    {
        texto: '¡Hola! Soy Pi 👋 Bienvenido/a a pikt.es. Aquí encontrarás juegos y actividades preparados por tus profesores para aprender de forma divertida.'
    },
    {
        texto: 'Puedes guardar tus resultados para que tu profesor los vea, y modificar tu perfil desde el menú superior. ¡A jugar!'
    },
];

function App() {
    const [usuario, setUsuario] = useState(null);
    const [rol, setRol] = useState(null);
    const [cargando, setCargando] = useState(true);

    // ESTADO PARA EL TOKEN DE DRIVE
    const [googleToken, setGoogleToken] = useState(null);
    const [deepLinkGame, setDeepLinkGame] = useState(null);
    const [rutaPublica, setRutaPublica] = useState(null);

    // ESTADOS PARA UBICACIÓN
    const [pais, setPais] = useState("");
    const [region, setRegion] = useState("");
    const [poblacion, setPoblacion] = useState("");
    const [temas, setTemas] = useState("");
    // DETECTAR PÁGINA PÚBLICA DE PROFESOR — por slug (/nombre) o por ?p=uid
    const [paginaTarget, setPaginaTarget] = useState(null); // { uid } | { slug }

    useEffect(() => {
      const params = new URLSearchParams(window.location.search);
      const uid = params.get('p');
      if (uid) { setPaginaTarget({ uid }); return; }
      const slug = window.location.pathname.replace(/^\//, '').replace(/\/$/, '').trim().toLowerCase();
      if (slug === 'funcionesejecutivas' || slug === 'irregular_verbs' || slug === 'sistema_solar') {
        setRutaPublica(slug);
        return;
      }
      const RUTAS_RESERVADAS = new Set([
        'populares','inicio',
        'pasapalabra','cazaburbujas','burbujas',
        'pikatron','pikatron_2','plataformas',
        'kartinged','karting','kartinged_multi','karting_multi',
        'aparejados','ruleta','wordle','mathle',
        'thinkhoot','pilive','mathlive','olympiclive','olympic_live',
        'sopa','sopa_letras','question_sender','q-sender',
        'omninteractive','videoquizz','sintaxis','listening',
        'etiquetas','etiquetame',
        'geometrix','calculo','funciones','funciones2','geometria_analitica','geometriaanalitica',
        'ecuaciones','oca','domino','musica',
        'api','admin','login','app',
        'irregular_verbs','sistema_solar',
      ]);
      if (slug && !RUTAS_RESERVADAS.has(slug)) {
        // Check if it's a professor page slug
        getDocs(query(collection(db,'paginas_profesores'), where('slug','==',slug), where('publicada','==',true)))
          .then(snap => { if (!snap.empty) setPaginaTarget({ slug, uid: snap.docs[0].id }); })
          .catch(()=>{});
      }
    }, []);

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
            setRol(data.role?.toLowerCase() || null);
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

    if (rutaPublica === 'funcionesejecutivas') return <FuncionesEjecutivas onBack={() => { setRutaPublica(null); window.history.pushState({}, '', '/'); }} />;
    if (rutaPublica === 'irregular_verbs') return <IrregularVerbsTest />;
    if (rutaPublica === 'sistema_solar') return <SolarSystemViewer onExit={() => { setRutaPublica(null); window.history.pushState({}, '', '/'); }} />;

    // PÁGINA PÚBLICA DEL PROFESOR (no requiere login)
    if (paginaTarget) return <PaginaProfesor uid={paginaTarget.uid} onBack={() => { setPaginaTarget(null); window.history.back(); }} />;

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
                        <button onClick={() => completarRegistro('alumno')} style={{ padding: '12px 24px', background: '#FF9800', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' }}>🎓 Soy Alumno</button>
                    </div>
                    <button onClick={handleLogout} style={{ marginTop: '20px', background: 'none', border: 'none', textDecoration: 'underline', cursor: 'pointer' }}>Cancelar</button>
                </div>
            )}

            {/* Si ya tiene rol, mostramos el Dashboard correspondiente */}
            {rol && (
                <div>
                    {rol?.toLowerCase() === 'profesor' ? (
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
                            <div style={{ minHeight: '100vh', background: 'linear-gradient(160deg, #e8f0fe 0%, #dbeafe 50%, #ede9fe 100%)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 20px', background: 'rgba(255,255,255,0.7)', backdropFilter: 'blur(8px)', boxShadow: '0 2px 8px rgba(59,130,246,0.1)', alignItems: 'center' }}>
                                    <span style={{ color: '#1e40af' }}>Alumno: <b>{usuario.displayName}</b></span>
                                    <button onClick={handleLogout} style={{ border: 'none', background: 'none', color: '#6b7280', cursor: 'pointer' }}>Salir</button>
                                </div>
                                <LandingGames usuario={usuario} />
                                <PiTutorial
                                    usuario={usuario}
                                    tutorialId="bienvenida_alumno"
                                    pasos={TUTORIAL_ALUMNO}
                                />
                            </div>
                        )}
                </div>
            )}
        </div>
    );
}

export default App;