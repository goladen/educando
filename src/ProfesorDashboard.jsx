import { useState, useEffect } from 'react';
import { db } from './firebase';
import { collection, query, where, getDocs, deleteDoc, doc, addDoc, updateDoc, getDoc, setDoc, orderBy } from 'firebase/firestore';
import { Trash2, Plus, FileSpreadsheet, Bot, BarChart2, Save, X, Pencil, Key, Gamepad2, Edit3, Globe, Search, Copy, Eye, Users, RotateCcw, Send, Zap, UserCircle, LogOut, Menu, HelpCircle, Shield, Info, FileText } from 'lucide-react';
import useDrivePicker from 'react-google-drive-picker';
import { procesarArchivoExcel } from './ExcelParser';
import { generarPreguntasGemini } from './GeminiGenerator';
import GamePlayer from './GamePlayer';
import ThinkHootGame from './ThinkHootGame';
import EditorManual from './components/EditorManual';
import EditorPro from './components/EditorPro';
import RuletaGame from './RuletaGame';
import UserProfile from './components/UserProfile';
import StudentDashboard from './StudentDashboard';
import GlobalSearch from './components/GlobalSearch'; // <--- NUEVO
import TeacherTools from './components/TeacherTools'; // <--- NUEVO

// ==============================================================================
//  ZONA DE CLAVES
// ==============================================================================
const GEMINI_API_KEY = "AIzaSyCpap7E3iSXVYyfm8cEFqa-StlPUAfFpfY";
const GOOGLE_CLIENT_ID = "544528054442-j4bijvccdnk8gbbmhe1am6bgkubp62m0.apps.googleusercontent.com";
const GOOGLE_DEVELOPER_KEY = "AIzaSyDOFNi_V_HbCKS8bQWAsFqQKBEiBrBYQCw";
// ==============================================================================

const TIPOS_JUEGOS = {
    PASAPALABRA: { id: 'PASAPALABRA', label: 'Pasapalabra', color: '#3F51B5', camposConfig: [{ key: 'tiempoTotal', label: 'Tiempo Rosco (seg)', type: 'number', default: 150 }] },
    CAZABURBUJAS: { id: 'CAZABURBUJAS', label: 'Caza Burbujas', color: '#E91E63', camposConfig: [{ key: 'tiempoPregunta', label: 'Tiempo/preg (seg)', type: 'number', default: 20 }, { key: 'numPreguntas', label: 'Nº Preguntas', type: 'number', default: 10 }, { key: 'puntosAcierto', label: 'Pts Acierto', type: 'number', default: 10 }, { key: 'puntosFallo', label: 'Pts Fallo', type: 'number', default: 2 }] },
    APAREJADOS: { id: 'APAREJADOS', label: 'Aparejados', color: '#FF9800', camposConfig: [{ key: 'tiempoTotal', label: 'Tiempo Total (seg)', type: 'number', default: 60 }, { key: 'numParejas', label: 'Nº Parejas', type: 'number', default: 8 }, { key: 'puntosPareja', label: 'Pts Pareja', type: 'number', default: 10 }] },
    THINKHOOT: { id: 'THINKHOOT', label: 'ThinkHoot', color: '#9C27B0', camposConfig: [{ key: 'tiempoPregunta', label: 'Tiempo/preg (seg)', type: 'number', default: 30 }, { key: 'numPreguntas', label: 'Nº Preguntas', type: 'number', default: 10 }, { key: 'puntosMax', label: 'Puntos Max', type: 'number', default: 120 }, { key: 'puntosMin', label: 'Puntos Min', type: 'number', default: 30 }] },
    RULETA: { id: 'RULETA', label: 'La Ruleta', color: '#f1c40f', camposConfig: [{ key: 'tiempoTurno', label: 'Tiempo Turno (s)', type: 'number', default: 20 }] },
    QUESTION_SENDER: { id: 'QUESTION_SENDER', label: 'Question Sender', color: '#2c3e50', camposConfig: [{ key: 'numPreguntas', label: 'Preguntas a pedir', type: 'number', default: 3 }] }
};

// MENSAJES DE AYUDA VACÍO
const INSTRUCCIONES_CREACION = {
    PASAPALABRA: "Para crear un Pasapalabra, define preguntas para cada letra del abecedario. Puedes hacerlo manual o usar la IA.",
    CAZABURBUJAS: "Crea preguntas de opción múltiple. Los alumnos deberán explotar la burbuja correcta.",
    THINKHOOT: "Diseña un quiz competitivo tipo Kahoot. Preguntas rápidas y ranking en tiempo real.",
    RULETA: "Define una frase oculta y preguntas cuyas respuestas den pistas para resolverla.",
    APAREJADOS: "Crea parejas de conceptos (Ej: País - Capital). Los alumnos deberán unirlas.",
    QUESTION_SENDER: "Crea un buzón para que tus alumnos te envíen preguntas desde sus dispositivos."
};

export default function ProfesorDashboard({ usuario, googleToken }) {
    const [juegoSeleccionado, setJuegoSeleccionado] = useState('PASAPALABRA');
    const [vista, setVista] = useState('MIS_RECURSOS'); // 'MIS_RECURSOS', 'BIBLIOTECA'
    const [recursos, setRecursos] = useState([]);
    const [bibliotecaRecursos, setBibliotecaRecursos] = useState([]);
    const [filtrosInput, setFiltrosInput] = useState({ pais: '', region: '', poblacion: '', tema: '' });
    const [filtrosActivos, setFiltrosActivos] = useState({ pais: '', region: '', poblacion: '', tema: '' });
    const [cargando, setCargando] = useState(false);
    const [perfilProfesor, setPerfilProfesor] = useState(null);
    const [mostrandoCrear, setMostrandoCrear] = useState(false);
    const [mostrandoEditorManual, setMostrandoEditorManual] = useState(false);
    const [mostrandoEditorPro, setMostrandoEditorPro] = useState(false);
    const [recursoResultados, setRecursoResultados] = useState(null);
    const [recursoProbando, setRecursoProbando] = useState(null);
    const [recursoInspeccionando, setRecursoInspeccionando] = useState(null);
    const [listaResultados, setListaResultados] = useState([]);
    const [hostGameData, setHostGameData] = useState(null);
    const [modalCopiarApp, setModalCopiarApp] = useState(null);
    const [datosEditor, setDatosEditor] = useState({ id: null, titulo: '', temas: '', profesorNombre: '', pais: '', region: '', poblacion: '', config: {}, hojas: [], isPrivate: false });
    const [modoVista, setModoVista] = useState('PROFESOR');
    const [mostrandoPerfil, setMostrandoPerfil] = useState(false);
    const [menuOpen, setMenuOpen] = useState(false);
    const [modoDashboard, setModoDashboard] = useState('CLASICO'); // 'CLASICO', 'PRO', 'BUSCADOR_GLOBAL', 'HERRAMIENTAS', 'LEGAL', 'INFO'
    const [mostrandoAyudaDashboard, setMostrandoAyudaDashboard] = useState(false); // <--- Ayuda Global

    const [openPicker] = useDrivePicker();

    useEffect(() => {
        if (usuario) {
            cargarPerfilProfesor();
            setRecursos([]);
            setBibliotecaRecursos([]);
            // Solo cargamos recursos si estamos en modo Clásico o PRO
            if (modoDashboard === 'CLASICO' || modoDashboard === 'PRO') {
                if (vista === 'MIS_RECURSOS') cargarRecursosPropios();
                else cargarBiblioteca();
            }
        }
    }, [usuario, juegoSeleccionado, vista, modoDashboard]);

    const cargarPerfilProfesor = async () => { try { const d = await getDoc(doc(db, "users", usuario.uid)); if (d.exists()) setPerfilProfesor(d.data()); } catch (e) { console.error(e) } };

    const cargarRecursosPropios = async () => {
        setCargando(true);
        try {
            const q = query(collection(db, "resources"), where("profesorUid", "==", usuario.uid), where("tipoJuego", "==", juegoSeleccionado));
            const s = await getDocs(q);
            const docs = s.docs.map(d => ({ ...d.data(), id: d.id })).filter(r => {
                if (modoDashboard === 'PRO') return r.tipo === 'PRO';
                return !r.tipo || r.tipo !== 'PRO';
            });
            setRecursos(docs);
        } catch (e) { console.error(e) }
        setCargando(false);
    };

    const cargarBiblioteca = async () => {
        setCargando(true);
        try {
            const q = query(collection(db, "resources"), where("tipoJuego", "==", juegoSeleccionado), where("isPrivate", "==", false), orderBy("playCount", "desc"));
            const s = await getDocs(q);
            const docs = s.docs.map(d => ({ ...d.data(), id: d.id })).filter(d => d.profesorUid !== usuario.uid).filter(r => {
                if (modoDashboard === 'PRO') return r.tipo === 'PRO';
                return !r.tipo || r.tipo !== 'PRO';
            });
            setBibliotecaRecursos(docs);
        } catch (e) { console.error(e); }
        setCargando(false);
    };

    const getRecursosFiltrados = () => {
        return bibliotecaRecursos.filter(r => {
            const clean = (t) => t ? t.toString().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") : "";
            const f = filtrosActivos;
            return (!f.pais || clean(r.pais).includes(clean(f.pais))) &&
                (!f.region || clean(r.region).includes(clean(f.region))) &&
                (!f.poblacion || clean(r.poblacion).includes(clean(f.poblacion))) &&
                (!f.tema || clean(r.titulo).includes(clean(f.tema)) || (r.temas && clean(r.temas).includes(clean(f.tema))));
        });
    };

    const toggleMenu = () => setMenuOpen(!menuOpen);
    
    // NAVEGACIÓN MENÚ
    const navegar = (destino) => {
        setModoDashboard(destino);
        setMenuOpen(false);
        // Reset defaults si vuelve a juegos
        if (destino === 'PRO') setJuegoSeleccionado('THINKHOOT');
        if (destino === 'CLASICO') setJuegoSeleccionado('PASAPALABRA');
    };

    const ejecutarBusqueda = () => setFiltrosActivos(filtrosInput);
    const limpiarBusqueda = () => { const v = { pais: '', region: '', poblacion: '', tema: '' }; setFiltrosInput(v); setFiltrosActivos(v); };
    const incrementarPopularidad = async (r) => { try { await updateDoc(doc(db, "resources", r.id), { playCount: (r.playCount || 0) + 1 }); } catch (e) { } };

    const copiarRecurso = async (r) => {
        if (!confirm(`¿Copiar "${r.titulo}"?`)) return;
        try { const c = { ...r, profesorUid: usuario.uid, profesorNombre: perfilProfesor?.nombre || usuario.displayName, titulo: `${r.titulo} (Copia)`, playCount: 0, isPrivate: true, origen: 'biblioteca', fechaCreacion: new Date(), accessCode: generarCodigoAcceso() }; delete c.id; await addDoc(collection(db, "resources"), c); alert("¡Copiado!"); setVista('MIS_RECURSOS'); } catch (e) { alert(e.message); }
    };

    const iniciarCreacion = () => {
        const conf = {}; TIPOS_JUEGOS[juegoSeleccionado].camposConfig.forEach(c => conf[c.key] = c.default);
        const nuevoRecurso = { id: null, titulo: '', temas: '', profesorNombre: (perfilProfesor && perfilProfesor.nombre) || usuario.displayName, pais: perfilProfesor?.pais || '', region: perfilProfesor?.region || '', poblacion: perfilProfesor?.poblacion || '', config: conf, hojas: [{ nombreHoja: 'Hoja 1', preguntas: [] }], isPrivate: juegoSeleccionado === 'QUESTION_SENDER' };
        setDatosEditor(nuevoRecurso);
        if (modoDashboard === 'PRO') {
            setMostrandoEditorPro(true);
        } else {
            setMostrandoCrear(true);
        }
    };

    const abrirEdicion = async (recursoLocal) => {
        try {
            const docRef = doc(db, "resources", recursoLocal.id);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                const dataFresca = { ...docSnap.data(), id: docSnap.id };
                if (!dataFresca.hojas) dataFresca.hojas = [{ nombreHoja: 'General', preguntas: [] }];
                if (!dataFresca.config) dataFresca.config = {};
                setDatosEditor(dataFresca);
                if (dataFresca.tipo === 'PRO') setMostrandoEditorPro(true);
                else setMostrandoEditorManual(true);
            } else { alert("El recurso no existe."); }
        } catch (error) {
            console.error(error);
            setDatosEditor(JSON.parse(JSON.stringify(recursoLocal)));
            if (recursoLocal.tipo === 'PRO') setMostrandoEditorPro(true);
            else setMostrandoEditorManual(true);
        }
    };

    const eliminarRecurso = async (id) => {
        if (!id) return;
        if (confirm("¿Borrar?")) {
            await deleteDoc(doc(db, "resources", id));
            setRecursos(prev => prev.filter(r => r.id !== id));
        }
    };
    const generarCodigoAcceso = () => { const c = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let r = ''; for (let i = 0; i < 5; i++) r += c.charAt(Math.floor(Math.random() * c.length)); return r; };
    const mostrarCodigo = async (r) => { if (r.accessCode) return alert(`🔑 ${r.accessCode}`); const c = generarCodigoAcceso(); await updateDoc(doc(db, "resources", r.id), { accessCode: c }); alert(`Nuevo: ${c}`); cargarRecursosPropios(); };

    const guardarRecursoFinal = async () => {
        if (!datosEditor.titulo) return alert("Falta Título");
        if (datosEditor.hojas.length === 0) return alert("Falta Hoja");
        if (juegoSeleccionado !== 'QUESTION_SENDER' && datosEditor.hojas.reduce((a, h) => a + h.preguntas.length, 0) === 0) return alert("Añade preguntas.");

        try {
            const dataToSave = { ...datosEditor, profesorUid: usuario.uid, tipoJuego: juegoSeleccionado, fechaCreacion: new Date() };
            delete dataToSave.id;
            if (juegoSeleccionado === 'QUESTION_SENDER') {
                dataToSave.hojasCodes = datosEditor.hojas.map(h => h.accessCode).filter(c => c);
                dataToSave.targetGame = datosEditor.targetGame || 'PASAPALABRA';
            }
            if (datosEditor.id) {
                await updateDoc(doc(db, "resources", datosEditor.id), dataToSave);
                alert("Actualizado");
            } else {
                dataToSave.accessCode = generarCodigoAcceso();
                dataToSave.playCount = 0;
                dataToSave.origen = 'manual';
                await addDoc(collection(db, "resources"), dataToSave);
                alert("Creado");
            }
            setMostrandoEditorManual(false);
            setMostrandoEditorPro(false);
            cargarRecursosPropios();
        } catch (e) { alert(e.message); }
    };

    const handleFileUpload = async (e) => { const f = e.target.files[0]; if (f) { try { const h = await procesarArchivoExcel(f, juegoSeleccionado); setDatosEditor(p => ({ ...p, hojas: h, titulo: f.name.split('.')[0] })); setMostrandoCrear(false); setMostrandoEditorManual(true); } catch (err) { alert(err.message); } } };
    const procesarCreacionIA = async () => { const t = prompt("Tema:"); if (t) { try { alert("Generando..."); const h = await generarPreguntasGemini(GEMINI_API_KEY, t, juegoSeleccionado); setDatosEditor(p => ({ ...p, hojas: h, titulo: t })); setMostrandoCrear(false); setMostrandoEditorManual(true); } catch (e) { alert(e.message); } } };
    const handleOpenPicker = () => { openPicker({ clientId: GOOGLE_CLIENT_ID, developerKey: GOOGLE_DEVELOPER_KEY, viewId: "DOCS", token: googleToken, showUploadView: true, showUploadFolders: true, supportDrives: true, multiselect: false, mimetypes: ["application/vnd.google-apps.spreadsheet"], callbackFunction: async (data) => { if (data.action === 'picked') { try { const blob = await (await fetch(`https://www.googleapis.com/drive/v3/files/${data.docs[0].id}/export?mimeType=application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`, { headers: { Authorization: `Bearer ${googleToken}` } })).blob(); const h = await procesarArchivoExcel(blob, juegoSeleccionado); setDatosEditor(p => ({ ...p, hojas: h, titulo: data.docs[0].name })); setMostrandoCrear(false); setMostrandoEditorManual(true); } catch (e) { alert(e.message); } } } }); };

    const confirmarCopiaAplicacion = async () => {
        if (!modalCopiarApp) return;
        const app = modalCopiarApp.targetGame || 'PASAPALABRA';
        let recursoFresco = modalCopiarApp;
        try {
            const snap = await getDoc(doc(db, "resources", modalCopiarApp.id));
            if (snap.exists()) recursoFresco = { ...snap.data(), id: snap.id };
        } catch (e) { console.error("Usando datos locales"); }
        const conf = {}; TIPOS_JUEGOS[app].camposConfig.forEach(c => conf[c.key] = c.default);
        const hojasL = recursoFresco.hojas.map(h => ({ nombreHoja: h.nombreHoja, preguntas: (h.preguntas || []).map(({ studentEmail, fecha, ...p }) => p) }));
        await addDoc(collection(db, "resources"), { titulo: `[IMPORT] ${recursoFresco.titulo}`, temas: recursoFresco.temas, profesorUid: usuario.uid, profesorNombre: recursoFresco.profesorNombre, pais: recursoFresco.pais, region: recursoFresco.region, poblacion: recursoFresco.poblacion, tipoJuego: app, config: conf, hojas: hojasL, isPrivate: true, origen: 'question_sender', playCount: 0, fechaCreacion: new Date(), accessCode: generarCodigoAcceso() });
        alert(`Recurso creado en ${app}`); setModalCopiarApp(null); setJuegoSeleccionado(app);
    };

    const prepararJuegoEnVivo = (r) => {
        incrementarPopularidad(r);
        const hojas = (r.hojas && r.hojas.length > 0) ? r.hojas.map(x => x.nombreHoja) : ["Por defecto"];
        hojas.unshift("General");
        setHostGameData({ recurso: r, fase: 'CONFIG_HOST', hojasDisponibles: hojas, hojaElegida: 'General' });
    };

    const confirmarLanzamientoHost = async () => {
        const sala = Math.floor(100000 + Math.random() * 900000).toString();
        const r = hostGameData.recurso;
        const esAleatorio = r.config?.aleatorio !== false; // Por defecto es aleatorio en PRO, false si se desmarca
        const limitePreguntas = parseInt(r.config?.numPreguntas) || 10;
        
        let pool = [];

        // 1. SELECCIÓN DE PREGUNTAS
        if (hostGameData.hojaElegida === 'General') {
            if (esAleatorio) {
                // MODO GENERAL ALEATORIO: Mezclar todas las hojas
                if (r.hojas) r.hojas.forEach(h => pool.push(...h.preguntas));
                pool.sort(() => Math.random() - 0.5);
            } else {
                // MODO GENERAL NO ALEATORIO: Solo preguntas de la PRIMERA hoja en orden
                if (r.hojas && r.hojas.length > 0) pool = [...r.hojas[0].preguntas];
            }
        } else {
            // HOJA ESPECÍFICA
            const h = r.hojas ? r.hojas.find(x => x.nombreHoja === hostGameData.hojaElegida) : null;
            if (h) {
                pool = [...h.preguntas];
                if (esAleatorio) pool.sort(() => Math.random() - 0.5);
                // Si no es aleatorio, se queda con el orden original
            }
        }

        if (!pool || pool.length === 0) return alert("No hay preguntas disponibles con esa configuración.");

        // 2. RECORTAR Y ADAPTAR FORMATO
        const pFin = pool.slice(0, limitePreguntas).map(p => {
            // Si es recurso clásico, adaptamos estructura a algo estándar si hace falta
            if (r.tipo !== 'PRO') {
                return {
                    ...p, // Mantener campos originales
                    q: p.pregunta,
                    a: p.correcta || p.respuesta,
                    tipo: (p.incorrectas?.length > 0) ? 'MULTIPLE' : 'SIMPLE',
                    // Para múltiple clásica, enviamos opciones ya barajadas al cliente si queremos que todos vean el mismo orden aleatorio
                    // O lo dejamos al cliente. ThinkHootGame actual maneja 'opcionesFijas'
                    opcionesFijas: (p.incorrectas?.length > 0) ? [p.correcta || p.respuesta, ...p.incorrectas].sort(() => Math.random() - 0.5) : []
                };
            }
            // Si es PRO, ya tiene la estructura correcta (tipo, bloques, etc)
            return p;
        });

        await setDoc(doc(db, "live_games", sala), { hostId: usuario.uid, recursoId: r.id, recursoTitulo: r.titulo, profesorNombre: r.profesorNombre, config: r.config, preguntas: pFin, estado: 'LOBBY', indicePregunta: 0, jugadores: {}, respuestasRonda: {}, timestamp: new Date() });
        setHostGameData({ ...hostGameData, codigoSala: sala, fase: 'LIVE' });
    };

    const abrirResultados = async (r) => { setRecursoResultados(r); setListaResultados([]); const q = query(collection(db, "ranking"), where("recursoId", "==", r.id)); const s = await getDocs(q); setListaResultados(s.docs.map(d => d.data())); };
    const descargarCSV = () => { let csv = "Jugador,Puntos\n" + listaResultados.map(r => `${r.jugador},${r.aciertos || r.puntuacion}`).join("\n"); const l = document.createElement("a"); l.href = encodeURI("data:text/csv;charset=utf-8," + csv); l.download = "notas.csv"; l.click(); };
    const probarJuego = (r) => { incrementarPopularidad(r); setRecursoProbando(r); };

    if (hostGameData?.fase === 'LIVE') return <ThinkHootGame isHost={true} codigoSala={hostGameData.codigoSala} usuario={usuario} onExit={() => setHostGameData(null)} />;
    if (recursoProbando) return <div style={{ background: '#2f3640', minHeight: '100vh' }}><div style={{ background: '#f1c40f', padding: '10px', textAlign: 'center' }}>MODO PRUEBA <button onClick={() => setRecursoProbando(null)} style={{ marginLeft: 20 }}>Cerrar</button></div><GamePlayer recurso={recursoProbando} usuario={usuario} alTerminar={() => setRecursoProbando(null)} /></div>;

    if (modoVista === 'ALUMNO') return (<div style={{ position: 'relative' }}><div style={{ position: 'fixed', top: 20, right: 20, zIndex: 9999 }}><button onClick={() => setModoVista('PROFESOR')} style={{ background: '#e74c3c', color: 'white', padding: '10px 20px', borderRadius: '30px', border: 'none', fontWeight: 'bold', boxShadow: '0 4px 15px rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}><LogOut size={20} /> SALIR MODO ALUMNO</button></div><StudentDashboard usuario={usuario} /></div>);

    // ==============================================================================
    //  RENDERIZADO PRINCIPAL
    // ==============================================================================
    return (
        <div style={{ padding: '20px', maxWidth: '1000px', margin: '0 auto', fontFamily: 'Arial', position: 'relative', minHeight: '100vh', background: '#e3f2fd' }}> {/* FONDO AZUL CLARO */}

            {/* --- MENÚ HAMBURGUESA --- */}
            <button onClick={toggleMenu} style={styles.menuButton}><Menu size={32} color="#2c3e50" /></button>
            {menuOpen && (<div style={styles.menuOverlay} onClick={toggleMenu}><div style={styles.menuPanel} onClick={(e) => e.stopPropagation()}>
                <div style={styles.menuHeader}><h2 style={styles.menuTitle}>Menú</h2><button onClick={toggleMenu} style={styles.closeButton}><X size={28} color="#2c3e50" /></button></div>
                <ul style={styles.menuList}>
                    <li style={styles.menuItem} onClick={() => navegar('CLASICO')}>Recursos Clásicos</li>
                    <li style={styles.menuItem} onClick={() => navegar('PRO')}>Recursos PRO</li>
                    <li style={styles.menuItem} onClick={() => navegar('BUSCADOR_GLOBAL')}>Buscador de Recursos</li>
                    <li style={styles.menuItem} onClick={() => navegar('HERRAMIENTAS')}>Herramientas del Profesor</li>
                    <li style={styles.menuItem} onClick={() => navegar('LEGAL')}>Privacidad y Datos</li>
                    <li style={styles.menuItem} onClick={() => navegar('INFO')}>Más Información</li>
                </ul>
                <div style={styles.menuFooter}>PiKT © 2024</div></div></div>)}

            {/* BARRA SUPERIOR (PERFIL, AYUDA) */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '15px', marginBottom: '30px', paddingBottom: '15px', marginTop:'60px' }}>
                <button onClick={() => setMostrandoAyudaDashboard(true)} style={styles.helpButtonTop} title="Ayuda"><HelpCircle size={24} color="#1565C0"/></button>
                <button onClick={() => setModoVista('ALUMNO')} style={{ background: 'white', color: '#1565C0', border: 'none', padding: '8px 16px', borderRadius: '20px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 'bold', boxShadow:'0 2px 5px rgba(0,0,0,0.1)' }}><Eye size={18} /> Vista Alumno</button>
                <button onClick={() => setMostrandoPerfil(true)} style={{ background: 'white', color: '#8E24AA', border: 'none', padding: '8px 16px', borderRadius: '20px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 'bold', boxShadow:'0 2px 5px rgba(0,0,0,0.1)' }}><UserCircle size={18} /> Mi Perfil</button>
            </div>

            {/* --- CONTENIDO SEGÚN MODO --- */}

            {/* 1. BUSCADOR GLOBAL */}
            {modoDashboard === 'BUSCADOR_GLOBAL' && (
                <GlobalSearch usuario={usuario} onCopy={copiarRecurso} tiposJuegos={TIPOS_JUEGOS} onInspect={setRecursoInspeccionando} />
            )}

            {/* 2. HERRAMIENTAS */}
            {modoDashboard === 'HERRAMIENTAS' && (
                <TeacherTools />
            )}

            {/* 3. LEGAL / INFO */}
            {(modoDashboard === 'LEGAL' || modoDashboard === 'INFO') && (
                <div style={{ padding: '40px', background: 'white', borderRadius: '15px', textAlign: 'center' }}>
                    <h2 style={{color:'#2c3e50'}}>{modoDashboard === 'LEGAL' ? 'Política de Privacidad' : 'Más Información'}</h2>
                    <p style={{color:'#777'}}>Contenido informativo pendiente de redacción.</p>
                </div>
            )}

            {/* 4. MODOS CLÁSICO Y PRO (RECURSOS) */}
            {(modoDashboard === 'CLASICO' || modoDashboard === 'PRO') && (
                <>
                    {modoDashboard === 'CLASICO' && (<div style={{ marginBottom: '20px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>{Object.values(TIPOS_JUEGOS).map(j => <button key={j.id} onClick={() => setJuegoSeleccionado(j.id)} style={{ padding: '8px 16px', borderRadius: '20px', border: 'none', background: juegoSeleccionado === j.id ? j.color : 'white', color: juegoSeleccionado === j.id ? 'white' : '#555', cursor: 'pointer', fontWeight: 'bold', boxShadow:'0 2px 5px rgba(0,0,0,0.1)' }}>{j.label}</button>)}</div>)}
                    {modoDashboard === 'PRO' && (<div style={{ marginBottom: '20px', textAlign: 'center' }}><h1 style={{ color: '#9C27B0', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}><Zap size={32} /> ThinkHoot PRO</h1></div>)}
                    
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}><h2>{vista === 'MIS_RECURSOS' ? `Mis Recursos` : `Biblioteca`}</h2><div style={{ display: 'flex', gap: '10px' }}>{(juegoSeleccionado !== 'QUESTION_SENDER' && modoDashboard === 'CLASICO') && <button onClick={() => setVista(vista === 'MIS_RECURSOS' ? 'BIBLIOTECA' : 'MIS_RECURSOS')} style={{ background: '#27ae60', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '8px', cursor: 'pointer' }}><Globe size={18} /> {vista === 'MIS_RECURSOS' ? "Ir a Biblioteca" : "Mis Recursos"}</button>}{vista === 'MIS_RECURSOS' && <button onClick={iniciarCreacion} style={{ display: 'flex', alignItems: 'center', gap: '5px', background: '#2196F3', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '8px', cursor: 'pointer' }}><Plus size={18} /> Crear Nuevo</button>}</div></div>
                    
                    {vista === 'BIBLIOTECA' && (<div style={{ background: '#f9f9f9', padding: '15px', borderRadius: '10px', marginBottom: '20px', display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}><span style={{ fontWeight: 'bold', color: '#666' }}><Search size={16} /> Filtros:</span><input placeholder="Tema..." value={filtrosInput.tema} onChange={e => setFiltrosInput({ ...filtrosInput, tema: e.target.value })} style={inputFilter} /><input placeholder="País" value={filtrosInput.pais} onChange={e => setFiltrosInput({ ...filtrosInput, pais: e.target.value })} style={inputFilter} /><input placeholder="Región" value={filtrosInput.region} onChange={e => setFiltrosInput({ ...filtrosInput, region: e.target.value })} style={inputFilter} /><input placeholder="Población" value={filtrosInput.poblacion} onChange={e => setFiltrosInput({ ...filtrosInput, poblacion: e.target.value })} style={inputFilter} /><button onClick={ejecutarBusqueda} style={{ background: '#2980b9', color: 'white', border: 'none', padding: '8px 15px', borderRadius: '5px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}><Search size={16} /> Buscar</button><button onClick={limpiarBusqueda} style={{ background: '#bdc3c7', padding: '8px', borderRadius: '5px', border: 'none', cursor: 'pointer' }} title="Limpiar"><RotateCcw size={16} /></button></div>)}
                    
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
                        {(vista === 'MIS_RECURSOS' ? recursos : getRecursosFiltrados()).map((r, i) => (<div key={r.id || i} style={{ background: 'white', padding: '20px', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', borderLeft: `6px solid ${TIPOS_JUEGOS[juegoSeleccionado].color}`, position: 'relative' }}>{juegoSeleccionado !== 'QUESTION_SENDER' && <div style={{ position: 'absolute', top: '10px', right: '10px', background: '#f1c40f', padding: '2px 8px', borderRadius: '10px', fontSize: '12px', fontWeight: 'bold' }}><Users size={12} /> {r.playCount || 0}</div>}<h3 style={{ margin: '0 0 5px 0' }}>{r.titulo}</h3><div style={{ display: 'flex', gap: '5px', marginTop: '10px' }}>{juegoSeleccionado === 'QUESTION_SENDER' ? (<><button onClick={() => abrirEdicion(r)} style={btnStyle('#E3F2FD', '#1565C0')}><Pencil size={18} /></button><button onClick={() => setModalCopiarApp(r)} style={btnStyle('#E8F5E9', '#2E7D32')}><Send size={18} /></button><button onClick={() => eliminarRecurso(r.id)} style={btnStyle('#FFEBEE', '#C62828')}><Trash2 size={18} /></button></>) : (vista === 'MIS_RECURSOS' ? (<>{juegoSeleccionado === 'THINKHOOT' ? (<button title="Lanzar en Vivo" onClick={() => prepararJuegoEnVivo(r)} style={{ ...btnStyle('#9C27B0', 'white'), fontWeight: 'bold' }}><Zap size={18} /></button>) : (<button onClick={() => probarJuego(r)} style={btnStyle('#E1BEE7', '#8E24AA')}><Gamepad2 size={18} /></button>)}<button onClick={() => mostrarCodigo(r)} style={btnStyle('#FFF3E0', '#FF9800')}><Key size={18} /></button><button onClick={() => abrirEdicion(r)} style={btnStyle('#E3F2FD', '#1565C0')}><Pencil size={18} /></button><button onClick={() => abrirResultados(r)} style={btnStyle('#E8F5E9', '#2E7D32')}><BarChart2 size={18} /></button><button onClick={() => eliminarRecurso(r.id)} style={btnStyle('#FFEBEE', '#C62828')}><Trash2 size={18} /></button></>) : (<><button onClick={() => probarJuego(r)} style={{ ...btnStyle('#E1BEE7', '#8E24AA'), flex: 2 }}>Probar</button><button onClick={() => setRecursoInspeccionando(r)} style={btnStyle('#eee', '#333')}><Eye size={18} /></button><button onClick={() => copiarRecurso(r)} style={{ ...btnStyle('#27ae60', 'white'), flex: 2 }}>Copiar</button></>))}</div></div>))}
                        
                        {/* MENSAJE DE VACÍO + INSTRUCCIONES */}
                        {vista === 'MIS_RECURSOS' && recursos.length === 0 && !cargando && (
                            <div style={{ gridColumn: '1 / -1', padding: '40px', background: 'white', borderRadius: '15px', textAlign: 'center', boxShadow: '0 4px 15px rgba(0,0,0,0.05)' }}>
                                <FileText size={64} color="#bdc3c7" style={{ marginBottom: '20px' }} />
                                <h3 style={{ color: '#2c3e50' }}>No tienes recursos de {TIPOS_JUEGOS[juegoSeleccionado].label}</h3>
                                <p style={{ color: '#7f8c8d', marginBottom: '20px', maxWidth: '600px', margin: '0 auto 20px auto' }}>
                                    {INSTRUCCIONES_CREACION[juegoSeleccionado]}
                                </p>
                                <div style={{ display: 'flex', gap: '15px', justifyContent: 'center' }}>
                                    <button onClick={iniciarCreacion} style={{ ...actionBtnStyle('#2196F3'), padding: '10px 30px' }}>Crear el Primero</button>
                                    <button onClick={() => setVista('BIBLIOTECA')} style={{ ...actionBtnStyle('#27ae60'), padding: '10px 30px' }}>Buscar en Biblioteca</button>
                                </div>
                            </div>
                        )}
                    </div>
                </>
            )}

            {/* MODALES EDITORES */}
            {mostrandoCrear && <ModalOverlay onClose={() => setMostrandoCrear(false)}><h2>Nuevo {TIPOS_JUEGOS[juegoSeleccionado].label}</h2><input value={datosEditor.titulo} onChange={e => setDatosEditor({ ...datosEditor, titulo: e.target.value })} style={inputStyle} placeholder="Título" /><div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}><button onClick={() => { setMostrandoCrear(false); setMostrandoEditorManual(true); }} style={{ ...actionBtnStyle('#2196F3'), flex: 1 }}><Edit3 /> Manual</button>{juegoSeleccionado !== 'QUESTION_SENDER' && <><button onClick={procesarCreacionIA} style={{ ...actionBtnStyle('#673AB7'), flex: 1 }}><Bot /> IA</button><button onClick={handleFileUpload} style={{ ...actionBtnStyle('#107C41'), flex: 1 }}><FileSpreadsheet /> Excel</button><button onClick={handleOpenPicker} style={{ ...actionBtnStyle('#FFC107'), flex: 1, color: 'black' }}>Drive</button></>}</div></ModalOverlay>}
            {mostrandoEditorManual && <EditorManual datos={datosEditor} setDatos={setDatosEditor} configJuego={TIPOS_JUEGOS[juegoSeleccionado]} onClose={() => setMostrandoEditorManual(false)} onSave={guardarRecursoFinal} />}
            {mostrandoEditorPro && <EditorPro datos={datosEditor} setDatos={setDatosEditor} onClose={() => setMostrandoEditorPro(false)} onSave={guardarRecursoFinal} />}
            
            {/* MODAL AYUDA GLOBAL DASHBOARD */}
            {mostrandoAyudaDashboard && (
                <ModalOverlay onClose={() => setMostrandoAyudaDashboard(false)}>
                    <h2><Info style={{verticalAlign:'middle'}}/> ¿Qué puedo hacer aquí?</h2>
                    <ul style={{textAlign:'left', lineHeight:'1.8', color:'#555'}}>
                        <li><b>Crear Recursos:</b> Diseña juegos educativos (Pasapalabra, Quiz, etc.).</li>
                        <li><b>Biblioteca:</b> Busca y copia actividades de otros profesores.</li>
                        <li><b>Jugar en Vivo:</b> Lanza ThinkHoot para competir en clase.</li>
                        <li><b>Analizar:</b> Revisa las notas y resultados de tus alumnos.</li>
                        <li><b>Question Sender:</b> Recibe preguntas de tus estudiantes.</li>
                    </ul>
                    <button onClick={() => setMostrandoAyudaDashboard(false)} style={actionBtnStyle('#2c3e50')}>Entendido</button>
                </ModalOverlay>
            )}

            {/* OTROS MODALES */}
            {recursoResultados && <ModalOverlay onClose={() => setRecursoResultados(null)}><h2>Resultados</h2><button onClick={descargarCSV} style={{ background: '#4CAF50', color: 'white', padding: '10px', border: 'none', marginBottom: '10px' }}>Descargar CSV</button><div style={{ maxHeight: '300px', overflowY: 'auto' }}><table style={{ width: '100%' }}><thead><tr><th>Alumno</th><th>Nota</th></tr></thead><tbody>{listaResultados.map((r, i) => <tr key={i}><td>{r.jugador}</td><td>{r.aciertos || r.puntuacion}</td></tr>)}</tbody></table></div></ModalOverlay>}
            {modalCopiarApp && <ModalOverlay onClose={() => setModalCopiarApp(null)}><h2>Mandar a App</h2><p>Crear recurso en <b>{TIPOS_JUEGOS[modalCopiarApp.targetGame]?.label}</b></p><button onClick={confirmarCopiaAplicacion} style={actionBtnStyle('#27ae60')}>Confirmar</button></ModalOverlay>}
            {hostGameData?.fase === 'CONFIG_HOST' && (<ModalOverlay onClose={() => setHostGameData(null)}><h2>📡 Lanzar en Vivo</h2><select value={hostGameData.hojaElegida} onChange={e => setHostGameData({ ...hostGameData, hojaElegida: e.target.value })} style={{ width: '100%', padding: '10px', marginBottom: '20px' }}>{hostGameData.hojasDisponibles.map(h => <option key={h} value={h}>{h}</option>)}</select><button onClick={confirmarLanzamientoHost} style={{ width: '100%', padding: '15px', background: '#9C27B0', color: 'white', border: 'none', borderRadius: '5px' }}>🚀 GENERAR CÓDIGO</button></ModalOverlay>)}
            {recursoInspeccionando && <ModalOverlay onClose={() => setRecursoInspeccionando(null)}><h2>{recursoInspeccionando.titulo}</h2><div style={{ maxHeight: '400px', overflowY: 'auto' }}>{recursoInspeccionando.hojas.map((h, i) => <div key={i}><h4>{h.nombreHoja}</h4><ul>{h.preguntas.map((p, j) => <li key={j}><b>{p.letra ? `Letra ${p.letra}: ` : ''}{p.pregunta}</b> &rarr; {p.respuesta || p.correcta}</li>)}</ul></div>)}</div><button onClick={() => { copiarRecurso(recursoInspeccionando); setRecursoInspeccionando(null) }} style={actionBtnStyle('#27ae60')}>Copiar</button></ModalOverlay>}
            {mostrandoPerfil && (<UserProfile usuario={usuario} perfil={perfilProfesor} onClose={() => setMostrandoPerfil(false)} onUpdate={() => cargarPerfilProfesor()} />)}
            <input type="file" id="input-excel-oculto" accept=".xlsx" style={{ display: 'none' }} onChange={handleFileUpload} />
        </div>
    );
}

const ModalOverlay = ({ children, onClose }) => (<div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}><div style={{ background: 'white', padding: '30px', borderRadius: '12px', width: '90%', maxWidth: '500px', position: 'relative' }}><button onClick={onClose} style={{ position: 'absolute', top: '10px', right: '10px', border: 'none', background: 'none', cursor: 'pointer' }}><X /></button>{children}</div></div>);
const btnStyle = (bg, color) => ({ flex: 1, padding: '8px', background: bg, color: color, border: 'none', borderRadius: '6px', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center' });
const actionBtnStyle = (bg) => ({ padding: '10px 20px', background: bg, color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', fontWeight: 'bold' });
const inputStyle = { width: '100%', padding: '10px', borderRadius: '5px', border: '1px solid #ccc', boxSizing: 'border-box', marginBottom: '10px' };
const inputFilter = { padding: '8px', borderRadius: '5px', border: '1px solid #ccc', fontSize: '13px', width: '120px' };
const styles = { menuButton: { position: 'absolute', top: '20px', left: '20px', background: '#ecf0f1', border: '1px solid #bdc3c7', borderRadius: '8px', padding: '8px', cursor: 'pointer', zIndex: 50 }, helpButtonTop: { background: 'white', border: 'none', borderRadius: '50%', width:'40px', height:'40px', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', boxShadow:'0 2px 5px rgba(0,0,0,0.1)' }, menuOverlay: { position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(0, 0, 0, 0.5)', zIndex: 9999, display: 'flex', justifyContent: 'flex-start' }, menuPanel: { width: '80%', maxWidth: '300px', height: '100%', backgroundColor: 'white', boxShadow: '2px 0 10px rgba(0,0,0,0.3)', display: 'flex', flexDirection: 'column', animation: 'slideIn 0.3s ease-out' }, menuHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px', borderBottom: '1px solid #eee' }, menuTitle: { margin: 0, color: '#2c3e50', fontSize: '1.5rem', fontWeight: 'bold' }, closeButton: { background: 'transparent', border: 'none', cursor: 'pointer' }, menuList: { listStyle: 'none', padding: '0', margin: '0', flex: 1 }, menuItem: { padding: '20px', borderBottom: '1px solid #f0f0f0', color: '#34495e', fontSize: '1.1rem', fontWeight: '500', cursor: 'pointer' }, menuFooter: { padding: '20px', textAlign: 'center', color: '#bdc3c7', fontSize: '0.8rem', borderTop: '1px solid #eee' } };
const styleSheet = document.createElement("style"); styleSheet.innerText = `@keyframes slideIn { from { transform: translateX(-100%); } to { transform: translateX(0); } }`; document.head.appendChild(styleSheet);