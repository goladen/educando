import { useState, useEffect } from 'react';
import { db } from './firebase';
import { collection, query, where, getDocs, deleteDoc, doc, addDoc, updateDoc, getDoc, setDoc, orderBy } from 'firebase/firestore';
import { Trash2, Plus, FileSpreadsheet, Bot, BarChart2, Save, X, Pencil, Key, Gamepad2, Edit3, Globe, Search, Copy, Eye, Users, RotateCcw, Send, Zap, UserCircle, LogOut, Menu, HelpCircle, Shield, Info, FileText, Calculator, Medal, Crosshair } from 'lucide-react';
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
import EditorMathLive from './components/EditorMathLive';
import MathLive from './MathLive';
import OlympicLive from './OlympicLive';
import CazaBurbujasGame from './CazaBurbujasGame';
import PikatronRun from './PikatronRun';
import SopaDeLetrasGame from './SopaDeLetrasGame';
import TextWordleGame from './TextWordleGame';
import SintaxisGame from './SintaxisGamen2';


import { MousePointer2, Rocket, Search as SearchIcon } from 'lucide-react';
import InformesJuegos from './components/InformesJuegos2';
import EditorProBurbujasPikatron from './components/EditorProBurbujasPikatron';
import EditorQuestionSender from './components/EditorQuestionSender';
import ModalMigrarQsender from './components/ModalMigrarQsender';
import MathWordleGame from './MathWordleGame';
import EditorWordle from './components/EditorWordle';
import EditorOlympic from './components/EditorOlympic';
import EditorSintaxis from './components/EditorSintaxis';
import EditorEtiquetas from './components/EditorEtiquetas';
import * as XLSX from 'xlsx'; // <--- IMPORTANTE
// ==============================================================================
//  ZONA DE CLAVES (SEGURA)
// ==============================================================================
const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const GOOGLE_DEVELOPER_KEY = import.meta.env.VITE_GOOGLE_DEVELOPER_KEY;
// ==============================================================================
const TIPOS_JUEGOS = {
    PASAPALABRA: { id: 'PASAPALABRA', label: 'Pasapalabra', color: '#3F51B5', camposConfig: [{ key: 'tiempoTotal', label: 'Tiempo Rosco (seg)', type: 'number', default: 150 }] },
    CAZABURBUJAS: { id: 'CAZABURBUJAS', label: 'Burbujas y Pikatron', color: '#E91E63', camposConfig: [{ key: 'tiempoPregunta', label: 'Tiempo/preg (seg)', type: 'number', default: 20 }, { key: 'numPreguntas', label: 'Nº Preguntas', type: 'number', default: 10 }, { key: 'puntosAcierto', label: 'Pts Acierto', type: 'number', default: 10 }, { key: 'puntosFallo', label: 'Pts Fallo', type: 'number', default: 2 }] },
    
    // --- AÑADE ESTA LÍNEA ---
    MATHLIVE: { id: 'MATHLIVE', label: 'MathLive', color: '#009688', camposConfig: [] },
    // --
    // --- AÑADE ESTA LÍNEA PARA SOLUCIONAR EL ERROR ---


    OLYMPICLIVE: { id: 'OLYMPICLIVE', label: 'Olympic Live', color: '#D32F2F', camposConfig: [] },

    // ------
    // --- AÑADIR WORDLE AQUÍ (Color Verde) ---
    WORDLE: { id: 'WORDLE', label: 'Wordle y sopa de letras', color: '#2E7D32', camposConfig: [] },
    // ---
    // --- NUEVO: SOPA DE LETRAS ---
    //SOPA: { id: 'SOPA', label: 'Sopa de Letras', color: '#e67e22', camposConfig: [] },
    APAREJADOS: { id: 'APAREJADOS', label: 'AparejaDOS', color: '#FF9800', camposConfig: [{ key: 'tiempoTotal', label: 'Tiempo Total (seg)', type: 'number', default: 60 }, { key: 'numParejas', label: 'Nº Parejas', type: 'number', default: 8 }, { key: 'puntosPareja', label: 'Pts Pareja', type: 'number', default: 10 }] },
    THINKHOOT: { id: 'THINKHOOT', label: 'Pi-Live', color: '#9C27B0', camposConfig: [{ key: 'tiempoPregunta', label: 'Tiempo/preg (seg)', type: 'number', default: 30 }, { key: 'numPreguntas', label: 'Nº Preguntas', type: 'number', default: 10 }, { key: 'puntosMax', label: 'Puntos Max', type: 'number', default: 120 }, { key: 'puntosMin', label: 'Puntos Min', type: 'number', default: 30 }] },
    RULETA: { id: 'RULETA', label: 'La Ruleta', color: '#f1c40f', camposConfig: [{ key: 'tiempoTurno', label: 'Tiempo Turno (s)', type: 'number', default: 20 }] },
    QUESTION_SENDER: { id: 'QUESTION_SENDER', label: 'Question Sender', color: '#2c3e50', camposConfig: [{ key: 'numPreguntas', label: 'Preguntas a pedir', type: 'number', default: 3 }] },
    // Añade dentro del objeto TIPOS_JUEGOS:
    ETIQUETAS: { id: 'ETIQUETAS', label: 'Etiquetas', color: '#e74c3c', camposConfig: [] },
SINTAXIS: { id: 'SINTAXIS', label: 'Sintaxis', color: '#3498db', camposConfig: [] }


};

// MENSAJES DE AYUDA VACÍO
const INSTRUCCIONES_CREACION = {
    PASAPALABRA: "Para crear un Pasapalabra, define preguntas para cada letra del abecedario. Puedes hacerlo manual o usar la IA.",
    CAZABURBUJAS: "Crea preguntas de opción múltiple. Los alumnos deberán explotar la burbuja correcta.",
    THINKHOOT: "Diseña un quiz competitivo tipo Kahoot. Preguntas rápidas y ranking en tiempo real.",
    RULETA: "Define una frase oculta y preguntas cuyas respuestas den pistas para resolverla.",
    APAREJADOS: "Crea parejas de conceptos (Ej: País - Capital). Los alumnos deberán unirlas.",
    QUESTION_SENDER: "Crea un buzón para que tus alumnos te envíen preguntas desde sus dispositivos.",
    OLYMPICLIVE: "Combina minijuegos y rondas de matemáticas en un evento en vivo espectacular." // <--- AÑADE ESTO




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
    const [mostrandoEditorMathLive, setMostrandoEditorMathLive] = useState(false);
    const [mostrandoEditorBurbujasPikatron, setMostrandoEditorBurbujasPikatron] = useState(false);
    const [mostrandoMathWordle, setMostrandoMathWordle] = useState(false);
    const [mostrandoEditorWordle, setMostrandoEditorWordle] = useState(false);
    const [mostrandoEditorOlympic, setMostrandoEditorOlympic] = useState(false); // <--- AÑADE ESTA LÍNEA
    // Añade junto a los otros useState de editores:
    const [mostrandoEditorSintaxis, setMostrandoEditorSintaxis] = useState(false);
    const [mostrandoEditorEtiquetas, setMostrandoEditorEtiquetas] = useState(false);
    // Añade este estado junto a los demás en ProfesorDashboard
    const [qSenderAMigrar, setQsenderAMigrar] = useState(null);

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
    const [modoDashboard, setModoDashboard] = useState('CLASICO'); // 'CLASICO', 'PRO','LIVE', 'BUSCADOR_GLOBAL', 'HERRAMIENTAS', 'LEGAL', 'INFO'
    const [mostrandoAyudaDashboard, setMostrandoAyudaDashboard] = useState(false); // <--- Ayuda Global
    const [recursoParaElegirModo, setRecursoParaElegirModo] = useState(null);
    const [openPicker] = useDrivePicker();

    useEffect(() => {
        if (usuario) {
            cargarPerfilProfesor();
            setRecursos([]);
            setBibliotecaRecursos([]);
            // Solo cargamos recursos si estamos en modo Clásico o PRO
            if (modoDashboard === 'CLASICO' || modoDashboard === 'PRO' || modoDashboard === 'LIVE') {
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
                if (modoDashboard === 'PRO') {
                    // CAMBIO AQUÍ: Aceptamos 'PRO' y 'PRO-BURBUJAS'
                    return r.tipo === 'PRO' || r.tipo === 'PRO-BURBUJAS' || r.tipo === 'OLYMPIC' || r.tipo === 'SINTAXIS'||r.tipo === 'ETIQUETAS';
                }

                if (modoDashboard === 'LIVE') {
                    return (r.tipo === 'PRO' || r.tipo === 'OLYMPIC') &&
                        (r.tipoJuego === 'THINKHOOT' || r.tipoJuego === 'MATHLIVE' || r.tipoJuego === 'OLYMPICLIVE');
                }


                // En clásico mostramos los que NO sean de ningún tipo PRO
                return !r.tipo || (r.tipo !== 'PRO' && r.tipo !== 'PRO-BURBUJAS' && r.tipo !== 'OLYMPIC');
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
                if (modoDashboard === 'PRO') {
                    // CAMBIO AQUÍ TAMBIÉN
                    return r.tipo === 'PRO' || r.tipo === 'PRO-BURBUJAS' || r.tipo === 'OLYMPIC' || r.tipo === 'SINTAXIS' || r.tipo === 'ETIQUETAS';
                }

                if (modoDashboard === 'LIVE') {
                    return (r.tipo === 'PRO' || r.tipo === 'OLYMPIC') &&
                        (r.tipoJuego === 'THINKHOOT' || r.tipoJuego === 'MATHLIVE' || r.tipoJuego === 'OLYMPICLIVE');
                }

                return !r.tipo || (r.tipo !== 'PRO' && r.tipo !== 'PRO-BURBUJAS' && r.tipo !== 'OLYMPIC');
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
        if (destino === 'PRO') setJuegoSeleccionado('CAZABURBUJAS');
        if (destino === 'CLASICO') setJuegoSeleccionado('PASAPALABRA');
        if (destino === 'LIVE') setJuegoSeleccionado('THINKHOOT');
        if (destino === 'INFORMES') setJuegoSeleccionado('PASAPALABRA'); // reset opcional

    };

    const ejecutarBusqueda = () => setFiltrosActivos(filtrosInput);
    const limpiarBusqueda = () => { const v = { pais: '', region: '', poblacion: '', tema: '' }; setFiltrosInput(v); setFiltrosActivos(v); };
    const incrementarPopularidad = async (r) => { try { await updateDoc(doc(db, "resources", r.id), { playCount: (r.playCount || 0) + 1 }); } catch (e) { } };

    const copiarRecurso = async (r) => {
        if (!confirm(`¿Copiar "${r.titulo}"?`)) return;
        try { const c = { ...r, profesorUid: usuario.uid, profesorNombre: perfilProfesor?.nombre || usuario.displayName, titulo: `${r.titulo} (Copia)`, playCount: 0, isPrivate: true, origen: 'biblioteca', fechaCreacion: new Date(), accessCode: generarCodigoAcceso() }; delete c.id; await addDoc(collection(db, "resources"), c); alert("¡Copiado!"); setVista('MIS_RECURSOS'); } catch (e) { alert(e.message); }
    };

    // --- FUNCIÓN PARA EL EDITOR CLÁSICO (NO TOCAR) ---
    const iniciarCreacion = () => {
        if (modoDashboard === 'PRO' || modoDashboard === 'LIVE') {
            if (juegoSeleccionado === 'CAZABURBUJAS') return iniciarCreacionBurbujasPikatron();
            if (juegoSeleccionado === 'THINKHOOT') return iniciarCreacionPiLive();
            if (juegoSeleccionado === 'MATHLIVE') return iniciarCreacionMathLive();
            if (juegoSeleccionado === 'WORDLE') return iniciarCreacionWordle(); // <--- AÑADIR ESTO
            if (juegoSeleccionado === 'OLYMPICLIVE') return iniciarCreacionOlympic();
            if (juegoSeleccionado === 'SINTAXIS') return iniciarCreacionSintaxis();
            if (juegoSeleccionado === 'ETIQUETAS') return iniciarCreacionEtiquetas();
        }


        const conf = {};
        if (TIPOS_JUEGOS[juegoSeleccionado]) {
            TIPOS_JUEGOS[juegoSeleccionado].camposConfig.forEach(c => conf[c.key] = c.default);
        }
        const nuevoRecurso = {
            id: null, titulo: '', temas: '', profesorNombre: (perfilProfesor?.nombre) || usuario.displayName,
            pais: perfilProfesor?.pais || '', region: perfilProfesor?.region || '', poblacion: perfilProfesor?.poblacion || '',
            config: conf, hojas: [{ nombreHoja: 'Nivel 1', preguntas: [] }], isPrivate: juegoSeleccionado === 'QUESTION_SENDER'
        };
        setDatosEditor(nuevoRecurso);
        setMostrandoCrear(true); // Abre el modal de opciones clásico (Manual/IA/Excel)
    };

    // --- NUEVAS FUNCIONES PARA LOS BOTONES PRO ---
    const iniciarCreacionWordle = () => {
        const nuevoRecurso = {
            id: null, titulo: '', temas: '', profesorNombre: usuario.displayName,
            tipo: 'PRO',
            tipoJuego: 'WORDLE', // Importante
            config: { tiempoTotal: 300, numPalabras: 5, aleatorio: true },
            hojas: [{ nombreHoja: 'Nivel 1', palabras: [] }],
            isPrivate: false
        };
        setDatosEditor(nuevoRecurso);
        setMostrandoEditorWordle(true);
    };
    const iniciarCreacionSintaxis = () => {
        const nuevoRecurso = {
            id: null, titulo: '', temas: '',
            profesorNombre: perfilProfesor?.nombre || usuario.displayName,
            pais: perfilProfesor?.pais || '',
            region: perfilProfesor?.region || '',
            poblacion: perfilProfesor?.poblacion || '',
            tipo: 'SINTAXIS', tipoJuego: 'SINTAXIS',
            hojas: [], isPrivate: false,
        };
        setDatosEditor(nuevoRecurso);
        setMostrandoEditorSintaxis(true);
    };

    const iniciarCreacionEtiquetas = () => {
        const nuevoRecurso = {
            id: null, titulo: '', temas: '',
            profesorNombre: perfilProfesor?.nombre || usuario.displayName,
            pais: perfilProfesor?.pais || '',
            region: perfilProfesor?.region || '',
            poblacion: perfilProfesor?.poblacion || '',
            tipo: 'ETIQUETAS', tipoJuego: 'ETIQUETAS',
            hojas: [], isPrivate: false,
        };
        setDatosEditor(nuevoRecurso);
        setMostrandoEditorEtiquetas(true);
    };

    // 1. CREAR PILIVE (THINKHOOT PRO)
    const iniciarCreacionPiLive = () => {
        const nuevoRecurso = {
            id: null, titulo: '', temas: '', profesorNombre: usuario.displayName,
            tipo: 'PRO', tipoJuego: 'THINKHOOT', // Forzamos ThinkHoot
            config: { numPreguntas: 10, tiempoPregunta: 30, puntosMax: 100, puntosMin: 20, aleatorio: true },
            hojas: [{ nombreHoja: 'Grupo 1', preguntas: [] }]
        };
        setDatosEditor(nuevoRecurso);
        setMostrandoEditorPro(true);
    };

    // 2. CREAR BURBUJAS/PIKATRON PRO (TU NUEVO EDITOR)
    const iniciarCreacionBurbujasPikatron = () => {
        // FORZAMOS LA VISTA DE CAZABURBUJAS PARA VER EL RECURSO AL TERMINAR
        setJuegoSeleccionado('CAZABURBUJAS');

        const nuevoRecurso = {
            id: null, titulo: '', temas: '', profesorNombre: usuario.displayName,
            tipo: 'PRO-BURBUJAS',
            tipoJuego: 'CAZABURBUJAS', // Siempre asociado a este ID de juego
            config: { numPreguntas: 10, tiempoPregunta: 20, puntosAcierto: 10, puntosFallo: 2, aleatorio: true },
            hojas: [{ nombreHoja: 'Nivel 1', preguntas: [] }]
        };
        setDatosEditor(nuevoRecurso);
        setMostrandoEditorBurbujasPikatron(true);
    };

    // 3. CREAR MATHLIVE (YA LO TIENES, PERO LO REPASAMOS)
    const iniciarCreacionMathLive = () => {
        const conf = {
            isMathLive: true,
            mathCount: 8, mathTime: 30, mathPuntosMax: 30, mathPuntosMin: 20,
            mathTypes: ['POSITIVOS'], mathOps: ['SUMA'], mathMin: 1, mathMax: 10,
            aleatorio: true, numPreguntas: 4
        };
        const nuevoRecurso = {
            id: null, titulo: '', temas: '', profesorNombre: usuario.displayName,
            tipo: 'PRO',
            tipoJuego: 'MATHLIVE', // <--- CAMBIA ESTO (Antes ponía 'THINKHOOT')
            config: conf, hojas: [{ nombreHoja: 'Grupo 1', preguntas: [] }], isPrivate: false
        };
        setDatosEditor(nuevoRecurso);
        setMostrandoEditorMathLive(true);
    };


    // 4. CREAR OLYMPIC LIVE
    const iniciarCreacionOlympic = () => {
        const conf = {
            usarMates: true,
            mathCount: 8, mathTime: 30, mathPuntosMax: 30, mathPuntosMin: 20,
            mathTypes: ['POSITIVOS'], mathOps: ['SUMA'], mathMin: 1, mathMax: 10,
            aleatorio: true, numPreguntas: 4
        };
        const nuevoRecurso = {
            id: null, titulo: '', temas: '', profesorNombre: usuario.displayName,
            tipo: 'OLYMPIC', // <-- Clave para diferenciarlo
            tipoJuego: 'OLYMPICLIVE',
            config: conf, hojas: [{ nombreHoja: 'Rondas', preguntas: [] }], isPrivate: false
        };
        setDatosEditor(nuevoRecurso);
        setMostrandoEditorOlympic(true);
    };


    const abrirEdicion = async (recursoLocal) => {
        try {
            const docRef = doc(db, "resources", recursoLocal.id);
            const docSnap = await getDoc(docRef);

            let dataFresca;
            if (docSnap.exists()) {
                dataFresca = { ...docSnap.data(), id: docSnap.id };
            } else {
                alert("El recurso no existe, usando copia local.");
                dataFresca = JSON.parse(JSON.stringify(recursoLocal));
            }

            if (!dataFresca.hojas) dataFresca.hojas = [{ nombreHoja: 'General', preguntas: [] }];
            if (!dataFresca.config) dataFresca.config = {};

            setDatosEditor(dataFresca);
            // ... dentro de abrirEdicion, después de setDatosEditor(dataFresca) ...

            if (dataFresca.tipo === 'PRO-BURBUJAS') {
                setMostrandoEditorBurbujasPikatron(true);
            }
            else if (dataFresca.tipo === 'OLYMPIC') {
                setMostrandoEditorOlympic(true);
            }

            else if (dataFresca.tipo === 'PRO') {
                // PRIMERO comprobamos el subtipo
                if (dataFresca.config?.isMathLive) {
                    setMostrandoEditorMathLive(true);
                }
                else if (dataFresca.tipoJuego === 'WORDLE') { // <--- AHORA SÍ ENTRA AQUÍ
                    setMostrandoEditorWordle(true);
                }
                else {
                    setMostrandoEditorPro(true);
                }
            }
            else if (dataFresca.tipoJuego === 'SINTAXIS') {
                setMostrandoEditorSintaxis(true);
            }
            else if (dataFresca.tipoJuego === 'ETIQUETAS') {
                setMostrandoEditorEtiquetas(true);
            }
            else {
                setMostrandoEditorManual(true); // Clásico
            }


                                 
            

        } catch (error) {
            console.error(error);
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

        // --- VALIDACIÓN DIFERENCIADA POR TIPO DE JUEGO ---

        // CASO 1: WORDLE (Validamos 'palabras')
        if (datosEditor.tipoJuego === 'WORDLE') {
            // Usamos ?. para seguridad, por si alguna hoja no tuviera el array
            const totalPalabras = datosEditor.hojas.reduce((a, h) => a + (h.palabras?.length || 0), 0);
            if (totalPalabras === 0) return alert("Añade al menos una palabra a la lista.");
        }

        // CASO 2: QUESTION SENDER (No requiere preguntas iniciales)
        else if (juegoSeleccionado === 'QUESTION_SENDER') {
            // Pasa sin validar contenido, ya que se llena después
        }

        


        // CASO 3: RESTO DE JUEGOS (Validamos 'preguntas' o generador)
        else {
            // IMPORTANTE: Usamos (h.preguntas?.length || 0) para evitar el error "undefined reading length"
            const totalPreguntasManuales = datosEditor.hojas.reduce((a, h) => a + (h.preguntas?.length || 0), 0);

            const esProBurbujas = datosEditor.tipo === 'PRO-BURBUJAS';
            const tieneGeneradorMath = datosEditor.config?.mathCount > 0;

            if (esProBurbujas && tieneGeneradorMath) {
                // Válido: Tiene generador matemático activado
            } else if (totalPreguntasManuales === 0) {
                return alert("Añade preguntas manuales o configura el generador.");
            }
        }

        // --- GUARDADO EN FIREBASE ---
        try {
            const dataToSave = {
                ...datosEditor,
                profesorUid: usuario.uid,
                tipoJuego: juegoSeleccionado, // Aseguramos el tipo seleccionado
                fechaCreacion: new Date()
            };

            delete dataToSave.id;

            // Ajustes específicos al guardar
            if (juegoSeleccionado === 'QUESTION_SENDER') {
                dataToSave.hojasCodes = datosEditor.hojas.map(h => h.accessCode).filter(c => c);
                dataToSave.targetGame = datosEditor.targetGame || 'PASAPALABRA';
            }

            if (datosEditor.id) {
                await updateDoc(doc(db, "resources", datosEditor.id), dataToSave);
                alert("Actualizado correctamente");
            } else {
                dataToSave.accessCode = generarCodigoAcceso();
                dataToSave.playCount = 0;
                dataToSave.origen = 'manual';
                await addDoc(collection(db, "resources"), dataToSave);
                alert("Recurso creado correctamente");
            }

            // Cerrar todos los editores
            setMostrandoEditorManual(false);
            setMostrandoEditorPro(false);
            setMostrandoEditorMathLive(false);
            setMostrandoEditorBurbujasPikatron(false);
            setMostrandoEditorWordle(false); // <--- Cerramos el de Wordle
            setMostrandoEditorOlympic(false);
            setMostrandoEditorSintaxis(false);
            cargarRecursosPropios();
        } catch (e) {
            console.error(e);
            alert("Error al guardar: " + e.message);
        }
    };
    const handleFileUpload = async (e) => { const f = e.target.files[0]; if (f) { try { const h = await procesarArchivoExcel(f, juegoSeleccionado); setDatosEditor(p => ({ ...p, hojas: h, titulo: f.name.split('.')[0] })); setMostrandoCrear(false); setMostrandoEditorManual(true); } catch (err) { alert(err.message); } } };
    const procesarCreacionIA = async () => { const t = prompt("Tema:"); if (t) { try { alert("Generando..."); const h = await generarPreguntasGemini(GEMINI_API_KEY, t, juegoSeleccionado); setDatosEditor(p => ({ ...p, hojas: h, titulo: t })); setMostrandoCrear(false); setMostrandoEditorManual(true); } catch (e) { alert(e.message); } } };


    // --- NUEVA FUNCIÓN PARA LEER EL ARCHIVO DE DRIVE ---
    // --- FUNCIÓN DE IMPORTACIÓN ROBUSTA (GOOGLE SHEETS Y EXCEL) ---
    const procesarArchivoDrive = async (fileId, oauthToken, mimeType) => {
        console.log("Iniciando importación...", { fileId, mimeType, tieneToken: !!oauthToken });

        // 1. CHEQUEO DE SEGURIDAD
        if (!oauthToken) {
            alert("⚠️ ERROR DE SESIÓN: No se detecta el token de Google Drive.\n\nPor favor, cierra sesión (botón Salir) y vuelve a entrar con Google para renovar los permisos.");
            return;
        }

        try {
            setCargando(true);

            // 2. CONSTRUIR URL DE DESCARGA
            let url;
            // Si es nativo de Google (Sheet), hay que EXPORTARLO
            if (mimeType === 'application/vnd.google-apps.spreadsheet') {
                url = `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`;
            }
            // Si es un Excel subido (.xlsx), se descarga directo
            else {
                url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
            }

            // 3. PETICIÓN A GOOGLE
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${oauthToken}`
                }
            });

            if (!response.ok) {
                const errorText = await response.text(); // Leemos el detalle del error de Google
                console.error("Error respuesta Google:", response.status, errorText);

                if (response.status === 401) throw new Error("Token caducado. Cierra sesión y vuelve a entrar.");
                if (response.status === 403) throw new Error("Permiso denegado. Asegúrate de que el archivo es tuyo.");
                throw new Error(`Error ${response.status} al descargar.`);
            }

            // 4. PROCESAMIENTO DEL ARCHIVO (Igual que antes)
            const blob = await response.blob();
            const arrayBuffer = await blob.arrayBuffer();
            const workbook = XLSX.read(arrayBuffer, { type: 'array' });

            let nuevasHojas = [];

            workbook.SheetNames.forEach((nombreHoja, index) => {
                const worksheet = workbook.Sheets[nombreHoja];
                const datos = XLSX.utils.sheet_to_json(worksheet, { header: 1 }); // Matriz pura

                if (datos && datos.length > 0) {
                    let preguntasDeEstaHoja = [];

                    datos.forEach(fila => {
                        if (!fila || fila.length === 0) return;

                        // Convertir a String seguro para evitar errores
                        const A = fila[0] ? String(fila[0]).trim() : "";
                        const B = fila[1] ? String(fila[1]).trim() : "";

                        // LÓGICA PASAPALABRA (A: Letra, B: Pregunta, C: Respuesta)
                        if (juegoSeleccionado === 'PASAPALABRA' && A && B) {
                            const C = fila[2] ? String(fila[2]).trim() : "";
                            preguntasDeEstaHoja.push({
                                id: Date.now() + Math.random(),
                                letra: A.toUpperCase(),
                                estado: 'pendiente',
                                pregunta: B,
                                respuesta: C,
                                tipo: 'texto'
                            });
                        }
                        // LÓGICA CAZABURBUJAS (A: Pregunta, B: Correcta, C...: Incorrectas)
                        else if (juegoSeleccionado === 'CAZABURBUJAS' && A && B) {
                            const incorrectas = fila.slice(2).map(x => x ? String(x).trim() : "").filter(x => x !== "");
                            preguntasDeEstaHoja.push({
                                id: Date.now() + Math.random(),
                                pregunta: A,
                                correcta: B,
                                respuesta: B, // Compatibilidad
                                incorrectas: incorrectas.length > 0 ? incorrectas : ["Respuesta Incorrecta 1"],
                                tiempo: 20
                            });
                        }
                        // LÓGICA APAREJADOS (A: Concepto 1, B: Concepto 2)
                        else if (juegoSeleccionado === 'APAREJADOS' && A && B) {
                            preguntasDeEstaHoja.push({
                                id: Date.now() + Math.random(),
                                tipo: 'pareja',
                               terminoA: A,
                                terminoB: B
                            });
                        }
                        // LÓGICA WORDLE (A: Palabra)
                        else if (juegoSeleccionado === 'WORDLE' && A) {
                            if (A.length >= 4 && A.length <= 9) preguntasDeEstaHoja.push(A.toUpperCase());
                        }
                        // Añade en el bloque que abre el editor correcto tras importar:
                        else if (juegoSeleccionado === 'SINTAXIS') setMostrandoEditorSintaxis(true);
                    });

                    if (preguntasDeEstaHoja.length > 0) {
                        if (juegoSeleccionado === 'WORDLE') {
                            nuevasHojas.push({ nombreHoja, palabras: preguntasDeEstaHoja });
                        } else {
                            nuevasHojas.push({ nombreHoja, preguntas: preguntasDeEstaHoja });
                        }
                    }
                }
            });

            if (nuevasHojas.length === 0) {
                alert("⚠️ Archivo leído pero sin datos válidos.\nRevisa que las columnas A y B tengan contenido.");
            } else {
                setDatosEditor(prev => ({
                    ...prev,
                    hojas: nuevasHojas,
                    titulo: prev.titulo || "Importado de Drive"
                }));
                setMostrandoCrear(false);

                // Abrir el editor correcto
                if (juegoSeleccionado === 'WORDLE') setMostrandoEditorWordle(true);
                else if (juegoSeleccionado === 'CAZABURBUJAS') {
                    if (modoDashboard === 'PRO') setMostrandoEditorBurbujasPikatron(true);
                    else setMostrandoEditorManual(true);
                }
                else if (juegoSeleccionado === 'THINKHOOT') {
                    if (modoDashboard === 'PRO' || modoDashboard === 'LIVE') setMostrandoEditorPro(true);
                    else setMostrandoEditorManual(true);
                }

                else setMostrandoEditorManual(true);

                alert(`✅ ¡Importado! Se han creado ${nuevasHojas.length} niveles.`);
            }

        } catch (error) {
            console.error("ERROR CRÍTICO DRIVE:", error);
            alert(`❌ Error al importar: ${error.message}`);
        } finally {
            setCargando(false);
        }
    };



    const handleOpenPicker = () => {
        openPicker({
            clientId: GOOGLE_CLIENT_ID,
            developerKey: GOOGLE_DEVELOPER_KEY,
            viewId: "DOCS",
            token: googleToken,
            showUploadView: true,
            showUploadFolders: true,
            supportDrives: true,
            multiselect: false,
            // Aceptamos tanto Hojas de Google como Excel
            mimetypes: ["application/vnd.google-apps.spreadsheet", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
            callbackFunction: (data) => {
                if (data.action === 'picked') {
                    // --- AQUÍ ESTABA EL ERROR ---
                    const doc = data.docs[0];

                    // Antes tenías: procesarArchivoDrive(fileId, googleToken);
                    // FALTABA EL TERCER PARÁMETRO (doc.mimeType)

                    procesarArchivoDrive(doc.id, googleToken, doc.mimeType);
                }
            }
        });
    };
    const confirmarCopiaAplicacion = async () => {
        if (!modalCopiarApp) return;

        // 1. Detectamos el juego de destino y el origen
        const appDestino = modalCopiarApp.targetGame || 'PASAPALABRA';

        let recursoFresco = modalCopiarApp;
        try {
            const snap = await getDoc(doc(db, "resources", modalCopiarApp.id));
            if (snap.exists()) recursoFresco = { ...snap.data(), id: snap.id };
        } catch (e) { console.error("Usando datos locales"); }

        // Configuración por defecto
        const conf = {};
        if (TIPOS_JUEGOS[appDestino]) {
            TIPOS_JUEGOS[appDestino].camposConfig.forEach(c => conf[c.key] = c.default);
        }

        // --- 2. TRANSFORMACIÓN SEGURA ---
        const hojasL = recursoFresco.hojas.map(h => ({
            nombreHoja: h.nombreHoja,
            preguntas: (h.preguntas || []).map(p => {

                // >>> SALVAGUARDA: Si NO es Question Sender, copiamos TODO intacto <<<
                if (recursoFresco.tipoJuego !== 'QUESTION_SENDER') {
                    return { ...p };
                }

                // >>> SOLO SI ES QUESTION SENDER: LIMPIAMOS Y ADAPTAMOS <<<

                // CASO A: PASAPALABRA
                if (appDestino === 'PASAPALABRA') {
                    return {
                        letra: p.letra || 'A',
                        pregunta: p.pregunta || '',
                        respuesta: p.respuesta || ''
                    };
                }

                // CASO B: APAREJADOS (Transformamos a TerminoA/B)
                else if (appDestino === 'APAREJADOS') {
                    return {
                        terminoA: p.pregunta || '',
                        terminoB: p.respuesta || ''
                    };
                }

                // CASO C: RESTO (Test: Burbujas, etc.)
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
                // Al crear objetos nuevos aquí, los nombres de alumnos se eliminan.
            })
        }));

        try {
            await addDoc(collection(db, "resources"), {
                titulo: `[IMPORT] ${recursoFresco.titulo}`,
                temas: recursoFresco.temas || '',
                profesorUid: usuario.uid,
                profesorNombre: perfilProfesor?.nombre || usuario.displayName,
                pais: perfilProfesor?.pais || '',
                region: perfilProfesor?.region || '',
                poblacion: perfilProfesor?.poblacion || '',
                tipoJuego: appDestino,
                config: conf,
                hojas: hojasL,
                isPrivate: true,
                origen: 'question_sender',
                playCount: 0,
                fechaCreacion: new Date(),
                accessCode: generarCodigoAcceso()
            });

            alert(`Recurso convertido exitosamente a ${TIPOS_JUEGOS[appDestino]?.label || appDestino}`);
            setModalCopiarApp(null);

            // Redirigimos
            setJuegoSeleccionado(appDestino);
            setVista('MIS_RECURSOS');
            cargarRecursosPropios();

        } catch (e) {
            console.error(e);
            alert("Error al copiar: " + e.message);
        }
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
            // Protegemos los juegos PRO y OLYMPIC para que no destruya el tipo de pregunta
            if (r.tipo !== 'PRO' && r.tipo !== 'OLYMPIC' && r.tipoJuego !== 'OLYMPICLIVE') {
                return { ...p, q: p.pregunta, a: p.correcta || p.respuesta, tipo: (p.incorrectas?.length > 0) ? 'MULTIPLE' : 'SIMPLE', opcionesFijas: (p.incorrectas?.length > 0) ? [p.correcta || p.respuesta, ...p.incorrectas].sort(() => Math.random() - 0.5) : [] };
            }
            return p;
        });

        // Si no hay usuario registrado, generamos un ID temporal y un nombre por defecto
        const myHostId = usuario?.uid || "host_invitado_" + Date.now();
        const myHostName = usuario?.displayName || "Profe Invitado";






        await setDoc(doc(db, "live_games", sala), {
            hostId: myHostId, // Usamos el ID seguro
            recursoId: r.id || 'temp_id',
            recursoTitulo: r.titulo,
            profesorNombre: myHostName,
            config: r.config,
            preguntas: pFin,
            estado: 'LOBBY',
            indicePregunta: 0,
            jugadores: {},
            respuestasRonda: {},
            timestamp: new Date(),
            tipoJuego: r.tipoJuego
        });
        setHostGameData({ ...hostGameData, codigoSala: sala, fase: 'LIVE' });
    };

    const abrirResultados = async (r) => { setRecursoResultados(r); setListaResultados([]); const q = query(collection(db, "ranking"), where("recursoId", "==", r.id)); const s = await getDocs(q); setListaResultados(s.docs.map(d => d.data())); };
    const descargarCSV = () => { let csv = "Jugador,Puntos\n" + listaResultados.map(r => `${r.jugador},${r.aciertos || r.puntuacion}`).join("\n"); const l = document.createElement("a"); l.href = encodeURI("data:text/csv;charset=utf-8," + csv); l.download = "notas.csv"; l.click(); };
    const probarJuego = (r) => { incrementarPopularidad(r); setRecursoProbando(r); };

    
    // --- LÓGICA DE SELECCIÓN DE JUEGO ---
    if (hostGameData?.fase === 'LIVE') {
        // 1. Si es de Olimpiadas, cargamos el motor Olímpico
        if (hostGameData.recurso.tipoJuego === 'OLYMPICLIVE') {
            return <OlympicLive isHost={true} codigoSala={hostGameData.codigoSala} usuario={usuario} onExit={() => setHostGameData(null)} />;
        }

        // 2. Si el recurso tiene la marca de MathLive, cargamos ese archivo
        if (hostGameData.recurso.config?.isMathLive) {
            return <MathLive isHost={true} codigoSala={hostGameData.codigoSala} usuario={usuario} onExit={() => setHostGameData(null)} />;
        }

        // 3. Si no es ninguno de los anteriores, cargamos el ThinkHoot normal
        return <ThinkHootGame isHost={true} codigoSala={hostGameData.codigoSala} usuario={usuario} onExit={() => setHostGameData(null)} />;
    }





    // --- LÓGICA DE RENDERIZADO DE JUEGOS ---
    if (recursoProbando) {

        // CASO 1: PIKATRON
        if (recursoProbando.tipoJuego === 'PIKATRON') {
            return (
                <PikatronRun
                    recurso={recursoProbando}
                    usuario={perfilProfesor || usuario}
                    onExit={() => setRecursoProbando(null)}
                />
            );
        }

        // CASO 2: CAZABURBUJAS PRO (Usamos el componente nuevo, no GamePlayer)
        if (recursoProbando.tipo === 'PRO-BURBUJAS' && recursoProbando.tipoJuego === 'CAZABURBUJAS') {
            return (
                <CazaBurbujasGame
                    recurso={recursoProbando}
                    usuario={perfilProfesor || usuario}
                    alTerminar={() => setRecursoProbando(null)}
                />
            );
        }

        // --- NUEVO CASO: WORDLE / SOPA ---
        if (recursoProbando.tipoJuego === 'WORDLE') {
            return <TextWordleGame recursoInicial={recursoProbando} usuario={perfilProfesor || usuario} onExit={() => setRecursoProbando(null)} />;
        }
        if (recursoProbando.tipoJuego === 'SOPA') {
            return <SopaDeLetrasGame recursoInicial={recursoProbando} usuario={perfilProfesor || usuario} onExit={() => setRecursoProbando(null)} />;
        }

        // CASO SINTAXIS
        if (recursoProbando.tipoJuego === 'SINTAXIS') {
            return (
                <SintaxisGame
                    recurso={recursoProbando}
                    onExit={() => setRecursoProbando(null)}
                />
            );
        }

        // CASO 3: RECURSOS CLÁSICOS (Usa el reproductor antiguo GamePlayer)
        return (
            <div style={{ background: '#2f3640', minHeight: '100vh' }}>
                <div style={{ background: '#f1c40f', padding: '10px', textAlign: 'center' }}>
                    MODO PRUEBA
                    <button onClick={() => setRecursoProbando(null)} style={{ marginLeft: 20 }}>Cerrar</button>
                </div>
                <GamePlayer
                    recurso={recursoProbando}
                    usuario={usuario}
                    alTerminar={() => setRecursoProbando(null)}
                />
            </div>
        );
    }
    if (modoVista === 'ALUMNO') return (<div style={{ position: 'relative' }}><div style={{ position: 'fixed', top: 20, right: 20, zIndex: 9999 }}><button onClick={() => setModoVista('PROFESOR')} style={{ background: '#e74c3c', color: 'white', padding: '10px 20px', borderRadius: '30px', border: 'none', fontWeight: 'bold', boxShadow: '0 4px 15px rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}><LogOut size={20} /> SALIR MODO ALUMNO</button></div><StudentDashboard usuario={usuario} /></div>);

    if (mostrandoMathWordle) {
        return (
            <MathWordleGame
                usuario={perfilProfesor || usuario}
                onExit={() => setMostrandoMathWordle(false)}
            />
        );
    }





    // ==============================================================================
    //  RENDERIZADO PRINCIPAL
    // ==============================================================================
    return (
        <div style={{ padding: '20px', maxWidth: '1000px', margin: '0 auto', fontFamily: 'Arial', position: 'relative', minHeight: '100vh', background: '#e3f2fd' }}> {/* FONDO AZUL CLARO */}
            {/* --- AÑADE ESTA LÍNEA O NO SE APLICARÁ NINGÚN DISEÑO --- */}
            <ResponsiveStyles />
            {/* -------------------------------------------------------- */}
            {/* --- MENÚ HAMBURGUESA --- */}
            <button onClick={toggleMenu} style={styles.menuButton}><Menu size={32} color="#2c3e50" /></button>
            {menuOpen && (<div style={styles.menuOverlay} onClick={toggleMenu}><div style={styles.menuPanel} onClick={(e) => e.stopPropagation()}>
                <div style={styles.menuHeader}><h2 style={styles.menuTitle}>Menú</h2><button onClick={toggleMenu} style={styles.closeButton}><X size={28} color="#2c3e50" /></button></div>
                <ul style={styles.menuList}>
                    <li style={styles.menuItem} onClick={() => navegar('CLASICO')}>Recursos Clásicos</li>
                    <li style={styles.menuItem} onClick={() => navegar('PRO')}>Recursos PRO</li>
                    <li style={styles.menuItem} onClick={() => navegar('LIVE')}>Recursos Live</li>   {/* ← NUEVO */}
                    <li style={styles.menuItem} onClick={() => navegar('BUSCADOR_GLOBAL')}>Buscador de Recursos</li>
                    <li style={styles.menuItem} onClick={() => navegar('HERRAMIENTAS')}>Herramientas del Profesor</li>

                    {/* --- CAMBIA ESTAS DOS LÍNEAS PARA LOS ENLACES EXTERNOS --- */}
                    <li style={styles.menuItem} onClick={() => {
                        setMenuOpen(false);
                        window.open('https://www.pikt.es/politica.html', '_blank');
                    }}>
                        Privacidad y Datos
                    </li>
                    <li style={styles.menuItem} onClick={() => {
                        setMenuOpen(false);
                        window.open('/guia-pikt-es.html', '_blank');
                    }}>
                        Más Información
                    </li>
                </ul>
                <div style={styles.menuFooter}>PiKT © 2024</div></div></div>)}

            {/* BARRA SUPERIOR (PERFIL, AYUDA) */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '15px', marginBottom: '30px', paddingBottom: '15px', marginTop:'60px' }}>
                <button onClick={() => navegar('INFORMES')} style={{ ...styles.helpButtonTop, background: '#1565C0' }} title="Informes de Juegos">
                    <BarChart2 size={20} color="white" />
                </button>


                <button onClick={() => setMostrandoAyudaDashboard(true)} style={styles.helpButtonTop} title="Ayuda"><HelpCircle size={24} color="#1565C0" /></button>
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
                <TeacherTools usuario={usuario} googleToken={googleToken} />
            )}
            {modoDashboard === 'INFORMES' && <InformesJuegos usuario={usuario} />}

            {/* 3. LEGAL / INFO */}
            {(modoDashboard === 'LEGAL' || modoDashboard === 'INFO') && (
                <div style={{ padding: '40px', background: 'white', borderRadius: '15px', textAlign: 'center' }}>
                    <h2 style={{color:'#2c3e50'}}>{modoDashboard === 'LEGAL' ? 'Política de Privacidad' : 'Más Información'}</h2>
                    <p style={{color:'#777'}}>Contenido informativo pendiente de redacción.</p>
                </div>
            )}

            {/* 4. MODOS CLÁSICO Y PRO (RECURSOS) */}
            {(modoDashboard === 'CLASICO' || modoDashboard === 'PRO' || modoDashboard === 'LIVE') && (
                <>{modoDashboard === 'CLASICO' && (
                    <div className="game-type-scroll" style={{ marginBottom: '20px' }}>
                        {Object.values(TIPOS_JUEGOS)
                            .filter(j => j.id !== 'MATHLIVE' && j.id !== 'WORDLE' && j.id !== 'OLYMPICLIVE' && j.id !== 'SINTAXIS' && j.id !== 'ETIQUETAS')
                            .map(j => (
                                <button key={j.id} onClick={() => setJuegoSeleccionado(j.id)} style={{ padding: '8px 16px', borderRadius: '20px', border: 'none', background: juegoSeleccionado === j.id ? j.color : 'white', color: juegoSeleccionado === j.id ? 'white' : '#555', cursor: 'pointer', fontWeight: 'bold', boxShadow: '0 2px 5px rgba(0,0,0,0.1)' }}>
                                    {j.label}
                                </button>
                            ))}
                    </div>
                )}


                    {modoDashboard === 'PRO' && (<div style={{ marginBottom: '20px', textAlign: 'center' }}><h1 style={{ color: '#9C27B0', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}><Zap size={32} /> RECURSOS PRO</h1></div>)}

                    {modoDashboard === 'LIVE' && (
                        <div style={{ marginBottom: '20px', textAlign: 'center' }}>
                            <h1 style={{ color: '#D32F2F', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                                <Zap size={32} /> RECURSOS LIVE
        </h1>
                        </div>
                    )}


                    {/* BARRA DE TÍTULO Y BOTONES DE ACCIÓN */}
                    {/* BARRA DE TÍTULO Y BOTONES DE ACCIÓN RESPONSIVA */}
                    <div className="dashboard-header-row">
                        <h2>
                            {vista === 'MIS_RECURSOS'
                                ? (modoDashboard === 'PRO' || modoDashboard === 'LIVE' ? `Recursos: ${TIPOS_JUEGOS[juegoSeleccionado]?.label}` : `Mis Recursos`)
                                : `Biblioteca`}
                        </h2>
                        <div className="action-group">
                            {/* BOTÓN CREAR (OVALADO) */}
                            {vista === 'MIS_RECURSOS' && (
                                <button
                                    onClick={iniciarCreacion}
                                    className="header-btn"
                                    style={{
                                        background: '#2ecc71', color: 'white',
                                        padding: '10px 20px', borderRadius: '30px'
                                    }}
                                >
                                    <Plus size={20} /> <span className="btn-text">Crear Nuevo</span>
                                </button>
                            )}

                            {/* BOTÓN BIBLIOTECA (OVALADO) */}
                            {(juegoSeleccionado !== 'QUESTION_SENDER' && modoDashboard === 'CLASICO') && (
                                <button
                                    onClick={() => setVista(vista === 'MIS_RECURSOS' ? 'BIBLIOTECA' : 'MIS_RECURSOS')}
                                    className="header-btn"
                                    style={{ background: '#2980b9', color: 'white', padding: '10px 20px', borderRadius: '30px' }}
                                >
                                    <Globe size={18} /> <span className="btn-text">{vista === 'MIS_RECURSOS' ? "Biblioteca" : "Mis Recursos"}</span>
                                </button>
                            )}

                            {/* BOTONES PRO (OVALADOS 20px) */}
                            {modoDashboard === 'PRO' && (
                                <>
                                  

                                    <button
                                        onClick={() => setJuegoSeleccionado('CAZABURBUJAS')}
                                        className="header-btn"
                                        style={{
                                            padding: '8px 20px', borderRadius: '20px',
                                            background: juegoSeleccionado === 'CAZABURBUJAS' ? '#E91E63' : 'white',
                                            color: juegoSeleccionado === 'CAZABURBUJAS' ? 'white' : '#555'
                                        }}
                                    >
                                        <Gamepad2 size={16} /> <span className="btn-text">Burbujas</span>
                                    </button>

                                  

                                    {/* --- AÑADE ESTO: NUEVO BOTÓN MATH WORDLE --- */}
                                    <button
                                        onClick={() => setJuegoSeleccionado('WORDLE')}
                                        className="header-btn"
                                        style={{
                                            padding: '8px 20px', borderRadius: '20px',
                                            // Si está seleccionado, fondo verde, si no blanco
                                            background: juegoSeleccionado === 'WORDLE' ? '#2E7D32' : 'white',
                                            color: juegoSeleccionado === 'WORDLE' ? 'white' : '#555'
                                        }}
                                    >

                                        



                                        <FileText size={16} /> <span className="btn-text">Wordle</span>
                                    </button>
                                    {/* ------------------------------------------- */}

                                    
                                   
                                  

                            
                            <button
                                onClick={() => setJuegoSeleccionado('SINTAXIS')}
                                className="header-btn"
                                style={{
                                    padding: '8px 20px', borderRadius: '20px',
                                    background: juegoSeleccionado === 'SINTAXIS' ? '#3498db' : 'white',
                                    color: juegoSeleccionado === 'SINTAXIS' ? 'white' : '#555'
                                }}
                            >
                                <FileText size={16} /> <span className="btn-text">Sintaxis</span>
                            </button>
                                    <button onClick={() => setJuegoSeleccionado('ETIQUETAS')} className="header-btn"
                                        style={{
                                            padding: '8px 20px', borderRadius: '20px',
                                            background: juegoSeleccionado === 'ETIQUETAS' ? '#e74c3c' : 'white',
                                            color: juegoSeleccionado === 'ETIQUETAS' ? 'white' : '#555'
                                        }}>
                                        <Crosshair size={16} /> <span className="btn-text">Etiquetas</span>
                                    </button>

                                </>
                            )}

                            {modoDashboard === 'LIVE' && (
                                <>
                                    <button onClick={() => setJuegoSeleccionado('THINKHOOT')} className="header-btn"
                                        style={{
                                            padding: '8px 20px', borderRadius: '20px',
                                            background: juegoSeleccionado === 'THINKHOOT' ? '#9C27B0' : 'white',
                                            color: juegoSeleccionado === 'THINKHOOT' ? 'white' : '#555'
                                        }}>
                                        <Zap size={16} /> <span className="btn-text">Pi-Live</span>
                                    </button>
                                    <button onClick={() => setJuegoSeleccionado('MATHLIVE')} className="header-btn"
                                        style={{
                                            padding: '8px 20px', borderRadius: '20px',
                                            background: juegoSeleccionado === 'MATHLIVE' ? '#009688' : 'white',
                                            color: juegoSeleccionado === 'MATHLIVE' ? 'white' : '#555'
                                        }}>
                                        <Calculator size={16} /> <span className="btn-text">MathLive</span>
                                    </button>
                                    <button onClick={() => setJuegoSeleccionado('OLYMPICLIVE')} className="header-btn"
                                        style={{
                                            padding: '8px 20px', borderRadius: '20px',
                                            background: juegoSeleccionado === 'OLYMPICLIVE' ? '#D32F2F' : 'white',
                                            color: juegoSeleccionado === 'OLYMPICLIVE' ? 'white' : '#555'
                                        }}>
                                        <Medal size={16} /> <span className="btn-text">Olympic</span>
                                    </button>
                                </>
                            )}



                        </div>
                    </div>


                    {vista === 'BIBLIOTECA' && (<div style={{ background: '#f9f9f9', padding: '15px', borderRadius: '10px', marginBottom: '20px', display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}><span style={{ fontWeight: 'bold', color: '#666' }}><Search size={16} /> Filtros:</span><input placeholder="Tema..." value={filtrosInput.tema} onChange={e => setFiltrosInput({ ...filtrosInput, tema: e.target.value })} style={inputFilter} /><input placeholder="País" value={filtrosInput.pais} onChange={e => setFiltrosInput({ ...filtrosInput, pais: e.target.value })} style={inputFilter} /><input placeholder="Región" value={filtrosInput.region} onChange={e => setFiltrosInput({ ...filtrosInput, region: e.target.value })} style={inputFilter} /><input placeholder="Población" value={filtrosInput.poblacion} onChange={e => setFiltrosInput({ ...filtrosInput, poblacion: e.target.value })} style={inputFilter} /><button onClick={ejecutarBusqueda} style={{ background: '#2980b9', color: 'white', border: 'none', padding: '8px 15px', borderRadius: '5px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}><Search size={16} /> Buscar</button><button onClick={limpiarBusqueda} style={{ background: '#bdc3c7', padding: '8px', borderRadius: '5px', border: 'none', cursor: 'pointer' }} title="Limpiar"><RotateCcw size={16} /></button></div>)}
                    <div className="resources-grid">
                        {(vista === 'MIS_RECURSOS' ? recursos : getRecursosFiltrados()).map((r, i) => (<div key={r.id || i} style={{
                            background: 'white', padding: '20px', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', position: 'relative',
                            display: 'flex',
                            flexDirection: 'column', borderLeft: `6px solid ${TIPOS_JUEGOS[juegoSeleccionado].color}`
                        }}>{juegoSeleccionado !== 'QUESTION_SENDER' && <div style={{ position: 'absolute', top: '10px', right: '10px', background: '#f1c40f', padding: '2px 8px', borderRadius: '10px', fontSize: '12px', fontWeight: 'bold' }}><Users size={12} /> {r.playCount || 0}</div>}<h3 style={{ margin: '0 0 5px 0' }}>{r.titulo}</h3>

                            <div style={{ display: 'flex', gap: '5px', marginTop: '10px' }}>{juegoSeleccionado === 'QUESTION_SENDER' ? (<><button onClick={() => setQsenderAMigrar(r)} style={btnStyle('#E8F5E9', '#2E7D32')} title="Migrar a Juego"><Send size={18} /></button><button onClick={() => abrirEdicion(r)} style={btnStyle('#E3F2FD', '#1565C0')}><Pencil size={18} /></button><button onClick={() => eliminarRecurso(r.id)} style={btnStyle('#FFEBEE', '#C62828')}><Trash2 size={18} /></button></>) : (vista === 'MIS_RECURSOS' ? (<>
                                {juegoSeleccionado === 'THINKHOOT' || juegoSeleccionado === 'MATHLIVE' || juegoSeleccionado === 'OLYMPICLIVE' ? (

                                    <button title="Lanzar en Vivo" onClick={() => prepararJuegoEnVivo(r)} style={{ ...btnStyle('#9C27B0', 'white'), fontWeight: 'bold' }}>
                                    <Zap size={18} />
                                </button>
                            ) : (
                                    <button
                                        onClick={() => {
                                            // AQUI ESTA LA CLAVE: Si es CAZABURBUJAS (da igual si es PRO o Manual), te deja elegir
                                                if (r.tipoJuego === 'CAZABURBUJAS' || r.tipoJuego === 'WORDLE') {
                                                setRecursoParaElegirModo(r);
                                            } else {
                                                probarJuego(r);
                                            }
                                        }}
                                        style={btnStyle('#E1BEE7', '#8E24AA')}
                                        title="Jugar / Probar"
                                    >
                                        <Gamepad2 size={18} />
                                    </button>
                                )}
                            <button onClick={() => mostrarCodigo(r)} style={btnStyle('#FFF3E0', '#FF9800')}><Key size={18} /></button><button onClick={() => abrirEdicion(r)} style={btnStyle('#E3F2FD', '#1565C0')}><Pencil size={18} /></button><button onClick={() => abrirResultados(r)} style={btnStyle('#E8F5E9', '#2E7D32')}><BarChart2 size={18} /></button><button onClick={() => eliminarRecurso(r.id)} style={btnStyle('#FFEBEE', '#C62828')}><Trash2 size={18} /></button></>) : (<><button onClick={() => probarJuego(r)} style={{ ...btnStyle('#E1BEE7', '#8E24AA'), flex: 2 }}>Probar</button><button onClick={() => setRecursoInspeccionando(r)} style={btnStyle('#eee', '#333')}><Eye size={18} /></button><button onClick={() => copiarRecurso(r)} style={{ ...btnStyle('#27ae60', 'white'), flex: 2 }}>Copiar</button></>))}</div></div>))}
                        
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
            {/* MODALES EDITORES */}
            {mostrandoCrear && (
                <ModalOverlay onClose={() => setMostrandoCrear(false)}>
                    <h2>Nuevo {TIPOS_JUEGOS[juegoSeleccionado].label}</h2>
                    <input
                        value={datosEditor.titulo}

                        onChange={e => setDatosEditor({ ...datosEditor, titulo: e.target.value })}
                        style={inputStyle}
                        placeholder="Título"
                    />
                    <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>

                       

                        <button onClick={() => {
                            setMostrandoCrear(false);
                            if (juegoSeleccionado === 'SINTAXIS') setMostrandoEditorSintaxis(true);
                            else if (juegoSeleccionado === 'ETIQUETAS') setMostrandoEditorEtiquetas(true);
                            else setMostrandoEditorManual(true);
                        }}
                            style={{ ...actionBtnStyle('#2196F3'), flex: 1 }}
                        >
                            <Edit3 /> {juegoSeleccionado === 'ETIQUETAS' || juegoSeleccionado === 'SINTAXIS' ? 'Abrir Editor' : 'Manual'}
                        </button>
                        
                        {juegoSeleccionado !== 'QUESTION_SENDER' && juegoSeleccionado !== 'SINTAXIS' && juegoSeleccionado !== 'ETIQUETAS' && (
                            <>
                                <button onClick={procesarCreacionIA} style={{ ...actionBtnStyle('#673AB7'), flex: 1 }}>
                                    <Bot /> IA
                                </button>

                                {/* --- AQUÍ ESTABA EL BOTÓN DE EXCEL QUE HAS BORRADO --- */}

                                <button onClick={handleOpenPicker} style={{ ...actionBtnStyle('#FFC107'), flex: 1, color: 'black' }}>
                                    Drive
                                </button>
                            </>
                        )}
                    </div>
                </ModalOverlay>
            )}


            {mostrandoEditorManual && (
                juegoSeleccionado === 'QUESTION_SENDER' ? (
                    // CASO A: SI ES QUESTION SENDER, USAMOS EL NUEVO EDITOR ESPECÍFICO
                    <EditorQuestionSender
                        datos={datosEditor}
                        setDatos={setDatosEditor}
                        onClose={() => setMostrandoEditorManual(false)}
                        onSave={guardarRecursoFinal}
                    />
                ) : (
                        // CASO B: SI ES CUALQUIER OTRO JUEGO, USAMOS EL DE SIEMPRE
                        <EditorManual
                            datos={datosEditor}
                            setDatos={setDatosEditor}
                            configJuego={TIPOS_JUEGOS[juegoSeleccionado]}
                            onClose={() => setMostrandoEditorManual(false)}
                            onSave={guardarRecursoFinal}
                            usuario={perfilProfesor || usuario}
                        />
                    )
            )}


            {mostrandoEditorPro && <EditorPro datos={datosEditor} setDatos={setDatosEditor} onClose={() => setMostrandoEditorPro(false)} onSave={guardarRecursoFinal} usuario={perfilProfesor || usuario} />}

            {mostrandoEditorMathLive && <EditorMathLive datos={datosEditor} setDatos={setDatosEditor} onClose={() => setMostrandoEditorMathLive(false)} onSave={guardarRecursoFinal} usuario={perfilProfesor || usuario}/>}
            {mostrandoEditorBurbujasPikatron && (
                <EditorProBurbujasPikatron
                    datos={datosEditor}
                    setDatos={setDatosEditor}
                    onClose={() => setMostrandoEditorBurbujasPikatron(false)}
                    onSave={guardarRecursoFinal}
                    usuario={perfilProfesor || usuario}
                />
            )}

            {mostrandoEditorWordle && (
                <EditorWordle
                    datos={datosEditor}
                    setDatos={setDatosEditor}
                    onClose={() => setMostrandoEditorWordle(false)}
                    onSave={guardarRecursoFinal}
                    usuario={perfilProfesor || usuario}
                />
            )}
            {mostrandoEditorSintaxis && (
                <EditorSintaxis
                    datos={datosEditor}
                    setDatos={setDatosEditor}
                    onClose={() => setMostrandoEditorSintaxis(false)}
                    usuario={perfilProfesor || usuario}
                />
            )}

            {mostrandoEditorEtiquetas && (
                <EditorEtiquetas
                    datos={datosEditor}
                    setDatos={setDatosEditor}
                    onClose={() => setMostrandoEditorEtiquetas(false)}
                    usuario={perfilProfesor || usuario}
                />
            )}

            {mostrandoEditorOlympic && (
                <EditorOlympic
                    datos={datosEditor}
                    setDatos={setDatosEditor}
                    onClose={() => setMostrandoEditorOlympic(false)}
                    onSave={guardarRecursoFinal}
                    usuario={perfilProfesor || usuario}
                />
            )}


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

            {/* --- MODAL MIGRACIÓN INTELIGENTE QUESTION SENDER --- */}
            {qSenderAMigrar && (
                <ModalMigrarQsender
                    qsRecurso={qSenderAMigrar}
                    usuario={usuario}
                    onClose={() => setQsenderAMigrar(null)}
                    onMigrateSuccess={(mensaje) => {
                        alert(mensaje);
                        setQsenderAMigrar(null);
                        cargarRecursosPropios();
                    }}
                />
            )}

            {hostGameData?.fase === 'CONFIG_HOST' && (<ModalOverlay onClose={() => setHostGameData(null)}><h2>📡 Lanzar en Vivo</h2><select value={hostGameData.hojaElegida} onChange={e => setHostGameData({ ...hostGameData, hojaElegida: e.target.value })} style={{ width: '100%', padding: '10px', marginBottom: '20px' }}>{hostGameData.hojasDisponibles.map(h => <option key={h} value={h}>{h}</option>)}</select><button onClick={confirmarLanzamientoHost} style={{ width: '100%', padding: '15px', background: '#9C27B0', color: 'white', border: 'none', borderRadius: '5px' }}>🚀 GENERAR CÓDIGO</button></ModalOverlay>)}
            {recursoInspeccionando && <ModalOverlay onClose={() => setRecursoInspeccionando(null)}><h2>{recursoInspeccionando.titulo}</h2><div style={{ maxHeight: '400px', overflowY: 'auto' }}>{recursoInspeccionando.hojas.map((h, i) => <div key={i}><h4>{h.nombreHoja}</h4><ul>{h.preguntas.map((p, j) => <li key={j}><b>{p.letra ? `Letra ${p.letra}: ` : ''}{p.pregunta}</b> &rarr; {p.respuesta || p.correcta}</li>)}</ul></div>)}</div><button onClick={() => { copiarRecurso(recursoInspeccionando); setRecursoInspeccionando(null) }} style={actionBtnStyle('#27ae60')}>Copiar</button></ModalOverlay>}
            {mostrandoPerfil && (<UserProfile usuario={usuario} perfil={perfilProfesor} onClose={() => setMostrandoPerfil(false)} onUpdate={() => cargarPerfilProfesor()} />)}
            {/* --- MODAL SELECTOR DE JUEGO (PRO-BURBUJAS) --- */}
            {recursoParaElegirModo && (
                <ModalOverlay onClose={() => setRecursoParaElegirModo(null)}>
                    <h2 style={{ textAlign: 'center', color: '#2c3e50' }}>Elige el Modo de Juego</h2>
                    <p style={{ textAlign: 'center', color: '#666', marginBottom: '25px' }}>
                        ¿Cómo quieres ejecutar <b>{recursoParaElegirModo.titulo}</b>?
                    </p>

                    <div style={{ display: 'grid', gap: '15px' }}>
                        {recursoParaElegirModo.tipoJuego === 'CAZABURBUJAS' ? (
                            <>
                                {/* OPCIÓN 1: CAZABURBUJAS */}
                                <button
                                    onClick={() => {
                                        probarJuego({ ...recursoParaElegirModo, tipoJuego: 'CAZABURBUJAS' });
                                        setRecursoParaElegirModo(null);
                                    }}
                                    style={{
                                        padding: '15px', borderRadius: '15px', border: 'none',
                                        background: 'linear-gradient(135deg, #FF4081 0%, #C2185B 100%)',
                                        color: 'white', fontSize: '1.2rem', fontWeight: 'bold', cursor: 'pointer',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
                                        boxShadow: '0 4px 15px rgba(233, 30, 99, 0.3)'
                                    }}
                                >
                                    <MousePointer2 size={24} /> CazaBurbujas
                                </button>

                                {/* OPCIÓN 2: PIKATRON */}
                                <button
                                    onClick={() => {
                                        probarJuego({ ...recursoParaElegirModo, tipoJuego: 'PIKATRON' });
                                        setRecursoParaElegirModo(null);
                                    }}
                                    style={{
                                        padding: '15px', borderRadius: '15px', border: 'none',
                                        background: 'linear-gradient(135deg, #2196F3 0%, #1976D2 100%)',
                                        color: 'white', fontSize: '1.2rem', fontWeight: 'bold', cursor: 'pointer',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
                                        boxShadow: '0 4px 15px rgba(33, 150, 243, 0.3)'
                                    }}
                                >
                                    <Rocket size={24} /> Pikatron Run
                                </button>
                            </>
                        ) : (
                                <>
                                    {/* OPCIÓN 1: WORDLE (Estilo Verde) */}
                                    <button
                                        onClick={() => {
                                            probarJuego({ ...recursoParaElegirModo, tipoJuego: 'WORDLE' });
                                            setRecursoParaElegirModo(null);
                                        }}
                                        style={{
                                            padding: '15px', borderRadius: '15px', border: 'none',
                                            background: 'linear-gradient(135deg, #4CAF50 0%, #2E7D32 100%)',
                                            color: 'white', fontSize: '1.2rem', fontWeight: 'bold', cursor: 'pointer',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
                                            boxShadow: '0 4px 15px rgba(76, 175, 80, 0.3)'
                                        }}
                                    >
                                        <FileText size={24} /> Wordle
                                </button>

                                    {/* OPCIÓN 2: SOPA DE LETRAS (Estilo Naranja) */}
                                    <button
                                        onClick={() => {
                                            probarJuego({ ...recursoParaElegirModo, tipoJuego: 'SOPA' });
                                            setRecursoParaElegirModo(null);
                                        }}
                                        style={{
                                            padding: '15px', borderRadius: '15px', border: 'none',
                                            background: 'linear-gradient(135deg, #FF9800 0%, #E65100 100%)',
                                            color: 'white', fontSize: '1.2rem', fontWeight: 'bold', cursor: 'pointer',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
                                            boxShadow: '0 4px 15px rgba(255, 152, 0, 0.3)'
                                        }}
                                    >
                                        <SearchIcon size={24} /> Sopa de Letras
                                </button>
                                </>
                            )}
                    </div>
                </ModalOverlay>
            )}





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
const ResponsiveStyles = () => (
    <style>{`
        /* --- CONTENEDOR PRINCIPAL --- */
        .dashboard-main-container {
             padding: 20px;
             max-width: 1200px; 
             margin: 0 auto;
             font-family: Arial, sans-serif;
             min-height: 100vh;
        }

        /* --- CABECERA --- */
        .dashboard-header-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
            gap: 15px;
            flex-wrap: wrap;
        }

        .action-group {
            display: flex;
            gap: 10px;
            flex-wrap: wrap;
            align-items: center;
        }

        /* --- BOTONES OVALADOS (RECUPERADOS) --- */
        .header-btn {
            border: none;
            cursor: pointer;
            font-weight: bold;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            box-shadow: 0 2px 5px rgba(0,0,0,0.1);
            transition: transform 0.1s;
            white-space: nowrap;
        }
        .header-btn:active { transform: scale(0.98); }

        /* --- GRID DE RECURSOS CON LÍMITE --- */
        .resources-grid {
            display: grid;
            /* Nunca más de 350px por tarjeta para que no se estiren */
            grid-template-columns: repeat(auto-fill, minmax(350px, 400px));
            gap: 20px;
            justify-content: center; /* Centra las tarjetas si hay pocas */
        }

        .btn-text { display: inline; }

        /* --- AJUSTE MÓVIL --- */
        @media (max-width: 768px) {
            .dashboard-header-row {
                flex-direction: column; 
                align-items: stretch;
            }
            .action-group {
                justify-content: space-between;
                width: 100%;
            }
            .header-btn {
                flex: 1;
                padding: 12px !important;
            }
            .btn-text { display: none; }
            .resources-grid {
                grid-template-columns: 1fr; /* Una columna en móvil */
            }
        }
    `}</style>
);