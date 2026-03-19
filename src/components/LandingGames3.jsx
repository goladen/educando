import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, where, getDocs, orderBy, limit, doc, getDoc, setDoc } from 'firebase/firestore';
import { Search, Key, Filter, Zap, Play, Home, ChevronDown, ChevronUp, Mail } from 'lucide-react';
import GamePlayer from '../GamePlayer';
import ThinkHootGame from '../ThinkHootGame';
import RuletaGame from '../RuletaGame';
import MathLive from '../MathLive';
import OlympicLive from '../OlympicLive';
import QuestionSenderClient from '../QuestionSenderClient';
import PikatronRun from '../PikatronRun';
import TextWordleGame from '../TextWordleGame';
import MathWordleGame from '../MathWordleGame';
import SopaDeLetrasGame from '../SopaDeLetrasGame';
import SintaxisGame from '../SintaxisGamen2';
import Geometrix from '../Geometrix';
import CalculoMental from '../CalculoMental'; 
import Ecuaciones from '../Ecuaciones2';
import Funciones from '../Funciones';
import Plataformas from '../Plataformas2';

import EtiquetaMe from '../EtiquetaMe';
import imgPasapalabra from '../assets/icono_pasapal.png'; // Revisa si es .png o .jpg
import imgBurbujas from '../assets/icono_burbujas.png';
import imgPikatron from '../assets/icono_pikatron.png';
import imgPikatron2 from '../assets/iconoPikatron2.png';
import imgEtiquetas from '../assets/icono_etiquetas.png';
import imgAparejados from '../assets/icono_aparejados.png';
import imgRuleta from '../assets/icono_ruleta.png';
import imgWordle from '../assets/icono_wordle.png';
import imgMathle from '../assets/icono_mathle.png';
import imgPilive from '../assets/icono_pilive.png';
import imgMathlive from '../assets/icono_mathlive.png';
import imgSopa from '../assets/icono_sopa.png';
import imgOlympic from '../assets/icono_olympic.png';


// --- CONFIGURACIÓN DE APLICACIONES Y COLORES ---
export const APPS = [
    { id: 'PASAPALABRA', name: 'Pasapalabra', desc: 'Adivina la palabra con cada letra del abecedario.', color: '#0A0E45', img: imgPasapalabra },
    { id: 'CAZABURBUJAS', name: 'Burbujas', desc: 'Explota la burbuja con la respuesta correcta.', color: '#de896e', img: imgBurbujas },
    { id: 'PIKATRON', name: 'Pikatron', desc: 'Juego tipo runner con preguntas.', color: '#2196F3', img: imgPikatron },
 {
        id: 'PIKATRON_2',
        name: 'Pikatron_2',
        desc: 'Salta y corre, acierta. Por plataformas',
        color: '#2196F3',
        img: imgPikatron2,
        isSpecial: false
    },


{ id: 'APAREJADOS', name: 'AparejaDOS', desc: 'Encuentra las parejas correctas.', color: '#FF9800', img: imgAparejados },
    { id: 'RULETA', name: 'Ruleta', desc: 'Resuelve el panel oculto.', color: '#f1c40f', img: imgRuleta },
    { id: 'WORDLE', name: 'WordLe', desc: 'Adivina la palabra en 6 intentos.', color: '#2e7d32', img: imgWordle },
    { id: 'MATHLE', name: 'MathLe', desc: 'Adivina la ecuación matemática oculta.', color: '#1565C0', img: imgMathle },
    { id: 'THINKHOOT', name: 'PiLive', desc: 'Diviértete en vivo con tus compañeros.', color: '#9C27B0', img: imgPilive, isLive: true },
    { id: 'MATHLIVE', name: 'MathLive', desc: 'Juega con las mates en tiempo real.', color: '#009688', img: imgMathlive, isLive: true },
    { id: 'OLYMPICLIVE', name: 'Olympic_Live', desc: 'Compite en minijuegos y cálculo.', color: '#D32F2F', img: imgOlympic, isLive: true },
    { id: 'SOPA', name: 'Sopa_letras', desc: 'Encuentra las palabras ocultas.', color: '#e67e22', img: imgSopa },
    {
        id: 'QUESTION_SENDER',
        name: 'Q-Sender',
        desc: 'Envía tus preguntas al profesor para crear un juego.',
        color: '#2c3e50',
        img: null, // Usaremos el icono Mail si es null
        emoji: '📮',
        isSpecial: true
    },
    {
        id: 'SINTAXIS',
        name: 'Sintaxis',
        desc: 'Analiza frases de distintos niveles.',
        color: '#3498db',
        emoji: '🖍️',
        isSpecial: false
    },

   


    {
        id: 'MATH_WORLD_PORTAL',
        name: 'Math World',
        desc: 'Entra a la zona exclusiva de aplicaciones matemáticas.',
        color: '#009688',
        emoji: '🌍',
        isPortal: true
    },
    // --- JUEGOS DE MATEMÁTICAS (Saldrán en la segunda pantalla) ---
    { id: 'GEOMETRIX', name: 'Geometrix', desc: 'Áreas, volúmenes y regla virtual.', color: '#009688', emoji: '📐', isMath: true },
    {
        id: 'CALCULO',
        name: 'Calculo',
        desc: 'Agilidad mental y operaciones con tiempo.',
        color: '#E91E63',
        emoji: '🧠',
        isMath: true
    },
    {
        id: 'ETIQUETAS',
        name: 'EtiquetaMe',
        desc: 'Identifica las partes de un diagrama poniendo las etiquetas correctas.',
        color: '#e74c3c',
         img: imgEtiquetas,
        isSpecial: false
    },


    {
        id: 'ECUACIONES',
        name: 'Ecuaciones',
        desc: 'Despeja la X paso a paso.',
        color: '#3F51B5',
        emoji: '⚖️',
        isMath: true
    },
    { id: 'FUNCIONES', name: 'Funciones', desc: 'Rectas, parábolas y análisis gráfico.', color: '#4CAF50', emoji: '📈', isMath: true },


    { id: 'POLINOMIOS', name: 'Álgebra', desc: 'Operaciones con polinomios.', color: '#FF9800', emoji: '✖️', isMath: true, comingSoon: true }

];

// --- FUNCIONES DE AYUDA PARA BÚSQUEDA INTELIGENTE ---

// Calcula la distancia de edición (cuántos cambios faltan para que sean iguales)
const levenshteinDistance = (s, t) => {
    if (!s.length) return t.length;
    if (!t.length) return s.length;
    const arr = [];
    for (let i = 0; i <= t.length; i++) {
        arr[i] = [i];
        for (let j = 1; j <= s.length; j++) {
            arr[i][j] =
                i === 0
                    ? j
                    : Math.min(
                        arr[i - 1][j] + 1,
                        arr[i][j - 1] + 1,
                        arr[i - 1][j - 1] + (s[j - 1] === t[i - 1] ? 0 : 1)
                    );
        }
    }
    return arr[t.length][s.length];
};

// Comprueba si hay coincidencia (Incluye: contiene, contenido en, o similitud > 80%)
const checkFuzzyMatch = (text, search) => {
    const t = cleanText(text);
    const s = cleanText(search);

    if (!t || !s) return false;

    // 1. Coincidencia exacta o contención (rápida)
    if (t.includes(s) || s.includes(t)) return true;

    // 2. Coincidencia difusa (80% de similitud)
    const distance = levenshteinDistance(t, s);
    const maxLength = Math.max(t.length, s.length);
    const similarity = 1 - distance / maxLength;

    return similarity >= 0.8; // Umbral del 80%
};



const FAKE_MATHLE = {
    id: 'fake-mathle',
    titulo: 'Desafío MathLe',
    tipoJuego: 'MATHLE',
    temas: 'Matemáticas',
    ciclo: 'Primaria, Secundaria, Bachillerato, Otros',
    profesorNombre: 'PiKT',
    poblacion: 'Global',
    pais: 'Global',
    accessCode: 'MATH',
    playCount: '+1000'
};
// Función Helper para detectar juegos en vivo y separar PiLive de Wordle
const esJuegoEnVivo = (r) => {
    if (r.tipoJuego === 'MATHLIVE' || r.tipoJuego === 'THINKHOOT' || r.tipoJuego === 'OLYMPICLIVE') return true;
    // Si es un PiLive antiguo (se guardaban como PRO pero NO son Wordle)
    if (r.tipo === 'PRO' && r.tipoJuego !== 'WORDLE' && r.tipoJuego !== 'MATHLIVE') return true;
    return false;
};

const getAppInfo = (tipoJuego) => {
    if (!tipoJuego) return { name: 'Recurso', color: '#999' };

    if (tipoJuego === 'CAZABURBUJAS' || tipoJuego === 'PIKATRON') {
        return { name: 'Burbujas/Pikatron', color: '#de896e' };
    }
    if (tipoJuego === 'WORDLE' || tipoJuego === 'SOPA') {
        return { name: 'Wordle / Sopa', color: '#4CAF50' };
    }


    const app = APPS.find(a => a.id === tipoJuego);
    if (app) return app;
    if (tipoJuego === 'PRO') return { name: 'PiLive', color: '#9C27B0' };
    if (tipoJuego === 'QUESTION_SENDER') return { name: 'Q-Sender', color: '#2c3e50' };
    return { name: tipoJuego, color: '#999' };
};

// Función para limpiar textos (quitar tildes, mayúsculas y espacios extra)
const cleanText = (str) => {
    if (!str) return "";
    return String(str)
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "") // Quitar tildes
        .toLowerCase()
        .trim();
};
export default function LandingGames({ onLoginRequest, onOpenQuestionSender }) {
    // --- AÑADE ESTA LÍNEA AQUÍ ---
    const [zonaActiva, setZonaActiva] = useState('MAIN');

    // --- AÑADE ESTE BLOQUE PARA ESCUCHAR LA URL ---
    useEffect(() => {
        const checkURL = () => {
            const path = window.location.pathname.toLowerCase().replace('/', '');
            if (path === 'math_world') {
                setZonaActiva('MATH');
            } else if (path === '' || path === 'inicio') {
                setZonaActiva('MAIN');
            }
        };
        checkURL();
        window.addEventListener('popstate', checkURL);
        return () => window.removeEventListener('popstate', checkURL);
    }, []);



    const [modoBusqueda, setModoBusqueda] = useState('FILTROS');
    const [filtros, setFiltros] = useState({ tipoJuego: '', ciclo: '', tema: '', pais: '', region: '', poblacion: '', autor: '' });
    const [mostrarMasFiltros, setMostrarMasFiltros] = useState(false);
    const [codigo, setCodigo] = useState('');
    const [resultados, setResultados] = useState([]);
    const [buscando, setBuscando] = useState(false);

    const [juegoActivo, setJuegoActivo] = useState(null);
    const [recursoParaElegir, setRecursoParaElegir] = useState(null);

    // Estados Live Alumno
    const [liveModeAlumno, setLiveModeAlumno] = useState(false);
    const [joinLiveCode, setJoinLiveCode] = useState('');
    const [joinLiveName, setJoinLiveName] = useState('');
    const [isMathLiveAlumno, setIsMathLiveAlumno] = useState(false);
    const [joinLiveTipoJuego, setJoinLiveTipoJuego] = useState('');
    const [hostTipoJuego, setHostTipoJuego] = useState('');
    // Estados Live Host (Presentador)
    const [liveModeHost, setLiveModeHost] = useState(false);
    const [hostRoomCode, setHostRoomCode] = useState('');
    const [isMathLiveHost, setIsMathLiveHost] = useState(false);

    const buscar = async () => {
        setBuscando(true);
        setResultados([]);
        const ref = collection(db, 'resources');

        try {
            if (modoBusqueda === 'CODIGO') {
                // ... (ESTA PARTE DEL CÓDIGO SE QUEDA IGUAL) ...
                const codigoLimpio = codigo.toUpperCase().trim();
                if (!codigoLimpio) { alert("Introduce un código."); setBuscando(false); return; }

                if (codigoLimpio.length === 6) {
                    const salaRef = doc(db, "live_games", codigoLimpio);
                    const salaSnap = await getDoc(salaRef);
                    if (salaSnap.exists()) {
                        const data = salaSnap.data();
                        const nombre = prompt("¡Sesión en vivo encontrada! Introduce tu nombre para entrar:");
                        if (nombre && nombre.trim() !== '') {
                            setJoinLiveCode(codigoLimpio);
                            setJoinLiveName(nombre.trim());
                            setJoinLiveTipoJuego(data.tipoJuego || '');
                            setIsMathLiveAlumno(data.config?.isMathLive === true || data.tipoJuego === 'MATHLIVE');
                            setLiveModeAlumno(true);
                        }
                    } else alert("No existe ninguna sesión en vivo con ese código.");
                    setBuscando(false);
                    return;
                }

                let q = query(ref, where("accessCode", "==", codigoLimpio));
                let snap = await getDocs(q);

                if (!snap.empty) {
                    const r = { ...snap.docs[0].data(), id: snap.docs[0].id };
                    setResultados([r]);
                } else {
                    const qSender = query(ref, where("hojasCodes", "array-contains", codigoLimpio));
                    const snapSender = await getDocs(qSender);
                    if (!snapSender.empty) {
                        // ¡ENCONTRADO!
                        // En lugar de llamar a una función externa, activamos el componente localmente
                        // Pasamos un objeto especial como 'juegoActivo' para que el render sepa qué mostrar
                        const recursoEncontrado = {
                            ...snapSender.docs[0].data(),
                            id: snapSender.docs[0].id,
                            tipoJuego: 'QUESTION_SENDER',
                            codigoInicial: codigoLimpio // ¡Pasamos el código que escribió el alumno!
                        };

                        setJuegoActivo(recursoEncontrado);
                        setBuscando(false);
                        return; // Cortamos aquí para que abra directo
                    }
                    else { alert("Código no encontrado."); }
                }

            } else {
                // --- BÚSQUEDA POR FILTROS MEJORADA ---
                const q = query(ref, orderBy("fechaCreacion", "desc"), limit(150));
                const snap = await getDocs(q);
                const raw = snap.docs.map(d => ({ ...d.data(), id: d.id }));

                const filtrados = raw.filter(r => {
                    if (r.tipoJuego === 'QUESTION_SENDER') return false;

                    const isTerminado = r.isFinished === true || r.config?.isFinished === true;
                    if (!isTerminado) return false;

                    // Filtro Tipo Juego
                    if (filtros.tipoJuego) {
                        if (filtros.tipoJuego === 'THINKHOOT') {
                            if (!esJuegoEnVivo(r) || r.tipoJuego === 'MATHLIVE') return false;
                        } else if (filtros.tipoJuego === 'CAZABURBUJAS') {
                            if (r.tipoJuego !== 'CAZABURBUJAS' && r.tipoJuego !== 'PIKATRON') return false;
                        } else if (filtros.tipoJuego === 'SOPA' || filtros.tipoJuego === 'WORDLE') {
                            if (r.tipoJuego !== 'SOPA' && r.tipoJuego !== 'WORDLE') return false;
                        } else {
                            if (r.tipoJuego !== filtros.tipoJuego) return false;
                        }
                    }

                    // --- NUEVA LÓGICA DE BÚSQUEDA DE TEMA ---
                    if (filtros.tema) {
                        const search = filtros.tema;

                        // 1. Buscar en Título
                        const matchTitulo = checkFuzzyMatch(r.titulo, search);
                        // 2. Buscar en Temas (campo texto)
                        const matchTemas = checkFuzzyMatch(r.temas, search);
                        // 3. Buscar en Nombres de Hojas (dentro del array)
                        const matchHojas = r.hojas && r.hojas.some(h => checkFuzzyMatch(h.nombreHoja, search));

                        // Si no coincide ninguno, descartamos
                        if (!matchTitulo && !matchTemas && !matchHojas) return false;
                    }
                    // ----------------------------------------

                    if (filtros.ciclo && cleanText(r.ciclo) !== cleanText(filtros.ciclo) && cleanText(r.config?.ciclo) !== cleanText(filtros.ciclo)) return false;
                    if (filtros.pais && !cleanText(r.pais).includes(cleanText(filtros.pais))) return false;
                    if (filtros.region && !cleanText(r.region).includes(cleanText(filtros.region))) return false;
                    if (filtros.poblacion && !cleanText(r.poblacion).includes(cleanText(filtros.poblacion))) return false;
                    if (filtros.autor && !cleanText(r.profesorNombre).includes(cleanText(filtros.autor))) return false;

                    return true;
                });

                const temaMate = cleanText(filtros.tema);
                const buscarMate = !temaMate || temaMate.includes('matematica') || temaMate.includes('mates') || temaMate.includes('calculo');
                const buscarJuego = !filtros.tipoJuego || filtros.tipoJuego === 'MATHLE';

                if (buscarMate && buscarJuego) {
                    filtrados.unshift(FAKE_MATHLE);
                }
                if (filtrados.length === 0) alert("No se encontraron recursos con esos filtros.");
                setResultados(filtrados);
            }
        } catch (e) { console.error(e); alert("Error en búsqueda."); }
        setBuscando(false);
    };
    const abrirJuego = (appId) => {

        
            // Si pinchan en el portal, cambiamos de pantalla y CREAMOS LA URL
        if (appId === 'MATH_WORLD_PORTAL') {
            setZonaActiva('MATH');
            window.history.pushState({}, '', '/math_world');
            return;
        }

        const appInfo = APPS.find(a => a.id === appId);
        if (appInfo) {
            window.history.pushState({}, '', `/${appInfo.name.toLowerCase()}`);
            window.dispatchEvent(new Event('popstate'));
        }
    };

    const lanzarComoGestor = async (r) => {
        if (!window.confirm("¿Quieres iniciar una sesión en vivo como presentador de este juego?")) return;
        try {
            const sala = Math.floor(100000 + Math.random() * 900000).toString();
            const limitePreguntas = parseInt(r.config?.numPreguntas) || 10;
            let pool = [];
            if (r.hojas) r.hojas.forEach(h => pool.push(...h.preguntas));

            if (r.config?.aleatorio !== false) pool.sort(() => Math.random() - 0.5);

            if (!pool.length) return alert("El recurso no tiene preguntas válidas.");

            const pFin = pool.slice(0, limitePreguntas).map(p => {
                // Protegemos los juegos PRO y OLYMPIC para que no destruya el tipo de pregunta
                // Añadimos también tipoJuego por si creaste el recurso antes de la actualización
                if (r.tipo !== 'PRO' && r.tipo !== 'OLYMPIC' && r.tipoJuego !== 'OLYMPICLIVE') {
                    return { ...p, q: p.pregunta, a: p.correcta || p.respuesta, tipo: (p.incorrectas?.length > 0) ? 'MULTIPLE' : 'SIMPLE', opcionesFijas: (p.incorrectas?.length > 0) ? [p.correcta || p.respuesta, ...p.incorrectas].sort(() => Math.random() - 0.5) : [] };
                }
                return p;
            });

            await setDoc(doc(db, "live_games", sala), {
                hostId: "host_invitado_" + Date.now(),
                recursoId: r.id || 'temp_id',
                recursoTitulo: r.titulo,
                profesorNombre: "Profe Invitado",
                config: r.config || {},
                preguntas: pFin,
                estado: 'LOBBY',
                indicePregunta: 0,
                jugadores: {},
                respuestasRonda: {},
                timestamp: new Date(),
                tipoJuego: r.tipoJuego
            });

            setHostRoomCode(sala);
            setIsMathLiveHost(r.config?.isMathLive === true || r.tipoJuego === 'MATHLIVE');
            setHostTipoJuego(r.tipoJuego);
            setLiveModeHost(true);
        } catch (error) {
            console.error("Error lanzando host:", error);
            alert("Hubo un error al crear la sala.");
        }
    };

    const procesarClickTarjeta = (r) => {
        if (esJuegoEnVivo(r)) lanzarComoGestor(r);
        else if (r.tipoJuego === 'CAZABURBUJAS' || r.tipoJuego === 'PIKATRON' || r.tipoJuego === 'WORDLE' || r.tipoJuego === 'SOPA') setRecursoParaElegir(r);
        else if (r.tipoJuego === 'ETIQUETAS') setJuegoActivo(r);
        else setJuegoActivo(r);
    };

    // --- RENDERIZADO DE JUEGOS A PANTALLA COMPLETA ---

    // 1. Host (Profesor/Gestor)
    if (liveModeHost && hostRoomCode) {
        const tempUser = { uid: "host_invitado_" + Date.now(), displayName: "Profe Invitado", email: null };
        // --- CORRECCIÓN: USAMOS EL ESTADO ---
        if (hostTipoJuego === 'OLYMPICLIVE') return <OlympicLive isHost={true} codigoSala={hostRoomCode} usuario={tempUser} onExit={() => setLiveModeHost(false)} />;
        // ------------------------------------

        if (isMathLiveHost) return <MathLive isHost={true} codigoSala={hostRoomCode} usuario={tempUser} onExit={() => setLiveModeHost(false)} />;
        return <ThinkHootGame isHost={true} codigoSala={hostRoomCode} usuario={tempUser} onExit={() => setLiveModeHost(false)} />;
    }
    if (liveModeAlumno) {
        // Usamos la verdad absoluta de la base de datos, o el de la app si no está
        const tipoFinal = (typeof joinLiveTipoJuego !== 'undefined' && joinLiveTipoJuego) ? joinLiveTipoJuego : (typeof appData !== 'undefined' ? appData.id : '');

        if (tipoFinal === 'OLYMPICLIVE') return <OlympicLive isHost={false} codigoSala={typeof joinCode !== 'undefined' ? joinCode : joinLiveCode} usuario={{ displayName: typeof joinName !== 'undefined' ? joinName : joinLiveName, email: null }} onExit={() => setLiveModeAlumno(false)} />;
        if (tipoFinal === 'MATHLIVE' || isMathLiveAlumno) return <MathLive isHost={false} codigoSala={typeof joinCode !== 'undefined' ? joinCode : joinLiveCode} usuario={{ displayName: typeof joinName !== 'undefined' ? joinName : joinLiveName, email: null }} onExit={() => setLiveModeAlumno(false)} />;

        return <ThinkHootGame isHost={false} codigoSala={typeof joinCode !== 'undefined' ? joinCode : joinLiveCode} usuario={{ displayName: typeof joinName !== 'undefined' ? joinName : joinLiveName, email: null }} onExit={() => setLiveModeAlumno(false)} />;
    }

    
    // 3. Single Player
    if (juegoActivo) {
        if (juegoActivo.tipoJuego === 'QUESTION_SENDER') {
            return (
                <QuestionSenderClient
                    usuario={null} // O el usuario si lo tienes
                    onBack={() => setJuegoActivo(null)}
                    codigoInicial={juegoActivo.codigoInicial} // Pasamos el código para que no tenga que escribirlo de nuevo
                />
            );
        }
       
       
        if (juegoActivo.tipoJuego === 'ETIQUETAS') return <EtiquetaMe recurso={juegoActivo} onExit={() => setJuegoActivo(null)} />;

        if (juegoActivo.tipoJuego === 'GEOMETRIX') return <Geometrix usuario={usuario} onExit={() => setJuegoActivo(null)} />;
        if (juegoActivo.tipoJuego === 'CALCULO') return <CalculoMental usuario={null} onExit={() => setJuegoActivo(null)} />;
        if (juegoActivo.tipoJuego === 'ECUACIONES') return <Ecuaciones usuario={null} onExit={() => setJuegoActivo(null)} />;
        if (juegoActivo.tipoJuego === 'FUNCIONES') return <Funciones onExit={() => setJuegoActivo(null)} />;
        // ------------------------

        if (juegoActivo.modoEspecial === 'PIKATRON') return <PikatronRun recurso={juegoActivo} onExit={() => setJuegoActivo(null)} />;
        if (juegoActivo.tipoJuego === 'RULETA') return <RuletaGame recurso={juegoActivo} usuario={null} alTerminar={() => setJuegoActivo(null)} />;

        // --- CORRECCIÓN: Quitamos appData porque aquí no existe ---
        if (juegoActivo.tipoJuego === 'MATHLE') return <MathWordleGame usuario={null} onExit={() => setJuegoActivo(null)} />;
        // --- AÑADIDO: Distinguir Wordle y Sopa ---
        if (juegoActivo.modoEspecial === 'WORDLE' || (juegoActivo.tipoJuego === 'WORDLE' && !juegoActivo.modoEspecial)) return <TextWordleGame recursoInicial={juegoActivo} usuario={null} onExit={() => setJuegoActivo(null)} />;
        if (juegoActivo.modoEspecial === 'SOPA' || (juegoActivo.tipoJuego === 'SOPA' && !juegoActivo.modoEspecial)) return <SopaDeLetrasGame recursoInicial={juegoActivo} usuario={null} onExit={() => setJuegoActivo(null)} />;
        return <GamePlayer recurso={juegoActivo} usuario={null} alTerminar={() => setJuegoActivo(null)} />;
    }

    // --- PANTALLA EXCLUSIVA MATH WORLD ---
    if (zonaActiva === 'MATH') {
        return (
            <div style={{ width: '100%', marginTop: '20px' }}>
                {/* Botón Volver Modificado */}
                <button onClick={() => {
                    setZonaActiva('MAIN');
                    window.history.pushState({}, '', '/');
                    window.dispatchEvent(new Event('popstate'));
                }} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#333', display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '20px', fontWeight: 'bold' }}>
                    <Home size={20} /> Volver al Menú Principal
                </button>

                <div style={{ textAlign: 'center', marginBottom: '40px' }}>
                    <div style={{ fontSize: '70px', marginBottom: '10px' }}>🌍</div>
                    <h1 style={{ color: '#009688', fontSize: '3rem', margin: 0, textShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>Math World</h1>
                    <p style={{ color: '#666', fontSize: '1.2rem', marginTop: '10px' }}>Tu ecosistema de herramientas matemáticas</p>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '25px', maxWidth: '900px', margin: '0 auto', paddingBottom: '40px' }}>
                    {APPS.filter(app => app.isMath).map(app => (
                        <div
                            key={app.id}
                            onClick={() => {
                                if (app.comingSoon) alert(`¡${app.name} está en desarrollo y llegará muy pronto! 🚀`);
                                else abrirJuego(app.id);
                            }}
                            style={{
                                background: app.comingSoon ? '#f8f9fa' : '#E0F2F1',
                                borderRadius: '20px', padding: '30px 20px', textAlign: 'center',
                                cursor: app.comingSoon ? 'not-allowed' : 'pointer',
                                boxShadow: '0 8px 20px rgba(0,0,0,0.1)', transition: 'transform 0.2s',
                                opacity: app.comingSoon ? 0.7 : 1, border: `3px solid ${app.comingSoon ? '#ddd' : app.color}`
                            }}
                        >
                            <div style={{ fontSize: '50px', marginBottom: '15px', filter: app.comingSoon ? 'grayscale(100%)' : 'none' }}>{app.emoji}</div>
                            <h3 style={{ margin: '0 0 10px 0', color: app.comingSoon ? '#7f8c8d' : app.color, fontSize: '1.4rem' }}>{app.name}</h3>
                            <p style={{ margin: 0, color: '#666', fontSize: '0.95rem' }}>{app.desc}</p>
                            {app.comingSoon && <span style={{ display: 'inline-block', marginTop: '15px', background: '#e0e0e0', color: '#555', padding: '5px 12px', borderRadius: '15px', fontSize: '0.8rem', fontWeight: 'bold' }}>Próximamente</span>}
                        </div>
                    ))}
                </div>
            </div>
        );
    }


    return (
        <div style={{ width: '100%', marginTop: '20px' }}>

            {/* MODAL ELEGIR MODO BURBUJAS/PIKATRON */}
            {recursoParaElegir && (
                <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.8)', zIndex: 5000, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                    <div style={{ background: 'white', padding: '30px', borderRadius: '20px', textAlign: 'center', maxWidth: '400px', width: '90%' }}>
                        <h2 style={{ color: '#2c3e50', margin: '0 0 20px 0' }}>🚀 ¡Elige tu aventura!</h2>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            {(recursoParaElegir.tipoJuego === 'CAZABURBUJAS' || recursoParaElegir.tipoJuego === 'PIKATRON') ? (
                                <>
                                    <button onClick={() => { setJuegoActivo({ ...recursoParaElegir, modoEspecial: 'CAZABURBUJAS' }); setRecursoParaElegir(null); }} style={{ padding: '15px', background: '#E91E63', color: 'white', border: 'none', borderRadius: '10px', fontSize: '1.1rem', cursor: 'pointer', fontWeight: 'bold' }}>🔵 Cazaburbujas Clásico</button>
                                    <button onClick={() => { setJuegoActivo({ ...recursoParaElegir, modoEspecial: 'PIKATRON' }); setRecursoParaElegir(null); }} style={{ padding: '15px', background: '#2196F3', color: 'white', border: 'none', borderRadius: '10px', fontSize: '1.1rem', cursor: 'pointer', fontWeight: 'bold' }}>⚡ Pikatron Run (Runner)</button>
                                </>
                            ) : (
                                    <>
                                        {/* OPCIONES DE WORDLE Y SOPA */}
                                        <button onClick={() => { setJuegoActivo({ ...recursoParaElegir, modoEspecial: 'WORDLE' }); setRecursoParaElegir(null); }} style={{ padding: '15px', background: '#4CAF50', color: 'white', border: 'none', borderRadius: '10px', fontSize: '1.1rem', cursor: 'pointer', fontWeight: 'bold' }}>🟩 Wordle Clásico</button>
                                        <button onClick={() => { setJuegoActivo({ ...recursoParaElegir, modoEspecial: 'SOPA' }); setRecursoParaElegir(null); }} style={{ padding: '15px', background: '#FF9800', color: 'white', border: 'none', borderRadius: '10px', fontSize: '1.1rem', cursor: 'pointer', fontWeight: 'bold' }}>🔍 Sopa de Letras</button>
                                    </>
                                )}
                            <button onClick={() => setRecursoParaElegir(null)} style={{ marginTop: '10px', background: 'transparent', border: 'none', color: '#999', cursor: 'pointer' }}>Cancelar</button>
                        </div>
                    </div>
                </div>
            )}

            {/* BUSCADOR PRINCIPAL (MÁS ANCHO) */}
            <div style={{ background: 'rgba(255,255,255,0.95)', padding: '30px', borderRadius: '20px', boxShadow: '0 4px 15px rgba(0,0,0,0.1)', marginBottom: '30px', maxWidth: '900px', margin: '0 auto 30px auto' }}>
                <h3 style={{ margin: '0 0 20px 0', color: '#333', textAlign: 'center' }}><Search size={20} style={{ verticalAlign: 'middle' }} /> Encuentra un Recurso</h3>

                <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', marginBottom: '20px' }}>
                    <button onClick={() => setModoBusqueda('FILTROS')} style={{ padding: '10px 20px', borderRadius: '20px', border: 'none', background: modoBusqueda === 'FILTROS' ? '#f1c40f' : '#eee', fontWeight: 'bold', cursor: 'pointer' }}><Filter size={16} /> Filtros</button>
                    <button onClick={() => setModoBusqueda('CODIGO')} style={{ padding: '10px 20px', borderRadius: '20px', border: 'none', background: modoBusqueda === 'CODIGO' ? '#f1c40f' : '#eee', fontWeight: 'bold', cursor: 'pointer' }}><Key size={16} /> Código</button>
                </div>

                {modoBusqueda === 'CODIGO' ? (
                    <div style={{ textAlign: 'center' }}>
                        <p style={{ fontSize: '0.9rem', color: '#666', marginBottom: '15px' }}>Si tienes un código de 6 números es una sesión en vivo. Si tiene 4 o 5 letras, es un juego.</p>
                        <input placeholder="Ej: A1B2C o 123456" value={codigo} onChange={e => setCodigo(e.target.value)} style={{ padding: '15px', fontSize: '1.5rem', textAlign: 'center', borderRadius: '10px', border: '2px solid #ddd', width: '100%', maxwidth:'250px', textTransform: 'uppercase', letterSpacing: '3px' }} maxLength={6} />
                    </div>
                ) : (
                        <div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '10px' }}>
                                <select style={styles.input} value={filtros.tipoJuego} onChange={e => setFiltros({ ...filtros, tipoJuego: e.target.value })}>
                                    <option value="">📂 Todos los Juegos</option>
                                    <option value="PASAPALABRA">Pasapalabra</option>
                                    <option value="CAZABURBUJAS">Burbujas/Pikatron</option>
                                    <option value="APAREJADOS">Aparejados</option>
                                    <option value="RULETA">La Ruleta</option>
                                    <option value="SOPA">Sopa de Letras</option>

                                    <option value="WORDLE">WordLe</option>
                                    <option value="THINKHOOT">📡 Live (En Vivo)</option>
                                </select>
                                <select style={styles.input} value={filtros.ciclo} onChange={e => setFiltros({ ...filtros, ciclo: e.target.value })}>
                                    <option value="">🎓 Cualquier Ciclo</option>
                                    <option value="Infantil">Infantil</option>
                                    <option value="Primaria">Primaria</option>
                                    <option value="Secundaria">Secundaria</option>
                                    <option value="Bachillerato">Bachillerato</option>
                                    <option value="FP">FP</option>
                                    <option value="Otros">Otros</option>
                                </select>
                                <input style={styles.input} placeholder="Tema (Ej: Mates...)" value={filtros.tema} onChange={e => setFiltros({ ...filtros, tema: e.target.value })} />
                            </div>

                            {/* BOTÓN MÁS FILTROS */}
                            <div style={{ textAlign: 'right', marginTop: '10px' }}>
                                <button onClick={() => setMostrarMasFiltros(!mostrarMasFiltros)} style={{ background: 'none', border: 'none', color: '#2196F3', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '5px', width: '100%' }}>
                                    {mostrarMasFiltros ? <ChevronUp size={16} /> : <ChevronDown size={16} />} {mostrarMasFiltros ? 'Menos filtros' : 'Más filtros (País, Autor...)'}
                                </button>
                            </div>

                            {mostrarMasFiltros && (
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '10px', marginTop: '10px', padding: '15px', background: '#f5f5f5', borderRadius: '10px' }}>
                                    <input style={styles.input} placeholder="País" value={filtros.pais} onChange={e => setFiltros({ ...filtros, pais: e.target.value })} />
                                    <input style={styles.input} placeholder="Región/Provincia" value={filtros.region} onChange={e => setFiltros({ ...filtros, region: e.target.value })} />
                                    <input style={styles.input} placeholder="Localidad" value={filtros.poblacion} onChange={e => setFiltros({ ...filtros, poblacion: e.target.value })} />
                                    <input style={styles.input} placeholder="Nombre del Profesor" value={filtros.autor} onChange={e => setFiltros({ ...filtros, autor: e.target.value })} />
                                </div>
                            )}
                        </div>
                    )}

                <button onClick={buscar} disabled={buscando} style={{ background: '#2196F3', color: 'white', padding: '12px', border: 'none', borderRadius: '10px', cursor: 'pointer', fontWeight: 'bold', width: '100%', marginTop: '15px', fontSize: '1.1rem' }}>
                    {buscando ? 'Buscando...' : 'Buscar'}
                </button>

                {/* RESULTADOS (2 COLUMNAS, SCROLL VERTICAL) */}
                {resultados.length > 0 && (
                    <div style={{ marginTop: '25px', borderTop: '2px dashed #eee', paddingTop: '20px' }}>
                        <h4 style={{ color: '#666', marginBottom: '15px' }}>Resultados ({resultados.length}):</h4>
                        <div style={{ maxHeight: '400px', overflowY: 'auto', paddingRight: '10px' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '15px' }}>
                                {resultados.map(r => (
                                    <ResourceCard key={r.id} r={r} onClick={() => procesarClickTarjeta(r)} />
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* --- SECCIÓN 1: JUEGOS EN VIVO (TODA LA CLASE) --- */}
            <h2 style={{ color: '#f1c40f', textShadow: '0 2px 4px rgba(0,0,0,0.8)', textAlign: 'center', marginBottom: '20px', marginTop: '30px' }}>
                📡 Juegos para toda la clase (En Vivo)
            </h2>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', marginBottom: '40px', maxWidth: '700px', margin: '0 auto 40px auto' }}>
                {APPS.filter(app => app.isLive).map(app => (
                    <div key={app.id} onClick={() => abrirJuego(app.id)} style={{ background: '#fff', borderRadius: '20px', padding: '20px', textAlign: 'center', cursor: 'pointer', boxShadow: '0 8px 20px rgba(0,0,0,0.3)', border: `4px solid ${app.color}`, transition: 'transform 0.2s', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <div style={{ width: '80px', height: '80px', marginBottom: '15px' }}>
                            <img src={app.img} alt={app.name} style={{ width: '100%', height: '100%', objectFit: 'contain', borderRadius: '15px' }} onError={(e) => e.target.style.display = 'none'} />
                        </div>
                        <h3 style={{ margin: 0, color: app.color, fontSize: '1.4rem', fontWeight: 'bold' }}>{app.name}</h3>
                        <p style={{ margin: '10px 0 0 0', fontSize: '0.9rem', color: '#555', lineHeight: '1.3' }}>{app.desc}</p>
                    </div>
                ))}
            </div>

            {/* --- SECCIÓN 2: JUEGOS INDIVIDUALES / PEQUEÑOS GRUPOS --- */}
            <h2 style={{ color: 'white', textShadow: '0 2px 4px rgba(0,0,0,0.5)', textAlign: 'center', marginBottom: '20px', marginTop: '20px' }}>
                🕹️ Juegos de uno a tres jugadores
            </h2>





            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '15px', marginBottom: '40px' }}>
                {APPS.filter(app => !app.isLive && !app.isMath).map(app => (
                    <div key={app.id} onClick={() => abrirJuego(app.id)} style={{ background: '#ffffbf', borderRadius: '15px', padding: '15px', textAlign: 'center', cursor: 'pointer', boxShadow: '0 4px 10px rgba(0,0,0,0.2)', transition: 'transform 0.2s' }}>
                        <div style={{ width: '60px', height: '60px', margin: '0 auto 10px auto', background: 'transparent', borderRadius: '15px', display: 'flex', justifyContent: 'center', alignItems: 'center', color: 'white' }}>
                            {app.img ? (
                            <img src={app.img} alt={app.name} style={{ width: '60px', height: '60px', objectFit: 'contain', borderRadius: '15px' }} onError={(e) => e.target.style.display = 'none'} />
                            ) : (
                                    <span style={{ fontSize: '45px', lineHeight: '1' }}>{app.emoji}</span>
                                )}

                        </div>
                        <h4 style={{ margin: 0, color: '#333', fontSize: '0.9rem' }}>{app.name}</h4>
                    </div>
                ))}
            </div>
            {/* ========================================= */}
            {/* FOOTER DE LICENCIA (PANTALLA PRINCIPAL) */}
            {/* ========================================= */}
            <div style={{ textAlign: 'center', padding: '20px', marginTop: '40px', fontSize: '0.85rem', color: '#fff', borderTop: '1px solid rgba(255,255,255,0.2)' }}>
                <a href="https://github.com/goladen/educando" target="_blank" rel="noopener noreferrer" style={{ color: '#f1c40f', fontWeight: 'bold', textDecoration: 'none' }}>Pikt.es</a>
                {' '}© 2025 by{' '}
                <a href="https://pikt.es" target="_blank" rel="noopener noreferrer" style={{ color: '#fff', textDecoration: 'none' }}>Gonzalo Larrocha</a>
                {' '}is licensed under{' '}
                <a href="https://creativecommons.org/licenses/by-nc-nd/4.0/" target="_blank" rel="noopener noreferrer" style={{ color: '#fff', textDecoration: 'underline' }}>Creative Commons Attribution-NonCommercial-NoDerivatives 4.0 International</a>

                <span style={{ display: 'inline-flex', alignItems: 'center', marginLeft: '8px', gap: '3px', verticalAlign: 'middle', filter: 'invert(1)' /* Pone los iconos blancos */ }}>
                    <img src="https://mirrors.creativecommons.org/presskit/icons/cc.svg" alt="CC" style={{ width: '1.2em', height: '1.2em' }} />
                    <img src="https://mirrors.creativecommons.org/presskit/icons/by.svg" alt="BY" style={{ width: '1.2em', height: '1.2em' }} />
                    <img src="https://mirrors.creativecommons.org/presskit/icons/nc.svg" alt="NC" style={{ width: '1.2em', height: '1.2em' }} />
                    <img src="https://mirrors.creativecommons.org/presskit/icons/nd.svg" alt="ND" style={{ width: '1.2em', height: '1.2em' }} />
                </span>
            </div>

       
    
        </div>
    );
}

// TARJETA DE RECURSO IDENTIFICADA POR COLOR Y SIN DATOS DE PROFESOR
export const ResourceCard = ({ r, onClick }) => {
    const appInfo = getAppInfo(r.tipoJuego);
    const isLive = esJuegoEnVivo(r);

    return (
        <div onClick={onClick} style={{ background: '#e3f2fd', padding: '15px', borderRadius: '12px', borderLeft: `6px solid ${appInfo.color}`, cursor: 'pointer', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', height: '80%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', border: '1px solid #eee' }}>
            <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                    <h4 style={{ margin: 0, color: '#333', fontSize: '1.05rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '75%' }} title={r.titulo}>{r.titulo}</h4>
                    <span style={{ background: appInfo.color, color: 'white', padding: '3px 8px', borderRadius: '10px', fontSize: '0.65rem', fontWeight: 'bold' }}>{appInfo.name}</span>
                </div>

                <div style={{ fontSize: '0.85rem', color: '#555', background: '#f9f9f9', padding: '8px', borderRadius: '8px' }}>
                    <div style={{ marginBottom: '4px' }}><b>📚 Tema:</b> {r.temas || 'General'}</div>
                    <div style={{ marginBottom: '4px' }}><b>🎓 Ciclo:</b> {r.ciclo || r.config?.ciclo || 'Todos'}</div>
                    <div style={{ color: '#888', fontSize: '0.75rem', marginTop: '6px' }}>
                        <b>Niveles/Hojas:</b> {r.hojas?.map(h => h.nombreHoja).join(', ') || 'Nivel 1'}
                    </div>
                </div>
            </div>
            <div style={{ marginTop: '15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ background: '#eee', padding: '4px 8px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 'bold', color: '#555' }}>
                    <Key size={12} style={{ verticalAlign: 'middle' }} /> {r.accessCode || '---'}
                </span>
                {isLive ? <Zap size={20} color={appInfo.color} style={{ opacity: 0.8 }} /> : <Play size={20} color={appInfo.color} style={{ opacity: 0.8 }} />}
            </div>
        </div>
    );
};

// --- NUEVO COMPONENTE ENVOLTORIO PARA ENLACES DIRECTOS A Q-SENDER ---
const QuestionSenderWrapper = ({ onHome, initialJuegoActivo }) => {
    const [qsCode, setQsCode] = useState('');
    const [juegoActivo, setJuegoActivo] = useState(initialJuegoActivo);
    const [loadingMsg, setLoadingMsg] = useState('');

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const codeFromUrl = params.get('c'); // Detecta si la url es ?c=A1B2C
        if (codeFromUrl && !juegoActivo) {
            setQsCode(codeFromUrl.toUpperCase());
            abrirCliente(codeFromUrl.toUpperCase());
        }
    }, []);

    const abrirCliente = async (codeToUse) => {
        const targetCode = codeToUse || qsCode;
        if (!targetCode || targetCode.trim().length < 4) return alert("Introduce un código válido.");
        setLoadingMsg('Conectando...');

        const qSender = query(collection(db, 'resources'), where("hojasCodes", "array-contains", targetCode.toUpperCase().trim()));
        const snapSender = await getDocs(qSender);

        if (!snapSender.empty) {
            setJuegoActivo({
                ...snapSender.docs[0].data(),
                id: snapSender.docs[0].id,
                tipoJuego: 'QUESTION_SENDER',
                codigoInicial: targetCode.toUpperCase().trim()
            });
        } else {
            alert("Código de hoja no encontrado. Pídeselo a tu profesor.");
            if (window.location.search.includes('c=')) window.history.replaceState({}, '', '/q-sender');
        }
        setLoadingMsg('');
    };

    if (juegoActivo) {
        return <QuestionSenderClient usuario={null} onBack={() => { setJuegoActivo(null); window.history.replaceState({}, '', '/q-sender'); }} codigoInicial={juegoActivo.codigoInicial} />;
    }

    return (
        <div style={{ width: '100%', minHeight: '100vh', background: '#2c3e50', display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px' }}>
            <div style={{ background: 'white', padding: '40px', borderRadius: '20px', textAlign: 'center', maxWidth: '500px', width: '100%', boxShadow: '0 10px 30px rgba(0,0,0,0.3)' }}>
                <div style={{ marginBottom: '20px', fontSize: '80px', lineHeight: '1' }}>📮</div>
                <h2 style={{ color: '#2c3e50', margin: '0 0 10px 0' }}>Buzón de Preguntas</h2>
                <p style={{ color: '#7f8c8d', marginBottom: '30px' }}>Introduce el código de tu grupo para enviar preguntas.</p>

                <input value={qsCode} onChange={e => setQsCode(e.target.value.toUpperCase())} placeholder="CÓDIGO (Ej: A1B2)" style={{ width: '100%', padding: '15px', fontSize: '1.5rem', textAlign: 'center', borderRadius: '10px', border: '2px solid #bdc3c7', marginBottom: '20px', letterSpacing: '3px', textTransform: 'uppercase', boxSizing: 'border-box' }} maxLength={5} />

                <button onClick={() => abrirCliente()} disabled={!!loadingMsg} style={{ width: '100%', padding: '15px', background: '#27ae60', color: 'white', border: 'none', borderRadius: '10px', fontSize: '1.2rem', fontWeight: 'bold', cursor: 'pointer', marginBottom: '15px' }}>
                    {loadingMsg || 'ENTRAR'}
                </button>

                <button onClick={onHome} style={{ background: 'transparent', border: 'none', color: '#95a5a6', cursor: 'pointer', fontSize: '0.9rem', textDecoration: 'underline' }}>Volver al inicio</button>
            </div>
        </div>
    );
};




// PÁGINA ESPECÍFICA DEL JUEGO
export const SpecificGamePage = ({ appData, onHome, onLoginRequest }) => {
    const [tab, setTab] = useState(appData.isLive ? 'LIVE' : 'SEARCH');
    const [filtros, setFiltros] = useState({ tema: '', ciclo: '', pais: '', region: '', poblacion: '', autor: '' });
    const [mostrarMasFiltros, setMostrarMasFiltros] = useState(false);
    const [codigo, setCodigo] = useState('');
    const [resultados, setResultados] = useState([]);

    // Live Alumno
    const [joinCode, setJoinCode] = useState('');
    const [joinName, setJoinName] = useState('');
    const [liveModeAlumno, setLiveModeAlumno] = useState(false);
    const [joinLiveTipoJuego, setJoinLiveTipoJuego] = useState('');
    // Gestor/Single Player
    const [liveModeHost, setLiveModeHost] = useState(false);
    const [hostRoomCode, setHostRoomCode] = useState('');
    const [juegoActivo, setJuegoActivo] = useState(null);
    const [recursoParaElegir, setRecursoParaElegir] = useState(null);
    // --- NUEVAS FUNCIONES DE SALIDA DIRECTA ---
    const handleExitGame = () => {
        if (appData.isMath) {
            window.history.pushState({}, '', '/math_world');
            window.dispatchEvent(new Event('popstate'));
        } else {
            setJuegoActivo(null);
        }
    };

    const handleVolverMenu = () => {
        if (appData.isMath) {
            window.history.pushState({}, '', '/math_world');
            window.dispatchEvent(new Event('popstate'));
        } else {
            onHome();
        }
    };

    if (juegoActivo) {
        // Usa handleExitGame en lugar de setJuegoActivo(null)
        if (appData.id === 'GEOMETRIX' || juegoActivo.tipoJuego === 'GEOMETRIX') return <Geometrix usuario={null} onExit={handleExitGame} />;
        if (appData.id === 'CALCULO' || juegoActivo.tipoJuego === 'CALCULO') return <CalculoMental usuario={null} onExit={handleExitGame} />;
        if (appData.id === 'ECUACIONES' || juegoActivo.tipoJuego === 'ECUACIONES') return <Ecuaciones onExit={handleExitGame} />;
        if (appData.id === 'FUNCIONES' || juegoActivo.tipoJuego === 'FUNCIONES') return <Funciones usuario={null} onExit={handleExitGame} />;

    }
    // --- NUEVO: ATAJO PARA JUEGOS CON MENÚ PROPIO ---
    if (appData.id === 'WORDLE') return <TextWordleGame usuario={null} onExit={onHome} />;
    if (appData.id === 'MATHLE') return <MathWordleGame usuario={null} onExit={onHome} />;
    if (appData.id === 'SOPA') return <SopaDeLetrasGame usuario={null} onExit={onHome} />;
    // --------


    if (appData.id === 'SINTAXIS') return <SintaxisGame usuario={null} onExit={onHome} />;
    if (appData.id === 'PIKATRON_2') return <Plataformas usuario={null} onExit={onHome} />;
    // --- NUEVO: USA handleExitGame PARA LOS DE MATES ---
    if (appData.id === 'GEOMETRIX') return <Geometrix usuario={null} onExit={handleExitGame} />;
    if (appData.id === 'CALCULO') return <CalculoMental usuario={null} onExit={handleExitGame} />;
    if (appData.id === 'ECUACIONES') return <Ecuaciones usuario={null} onExit={handleExitGame} />;
    if (appData.id === 'FUNCIONES') return <Funciones usuario={null} onExit={handleExitGame} />;

    // ------------------------// ------------------------
    // --- CASO ESPECIAL: QUESTION SENDER ---
    // --- CASO ESPECIAL: QUESTION SENDER ---
    if (appData.id === 'QUESTION_SENDER') {
        return <QuestionSenderWrapper onHome={onHome} initialJuegoActivo={juegoActivo} />;
    }

    const buscarEspecífico = async () => {
        try {
            const ref = collection(db, 'resources');
            let filtrados = [];

            if (codigo) {
                const q = query(ref, where("accessCode", "==", codigo.toUpperCase().trim()));
                const snap = await getDocs(q);
                if (!snap.empty) {
                    const data = snap.docs[0].data();
                    //const esEsteJuego = data.tipoJuego === appData.id;
                    let esEsteJuego = data.tipoJuego === appData.id;
                    if (appData.id === 'CAZABURBUJAS' || appData.id === 'PIKATRON') {
                        esEsteJuego = (data.tipoJuego === 'CAZABURBUJAS' || data.tipoJuego === 'PIKATRON');
                    }
                    else if (appData.id === 'SOPA' || appData.id === 'WORDLE') {
                        // MAGIA: Sopa y Wordle comparten los mismos recursos
                        esEsteJuego = (data.tipoJuego === 'SOPA' || data.tipoJuego === 'WORDLE');
                    }



                    const esPiLiveAntiguo = appData.id === 'THINKHOOT' && data.tipo === 'PRO' && data.tipoJuego !== 'WORDLE';

                    if (esEsteJuego || esPiLiveAntiguo) {
                        filtrados = [{ ...data, id: snap.docs[0].id }];
                    } else {
                        alert("Código no encontrado para este juego.");
                    }
                } else alert("Código no encontrado.");
            } else {
                const q = query(ref, limit(150));
                const snap = await getDocs(q);
                filtrados = snap.docs.map(d => ({ ...d.data(), id: d.id })).filter(r => {
                  //  const esEsteJuego = r.tipoJuego === appData.id;
                    let esEsteJuego = r.tipoJuego === appData.id;
                    if (appData.id === 'CAZABURBUJAS' || appData.id === 'PIKATRON') {
                        esEsteJuego = (r.tipoJuego === 'CAZABURBUJAS' || r.tipoJuego === 'PIKATRON');
                    }
                    else if (appData.id === 'SOPA' || appData.id === 'WORDLE') {
                        // MAGIA: Sopa y Wordle comparten los mismos recursos
                        esEsteJuego = (data.tipoJuego === 'SOPA' || data.tipoJuego === 'WORDLE');
                    }



                    const esPiLiveAntiguo = appData.id === 'THINKHOOT' && r.tipo === 'PRO' && r.tipoJuego !== 'WORDLE';

                    if (!esEsteJuego && !esPiLiveAntiguo) return false;
                    if (r.isFinished !== true && r.config?.isFinished !== true) return false;

                    if (filtros.tema && !cleanText(r.temas).includes(cleanText(filtros.tema)) && !cleanText(r.titulo).includes(cleanText(filtros.tema))) return false;
                    if (filtros.ciclo && cleanText(r.ciclo) !== cleanText(filtros.ciclo)) return false;

                    if (filtros.pais && !cleanText(r.pais).includes(cleanText(filtros.pais))) return false;
                    if (filtros.region && !cleanText(r.region).includes(cleanText(filtros.region))) return false;
                    if (filtros.poblacion && !cleanText(r.poblacion).includes(cleanText(filtros.poblacion))) return false;
                    if (filtros.autor && !cleanText(r.profesorNombre).includes(cleanText(filtros.autor))) return false;

                    return true;
                });
            }
            setResultados(filtrados);
        } catch (e) { console.error(e); }
    };

    const lanzarComoGestor = async (r) => {
        if (!window.confirm("¿Quieres iniciar una sesión en vivo como presentador de este juego?")) return;
        try {
            const sala = Math.floor(100000 + Math.random() * 900000).toString();
            const limitePreguntas = parseInt(r.config?.numPreguntas) || 10;
            let pool = [];
            if (r.hojas) r.hojas.forEach(h => pool.push(...h.preguntas));
            if (r.config?.aleatorio !== false) pool.sort(() => Math.random() - 0.5);

            const pFin = pool.slice(0, limitePreguntas).map(p => {
                // Protegemos los juegos PRO y OLYMPIC para que no destruya el tipo de pregunta
                // Añadimos también tipoJuego por si creaste el recurso antes de la actualización
                if (r.tipo !== 'PRO' && r.tipo !== 'OLYMPIC' && r.tipoJuego !== 'OLYMPICLIVE') {
                    return { ...p, q: p.pregunta, a: p.correcta || p.respuesta, tipo: (p.incorrectas?.length > 0) ? 'MULTIPLE' : 'SIMPLE', opcionesFijas: (p.incorrectas?.length > 0) ? [p.correcta || p.respuesta, ...p.incorrectas].sort(() => Math.random() - 0.5) : [] };
                }
                return p;
            });

            await setDoc(doc(db, "live_games", sala), {
                hostId: "host_invitado_" + Date.now(),
                recursoId: r.id || 'temp_id',
                recursoTitulo: r.titulo,
                profesorNombre: "Profe Invitado",
                config: r.config || {},
                preguntas: pFin,
                estado: 'LOBBY',
                indicePregunta: 0,
                jugadores: {},
                respuestasRonda: {},
                timestamp: new Date(),
                tipoJuego: r.tipoJuego
            });

            setHostRoomCode(sala);
            setLiveModeHost(true);
        } catch (error) { console.error(error); alert("Error al crear la sala."); }
    };

    const procesarClickTarjeta = (r) => {
        if (appData.isLive) lanzarComoGestor(r);
        else if (r.tipoJuego === 'CAZABURBUJAS' || r.tipoJuego === 'WORDLE' || r.tipoJuego === 'SOPA') setRecursoParaElegir(r);
        else if (r.tipoJuego === 'ETIQUETAS') setJuegoActivo(r);
        else setJuegoActivo(r);
    };

    // --- RENDERIZADO PANTALLA COMPLETA ---
    // En móviles al usar position:fixed u ocupar 100vh se verá a pantalla completa
    if (liveModeHost && hostRoomCode) {
        if (appData.id === 'MATHLIVE') return <MathLive isHost={true} codigoSala={hostRoomCode} usuario={{ uid: "host", displayName: "Profe" }} onExit={() => setLiveModeHost(false)} />;
        return <ThinkHootGame isHost={true} codigoSala={hostRoomCode} usuario={{ uid: "host", displayName: "Profe" }} onExit={() => setLiveModeHost(false)} />;
    }

    if (liveModeAlumno) {
        // Usamos la verdad absoluta de la base de datos, o el de la app si no está
        const tipoFinal = (typeof joinLiveTipoJuego !== 'undefined' && joinLiveTipoJuego) ? joinLiveTipoJuego : (typeof appData !== 'undefined' ? appData.id : '');

        if (tipoFinal === 'OLYMPICLIVE') return <OlympicLive isHost={false} codigoSala={typeof joinCode !== 'undefined' ? joinCode : joinLiveCode} usuario={{ displayName: typeof joinName !== 'undefined' ? joinName : joinLiveName, email: null }} onExit={() => setLiveModeAlumno(false)} />;
        if (tipoFinal === 'MATHLIVE' || isMathLiveAlumno) return <MathLive isHost={false} codigoSala={typeof joinCode !== 'undefined' ? joinCode : joinLiveCode} usuario={{ displayName: typeof joinName !== 'undefined' ? joinName : joinLiveName, email: null }} onExit={() => setLiveModeAlumno(false)} />;

        return <ThinkHootGame isHost={false} codigoSala={typeof joinCode !== 'undefined' ? joinCode : joinLiveCode} usuario={{ displayName: typeof joinName !== 'undefined' ? joinName : joinLiveName, email: null }} onExit={() => setLiveModeAlumno(false)} />;
    }

    if (juegoActivo) {
        if (appData.id === 'PIKATRON' || juegoActivo.modoEspecial === 'PIKATRON') return <PikatronRun recurso={juegoActivo} onExit={() => setJuegoActivo(null)} />;
        if (appData.id === 'RULETA') return <RuletaGame recurso={juegoActivo} usuario={null} alTerminar={() => setJuegoActivo(null)} />;
        // --- AÑADIDO: Distinguir Wordle y Sopa ---
        if (appData.id === 'WORDLE' || juegoActivo.modoEspecial === 'WORDLE' || (juegoActivo.tipoJuego === 'WORDLE' && !juegoActivo.modoEspecial)) return <TextWordleGame recursoInicial={juegoActivo} usuario={null} onExit={() => setJuegoActivo(null)} />;
        if (appData.id === 'SOPA' || juegoActivo.modoEspecial === 'SOPA' || (juegoActivo.tipoJuego === 'SOPA' && !juegoActivo.modoEspecial)) return <SopaDeLetrasGame recursoInicial={juegoActivo} usuario={null} onExit={() => setJuegoActivo(null)} />;
        if (appData.id === 'ETIQUETAS' || juegoActivo.tipoJuego === 'ETIQUETAS')     return <EtiquetaMe recurso={juegoActivo} onExit={() => setJuegoActivo(null)} />;
        return <GamePlayer recurso={juegoActivo} usuario={null} alTerminar={() => setJuegoActivo(null)} />;
    }

    return (
        <div style={{ width: '100%', minHeight: '100vh', background: '#f0f2f5', display: 'flex', justifyContent: 'center', alignItems: 'flex-start' }}>

            {/* MODAL ELEGIR MODO BURBUJAS/PIKATRON */}
            {recursoParaElegir && (
                <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.8)', zIndex: 5000, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                    <div style={{ background: 'white', padding: '30px', borderRadius: '20px', textAlign: 'center', maxWidth: '400px', width: '90%' }}>
                        <h2 style={{ color: '#2c3e50', margin: '0 0 20px 0' }}>🚀 ¡Elige tu aventura!</h2>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            {(recursoParaElegir.tipoJuego === 'CAZABURBUJAS' || recursoParaElegir.tipoJuego === 'PIKATRON') ? (
                                <>
                                    <button onClick={() => { setJuegoActivo({ ...recursoParaElegir, modoEspecial: 'CAZABURBUJAS' }); setRecursoParaElegir(null); }} style={{ padding: '15px', background: '#E91E63', color: 'white', border: 'none', borderRadius: '10px', fontSize: '1.1rem', cursor: 'pointer', fontWeight: 'bold' }}>🔵 Cazaburbujas Clásico</button>
                                    <button onClick={() => { setJuegoActivo({ ...recursoParaElegir, modoEspecial: 'PIKATRON' }); setRecursoParaElegir(null); }} style={{ padding: '15px', background: '#2196F3', color: 'white', border: 'none', borderRadius: '10px', fontSize: '1.1rem', cursor: 'pointer', fontWeight: 'bold' }}>⚡ Pikatron Run (Runner)</button>
                                </>
                            ) : (
                                    <>
                                        {/* OPCIONES DE WORDLE Y SOPA */}
                                        <button onClick={() => { setJuegoActivo({ ...recursoParaElegir, modoEspecial: 'WORDLE' }); setRecursoParaElegir(null); }} style={{ padding: '15px', background: '#4CAF50', color: 'white', border: 'none', borderRadius: '10px', fontSize: '1.1rem', cursor: 'pointer', fontWeight: 'bold' }}>🟩 Wordle Clásico</button>
                                        <button onClick={() => { setJuegoActivo({ ...recursoParaElegir, modoEspecial: 'SOPA' }); setRecursoParaElegir(null); }} style={{ padding: '15px', background: '#FF9800', color: 'white', border: 'none', borderRadius: '10px', fontSize: '1.1rem', cursor: 'pointer', fontWeight: 'bold' }}>🔍 Sopa de Letras</button>
                                    </>
                                )}
                            <button onClick={() => setRecursoParaElegir(null)} style={{ marginTop: '10px', background: 'transparent', border: 'none', color: '#999', cursor: 'pointer' }}>Cancelar</button>
                        </div>
                    </div>
                </div>
            )}

            <div style={{ width: '100%', maxWidth: '900px', background: `color-mix(in srgb, ${appData.color}, white 60%)`, minHeight: '100vh', padding: '20px', boxShadow: '0 0 20px rgba(0,0,0,0.1)' }}>
                <button onClick={onHome} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'black', display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '20px', fontWeight: 'bold' }}>
                    <Home size={20} /> Volver al Inicio
                </button>

                <div style={{ textAlign: 'center', marginBottom: '30px' }}>
                    <div style={{ width: '80px', height: '80px', margin: '0 auto', background: 'transparent', borderRadius: '20px', display: 'flex', justifyContent: 'center', alignItems: 'center', color: 'white', boxShadow: '0 4px 10px rgba(0,0,0,0.2)' }}>
                        <img src={appData.img} alt={appData.name} style={{ width: '100px', borderRadius:'15px' }} onError={(e) => e.target.style.display = 'none'} />
                    </div>
                    <h1 style={{ color: appData.color, margin: '15px 0 5px 0', fontSize: '2.5rem' }}>{appData.name}</h1>
                    <p style={{ color: appData.color, fontStyle: 'italic', fontSize: '1.1rem', marginBottom: '20px' }}>{appData.desc}</p>

                    {/* CONTENEDOR DE BOTONES */}
                    <div style={{ display: 'flex', gap: '15px', justifyContent: 'center', flexWrap: 'wrap' }}>

                        {/* BOTÓN EXCLUSIVO PARA JUGAR DIRECTO CON IA */}
                        {(appData.id === 'SINTAXIS' || appData.id === 'GEOMETRIX') && (
                            <button
                                onClick={() => setJuegoActivo({ tipoJuego: appData.id, isIA: true })}
                                style={{
                                    background: 'white',
                                    color: appData.color,
                                    padding: '12px 30px',
                                    border: `2px solid white`,
                                    borderRadius: '30px',
                                    fontWeight: 'bold',
                                    cursor: 'pointer',
                                    fontSize: '1.1rem',
                                    boxShadow: '0 4px 10px rgba(0,0,0,0.2)',
                                    transition: 'all 0.2s',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '10px'
                                }}
                            >
                                {appData.id === 'SINTAXIS' ? '🤖 Jugar Directamente (IA)' : '📐 Jugar Modo Aleatorio'}
                            </button>
                        )}

                        <button
                            onClick={() => onLoginRequest && onLoginRequest()}
                            style={{
                                background: appData.color,
                                color: 'white',
                                padding: '12px 30px',
                                border: `2px solid ${appData.color}`,
                                borderRadius: '30px',
                                fontWeight: 'bold',
                                cursor: 'pointer',
                                fontSize: '1.1rem',
                                boxShadow: '0 4px 10px rgba(0,0,0,0.2)',
                                transition: 'all 0.2s',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '10px'
                            }}
                        >
                            🚀 Únete para crear
                        </button>
                    </div>



                </div>

                {appData.isLive && (
                    <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', marginBottom: '20px' }}>
                        <button onClick={() => setTab('LIVE')} style={{ padding: '10px 20px', border: 'none', borderRadius: '20px', background: tab === 'LIVE' ? appData.color : '#eee', color: tab === 'LIVE' ? 'white' : '#555', fontWeight: 'bold', cursor: 'pointer' }}>📡 Unirse en Vivo</button>
                        <button onClick={() => setTab('SEARCH')} style={{ padding: '10px 20px', border: 'none', borderRadius: '20px', background: tab === 'SEARCH' ? appData.color : '#eee', color: tab === 'SEARCH' ? 'white' : '#555', fontWeight: 'bold', cursor: 'pointer' }}>🔍 Buscar Juegos para Presentar</button>
                    </div>
                )}

                {tab === 'LIVE' && appData.isLive && (
                    <div style={{ background: '#f9f9f9', padding: '40px', borderRadius: '15px', textAlign: 'center', border: `2px solid ${appData.color}` }}>
                        <h3>Introduce el código de la sala</h3>
                        <input placeholder="Código de 6 números" value={joinCode} onChange={e => setJoinCode(e.target.value)} style={{ ...styles.input, width: '250px', display: 'block', margin: '15px auto', textAlign: 'center', fontSize: '1.5rem', letterSpacing: '2px' }} maxLength={6} />
                        <input placeholder="Tu Nombre" value={joinName} onChange={e => setJoinName(e.target.value)} style={{ ...styles.input, width: '250px', display: 'block', margin: '10px auto', textAlign: 'center', fontSize: '1.2rem' }} />

                        <button onClick={async () => {
                            if (joinCode.length === 6 && joinName) {
                                const salaSnap = await getDoc(doc(db, "live_games", joinCode.toUpperCase().trim()));
                                if (salaSnap.exists()) {
                                    setJoinLiveTipoJuego(salaSnap.data().tipoJuego || '');
                                    setLiveModeAlumno(true);
                                } else alert("Código incorrecto o sala no iniciada.");
                            } else alert("Introduce código y nombre.");
                        }} style={{ background: appData.color, color: 'white', padding: '15px 50px', border: 'none', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer', marginTop: '20px', fontSize: '1.2rem' }}>ENTRAR AL JUEGO</button>
                    </div>
                )}

                {tab === 'SEARCH' && (
                    <div style={{ background: '#f5f5f5', padding: '30px', borderRadius: '15px' }}>
                        <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
                            <input placeholder="Tema o Título..." value={filtros.tema} onChange={e => setFiltros({ ...filtros, tema: e.target.value })} style={styles.input} />
                            <select value={filtros.ciclo} onChange={e => setFiltros({ ...filtros, ciclo: e.target.value })} style={styles.input}>
                                <option value="">Cualquier Ciclo</option>
                                <option value="Infantil">Primaria</option>
                                <option value="Primaria">Primaria</option>
                                <option value="Secundaria">Secundaria</option>
                                <option value="Bachillerato">Bachillerato</option>
                                <option value="FP">FP</option>
                                <option value="Otros">Otros</option>
                            </select>
                        </div>

                        <div style={{ textAlign: 'right', marginTop: '10px' }}>
                            <button onClick={() => setMostrarMasFiltros(!mostrarMasFiltros)} style={{ background: 'none', border: 'none', color: appData.color, fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '5px', width: '100%', fontSize: '0.9rem' }}>
                                {mostrarMasFiltros ? <ChevronUp size={16} /> : <ChevronDown size={16} />} {mostrarMasFiltros ? 'Menos filtros' : 'Búsqueda avanzada y Código'}
                            </button>
                        </div>

                        {mostrarMasFiltros && (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '10px', marginTop: '15px', padding: '15px', background: '#ebebeb', borderRadius: '10px' }}>
                                <input style={styles.input} placeholder="CÓDIGO (4 o 5 letras)" value={codigo} onChange={e => setCodigo(e.target.value)} />
                                <input style={styles.input} placeholder="País" value={filtros.pais} onChange={e => setFiltros({ ...filtros, pais: e.target.value })} />
                                <input style={styles.input} placeholder="Región" value={filtros.region} onChange={e => setFiltros({ ...filtros, region: e.target.value })} />
                                <input style={styles.input} placeholder="Autor" value={filtros.autor} onChange={e => setFiltros({ ...filtros, autor: e.target.value })} />
                            </div>
                        )}

                        <button onClick={buscarEspecífico} style={{ background: appData.color, color: 'white', padding: '15px', width: '100%', border: 'none', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer', fontSize: '1.1rem', marginTop: '20px' }}>Buscar en {appData.name}</button>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '15px', marginTop: '25px' }}>
                            {resultados.map(r => <ResourceCard key={r.id} r={r} onClick={() => procesarClickTarjeta(r)} />)}
                        </div>
                    </div>
                )}

                {/* ========================================= */}
                {/* FOOTER DE LICENCIA (PANTALLA PRINCIPAL) */}
                {/* ========================================= */}
                <div style={{ textAlign: 'center', padding: '20px', marginTop: '40px', fontSize: '0.85rem', color: '#666', borderTop: '1px solid rgba(0,0,0,0.1)' }}>
                    <a href="https://github.com/goladen/educando" target="_blank" rel="noopener noreferrer" style={{ color: '#2c3e50', fontWeight: 'bold', textDecoration: 'none' }}>Pikt.es</a>
                    {' '}© 2025 by{' '}
                    <a href="https://pikt.es" target="_blank" rel="noopener noreferrer" style={{ color: '#2c3e50', textDecoration: 'none' }}>Gonzalo Larrocha</a>
                    {' '}is licensed under{' '}
                    <a href="https://creativecommons.org/licenses/by-nc-nd/4.0/" target="_blank" rel="noopener noreferrer" style={{ color: '#2c3e50', textDecoration: 'underline' }}>Creative Commons Attribution-NonCommercial-NoDerivatives 4.0 International</a>
                    <span style={{ display: 'inline-flex', alignItems: 'center', marginLeft: '8px', gap: '3px', verticalAlign: 'middle', filter: 'invert(1)' /* Pone los iconos blancos */ }}>
                        <img src="https://mirrors.creativecommons.org/presskit/icons/cc.svg" alt="CC" style={{ width: '1.2em', height: '1.2em' }} />
                        <img src="https://mirrors.creativecommons.org/presskit/icons/by.svg" alt="BY" style={{ width: '1.2em', height: '1.2em' }} />
                        <img src="https://mirrors.creativecommons.org/presskit/icons/nc.svg" alt="NC" style={{ width: '1.2em', height: '1.2em' }} />
                        <img src="https://mirrors.creativecommons.org/presskit/icons/nd.svg" alt="ND" style={{ width: '1.2em', height: '1.2em' }} />
                    </span>
                </div>

            </div>
    
        
            </div>
        


    );



}

const styles = {
    input: { padding: '12px',width:'100%', borderRadius: '8px', border: '1px solid #ccc', outline: 'none', flex: 1, fontSize: '0.95rem' }
};