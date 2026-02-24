import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, where, getDocs, orderBy, limit, doc, getDoc, setDoc } from 'firebase/firestore';
import { Search, Key, Filter, Zap, Play, Home, ChevronDown, ChevronUp } from 'lucide-react';
import GamePlayer from '../GamePlayer';
import ThinkHootGame from '../ThinkHootGame';
import RuletaGame from '../RuletaGame';
import MathLive from '../MathLive';
import PikatronRun from '../PikatronRun';
import TextWordleGame from '../TextWordleGame';
import MathWordleGame from '../MathWordleGame';
import SopaDeLetrasGame from '../SopaDeLetrasGame';
import imgPasapalabra from '../assets/icono_pasapal.png'; // Revisa si es .png o .jpg
import imgBurbujas from '../assets/icono_burbujas.png';
import imgPikatron from '../assets/icono_pikatron.png';
import imgAparejados from '../assets/icono_aparejados.png';
import imgRuleta from '../assets/icono_ruleta.png';
import imgWordle from '../assets/icono_wordle.png';
import imgMathle from '../assets/icono_mathle.png';
import imgPilive from '../assets/icono_pilive.png';
import imgMathlive from '../assets/icono_mathlive.png';
import imgSopa from '../assets/icono_sopa.png';
// --- CONFIGURACIÓN DE APLICACIONES Y COLORES ---
export const APPS = [
    { id: 'PASAPALABRA', name: 'Pasapalabra', desc: 'Adivina la palabra con cada letra del abecedario.', color: '#0A0E45', img: imgPasapalabra },
    { id: 'CAZABURBUJAS', name: 'Burbujas', desc: 'Explota la burbuja con la respuesta correcta.', color: '#de896e', img: imgBurbujas },
    { id: 'PIKATRON', name: 'Pikatron', desc: 'Juego tipo runner con preguntas.', color: '#2196F3', img: imgPikatron },
    { id: 'APAREJADOS', name: 'AparejaDOS', desc: 'Encuentra las parejas correctas.', color: '#FF9800', img: imgAparejados },
    { id: 'RULETA', name: 'Ruleta', desc: 'Resuelve el panel oculto.', color: '#f1c40f', img: imgRuleta },
    { id: 'WORDLE', name: 'WordLe', desc: 'Adivina la palabra en 6 intentos.', color: '#2e7d32', img: imgWordle },
    { id: 'MATHLE', name: 'MathLe', desc: 'Adivina la ecuación matemática oculta.', color: '#1565C0', img: imgMathle },
    { id: 'THINKHOOT', name: 'PiLive', desc: 'Diviértete en vivo con tus compañeros.', color: '#9C27B0', img: imgPilive, isLive: true },
    { id: 'MATHLIVE', name: 'MathLive', desc: 'Juega con las mates en tiempo real.', color: '#009688', img: imgMathlive, isLive: true },
    { id: 'SOPA', name: 'Sopa_letras', desc: 'Encuentra las palabras ocultas.', color: '#e67e22', img: imgSopa }

];
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
    if (r.tipoJuego === 'MATHLIVE' || r.tipoJuego === 'THINKHOOT') return true;
    // Si es un PiLive antiguo (se guardaban como PRO pero NO son Wordle)
    if (r.tipo === 'PRO' && r.tipoJuego !== 'WORDLE' && r.tipoJuego !== 'MATHLIVE') return true;
    return false;
};

const getAppInfo = (tipoJuego) => {
    if (!tipoJuego) return { name: 'Recurso', color: '#999' };

    if (tipoJuego === 'CAZABURBUJAS' || tipoJuego === 'PIKATRON') {
        return { name: 'Burbujas/Pikatron', color: '#de896e' };
    }

    const app = APPS.find(a => a.id === tipoJuego);
    if (app) return app;
    if (tipoJuego === 'PRO') return { name: 'PiLive', color: '#9C27B0' };
    if (tipoJuego === 'QUESTION_SENDER') return { name: 'Q-Sender', color: '#2c3e50' };
    return { name: tipoJuego, color: '#999' };
};

const cleanText = (text) => text ? text.toString().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim() : "";

export default function LandingGames({ onLoginRequest, onOpenQuestionSender }) {
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
                const codigoLimpio = codigo.toUpperCase().trim();
                if (!codigoLimpio) { alert("Introduce un código."); setBuscando(false); return; }

                // Código 6 letras = Sesión en Vivo
                if (codigoLimpio.length === 6) {
                    const salaRef = doc(db, "live_games", codigoLimpio);
                    const salaSnap = await getDoc(salaRef);
                    if (salaSnap.exists()) {
                        const data = salaSnap.data();
                        const nombre = prompt("¡Sesión en vivo encontrada! Introduce tu nombre para entrar:");
                        if (nombre && nombre.trim() !== '') {
                            setJoinLiveCode(codigoLimpio);
                            setJoinLiveName(nombre.trim());
                            setIsMathLiveAlumno(data.config?.isMathLive === true || data.tipoJuego === 'MATHLIVE');
                            setLiveModeAlumno(true);
                        }
                    } else alert("No existe ninguna sesión en vivo con ese código.");
                    setBuscando(false);
                    return;
                }

                // Código 4/5 letras = Recurso o Question Sender
                let q = query(ref, where("accessCode", "==", codigoLimpio));
                let snap = await getDocs(q);

                if (!snap.empty) {
                    const r = { ...snap.docs[0].data(), id: snap.docs[0].id };
                    setResultados([r]);
                } else {
                    const qSender = query(ref, where("hojasCodes", "array-contains", codigoLimpio));
                    const snapSender = await getDocs(qSender);
                    if (!snapSender.empty && onOpenQuestionSender) {
                        onOpenQuestionSender();
                        setBuscando(false);
                        return;
                    }
                    alert("Código no encontrado.");
                }

            } else {
                // BÚSQUEDA POR FILTROS
                const q = query(ref, orderBy("fechaCreacion", "desc"), limit(150));
                const snap = await getDocs(q);
                const raw = snap.docs.map(d => ({ ...d.data(), id: d.id }));

                const filtrados = raw.filter(r => {
                    if (r.tipoJuego === 'QUESTION_SENDER') return false;

                    const isTerminado = r.isFinished === true || r.config?.isFinished === true;
                    if (!isTerminado) return false;

                    if (filtros.tipoJuego) {
                        if (filtros.tipoJuego === 'THINKHOOT') {
                            // Si busca PiLive, nos aseguramos que no se cuele Wordle
                            if (!esJuegoEnVivo(r) || r.tipoJuego === 'MATHLIVE') return false;
                        } else if (filtros.tipoJuego === 'CAZABURBUJAS') {
                            if (r.tipoJuego !== 'CAZABURBUJAS' && r.tipoJuego !== 'PIKATRON') return false;
                        }



                        else {
                            if (r.tipoJuego !== filtros.tipoJuego) return false;
                        }
                    }

                    if (filtros.tema && !cleanText(r.titulo).includes(cleanText(filtros.tema)) && !cleanText(r.temas).includes(cleanText(filtros.tema))) return false;
                    if (filtros.ciclo && cleanText(r.ciclo) !== cleanText(filtros.ciclo) && cleanText(r.config?.ciclo) !== cleanText(filtros.ciclo)) return false;

                    if (filtros.pais && !cleanText(r.pais).includes(cleanText(filtros.pais))) return false;
                    if (filtros.region && !cleanText(r.region).includes(cleanText(filtros.region))) return false;
                    if (filtros.poblacion && !cleanText(r.poblacion).includes(cleanText(filtros.poblacion))) return false;
                    if (filtros.autor && !cleanText(r.profesorNombre).includes(cleanText(filtros.autor))) return false;

                    return true;
                });
                const temaMate = cleanText(filtros.tema);
                // Si no hay tema escrito, o si escriben cosas de mates
                const buscarMate = !temaMate || temaMate.includes('matematica') || temaMate.includes('mates') || temaMate.includes('calculo');
                const buscarJuego = !filtros.tipoJuego || filtros.tipoJuego === 'MATHLE';

                // Si encaja, la ponemos la primera de la lista (unshift)
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
                if (r.tipo !== 'PRO') {
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
                timestamp: new Date()
            });

            setHostRoomCode(sala);
            setIsMathLiveHost(r.config?.isMathLive === true || r.tipoJuego === 'MATHLIVE');
            setLiveModeHost(true);
        } catch (error) {
            console.error("Error lanzando host:", error);
            alert("Hubo un error al crear la sala.");
        }
    };

    const procesarClickTarjeta = (r) => {
        if (esJuegoEnVivo(r)) {
            lanzarComoGestor(r);
        } else if (r.tipoJuego === 'CAZABURBUJAS') {
            setRecursoParaElegir(r);
        } else {
            setJuegoActivo(r);
        }
    };

    // --- RENDERIZADO DE JUEGOS A PANTALLA COMPLETA ---

    // 1. Host (Profesor/Gestor)
    if (liveModeHost && hostRoomCode) {
        const tempUser = { uid: "host_invitado_" + Date.now(), displayName: "Profe Invitado", email: null };
        if (isMathLiveHost) return <MathLive isHost={true} codigoSala={hostRoomCode} usuario={tempUser} onExit={() => setLiveModeHost(false)} />;
        return <ThinkHootGame isHost={true} codigoSala={hostRoomCode} usuario={tempUser} onExit={() => setLiveModeHost(false)} />;
    }

    // 2. Alumno (Unirse a Live)
    if (liveModeAlumno) {
        if (isMathLiveAlumno) return <MathLive isHost={false} codigoSala={joinLiveCode} usuario={{ displayName: joinLiveName, email: null }} onExit={() => setLiveModeAlumno(false)} />;
        return <ThinkHootGame isHost={false} codigoSala={joinLiveCode} usuario={{ displayName: joinLiveName, email: null }} onExit={() => setLiveModeAlumno(false)} />;
    }

    // 3. Single Player
    // 3. Single Player
    if (juegoActivo) {
        if (juegoActivo.modoEspecial === 'PIKATRON') return <PikatronRun recurso={juegoActivo} onExit={() => setJuegoActivo(null)} />;
        if (juegoActivo.tipoJuego === 'RULETA') return <RuletaGame recurso={juegoActivo} usuario={null} alTerminar={() => setJuegoActivo(null)} />;

        // --- CORRECCIÓN: Quitamos appData porque aquí no existe ---
        if (juegoActivo.tipoJuego === 'MATHLE') return <MathWordleGame usuario={null} onExit={() => setJuegoActivo(null)} />;
        if (juegoActivo.tipoJuego === 'WORDLE') return <TextWordleGame recursoInicial={juegoActivo} usuario={null} onExit={() => setJuegoActivo(null)} />;

        return <GamePlayer recurso={juegoActivo} usuario={null} alTerminar={() => setJuegoActivo(null)} />;
    }

    return (
        <div style={{ width: '100%', marginTop: '20px' }}>

            {/* MODAL ELEGIR MODO BURBUJAS/PIKATRON */}
            {recursoParaElegir && (
                <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.8)', zIndex: 5000, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                    <div style={{ background: 'white', padding: '30px', borderRadius: '20px', textAlign: 'center', maxWidth: '400px', width: '90%' }}>
                        <h2 style={{ color: '#2c3e50', margin: '0 0 20px 0' }}>🚀 ¡Elige tu aventura!</h2>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            <button onClick={() => { setJuegoActivo(recursoParaElegir); setRecursoParaElegir(null); }} style={{ padding: '15px', background: '#E91E63', color: 'white', border: 'none', borderRadius: '10px', fontSize: '1.1rem', cursor: 'pointer', fontWeight: 'bold' }}>🔵 Cazaburbujas Clásico</button>
                            <button onClick={() => { setJuegoActivo({ ...recursoParaElegir, modoEspecial: 'PIKATRON' }); setRecursoParaElegir(null); }} style={{ padding: '15px', background: '#2196F3', color: 'white', border: 'none', borderRadius: '10px', fontSize: '1.1rem', cursor: 'pointer', fontWeight: 'bold' }}>⚡ Pikatron Run (Runner)</button>
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
                        <input placeholder="Ej: A1B2C o 123456" value={codigo} onChange={e => setCodigo(e.target.value)} style={{ padding: '15px', fontSize: '1.5rem', textAlign: 'center', borderRadius: '10px', border: '2px solid #ddd', width: '250px', textTransform: 'uppercase', letterSpacing: '3px' }} maxLength={6} />
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
                {APPS.filter(app => !app.isLive).map(app => (
                    <div key={app.id} onClick={() => abrirJuego(app.id)} style={{ background: '#ffffbf', borderRadius: '15px', padding: '15px', textAlign: 'center', cursor: 'pointer', boxShadow: '0 4px 10px rgba(0,0,0,0.2)', transition: 'transform 0.2s' }}>
                        <div style={{ width: '60px', height: '60px', margin: '0 auto 10px auto', background: 'transparent', borderRadius: '15px', display: 'flex', justifyContent: 'center', alignItems: 'center', color: 'white' }}>
                            <img src={app.img} alt={app.name} style={{ width: '60px', height: '60px', objectFit: 'contain', borderRadius: '15px' }} onError={(e) => e.target.style.display = 'none'} />
                        </div>
                        <h4 style={{ margin: 0, color: '#333', fontSize: '0.9rem' }}>{app.name}</h4>
                    </div>
                ))}
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

// PÁGINA ESPECÍFICA DEL JUEGO
export const SpecificGamePage = ({ appData, onHome }) => {
    const [tab, setTab] = useState(appData.isLive ? 'LIVE' : 'SEARCH');
    const [filtros, setFiltros] = useState({ tema: '', ciclo: '', pais: '', region: '', poblacion: '', autor: '' });
    const [mostrarMasFiltros, setMostrarMasFiltros] = useState(false);
    const [codigo, setCodigo] = useState('');
    const [resultados, setResultados] = useState([]);

    // Live Alumno
    const [joinCode, setJoinCode] = useState('');
    const [joinName, setJoinName] = useState('');
    const [liveModeAlumno, setLiveModeAlumno] = useState(false);

    // Gestor/Single Player
    const [liveModeHost, setLiveModeHost] = useState(false);
    const [hostRoomCode, setHostRoomCode] = useState('');
    const [juegoActivo, setJuegoActivo] = useState(null);
    const [recursoParaElegir, setRecursoParaElegir] = useState(null);

    // --- NUEVO: ATAJO PARA JUEGOS CON MENÚ PROPIO ---
    if (appData.id === 'WORDLE') return <TextWordleGame usuario={null} onExit={onHome} />;
    if (appData.id === 'MATHLE') return <MathWordleGame usuario={null} onExit={onHome} />;
    if (appData.id === 'SOPA') return <SopaDeLetrasGame usuario={null} onExit={onHome} />;
    // --------


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
                if (r.tipo !== 'PRO') return { ...p, q: p.pregunta, a: p.correcta || p.respuesta, tipo: (p.incorrectas?.length > 0) ? 'MULTIPLE' : 'SIMPLE', opcionesFijas: (p.incorrectas?.length > 0) ? [p.correcta || p.respuesta, ...p.incorrectas].sort(() => Math.random() - 0.5) : [] };
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
                timestamp: new Date()
            });

            setHostRoomCode(sala);
            setLiveModeHost(true);
        } catch (error) { console.error(error); alert("Error al crear la sala."); }
    };

    const procesarClickTarjeta = (r) => {
        if (appData.isLive) lanzarComoGestor(r);
        else if (r.tipoJuego === 'CAZABURBUJAS') setRecursoParaElegir(r);
        else setJuegoActivo(r);
    };

    // --- RENDERIZADO PANTALLA COMPLETA ---
    // En móviles al usar position:fixed u ocupar 100vh se verá a pantalla completa
    if (liveModeHost && hostRoomCode) {
        if (appData.id === 'MATHLIVE') return <MathLive isHost={true} codigoSala={hostRoomCode} usuario={{ uid: "host", displayName: "Profe" }} onExit={() => setLiveModeHost(false)} />;
        return <ThinkHootGame isHost={true} codigoSala={hostRoomCode} usuario={{ uid: "host", displayName: "Profe" }} onExit={() => setLiveModeHost(false)} />;
    }

    if (liveModeAlumno) {
        if (appData.id === 'MATHLIVE') return <MathLive isHost={false} codigoSala={joinCode} usuario={{ displayName: joinName, email: null }} onExit={() => setLiveModeAlumno(false)} />;
        return <ThinkHootGame isHost={false} codigoSala={joinCode} usuario={{ displayName: joinName, email: null }} onExit={() => setLiveModeAlumno(false)} />;
    }

    if (juegoActivo) {
        if (appData.id === 'PIKATRON' || juegoActivo.modoEspecial === 'PIKATRON') return <PikatronRun recurso={juegoActivo} onExit={() => setJuegoActivo(null)} />;
        if (appData.id === 'RULETA') return <RuletaGame recurso={juegoActivo} usuario={null} alTerminar={() => setJuegoActivo(null)} />;
        // --- AÑADIDO WORDLE AQUÍ ---
       if (appData.id === 'WORDLE' || juegoActivo.tipoJuego === 'WORDLE') return <TextWordleGame recursoInicial={juegoActivo} usuario={null} onExit={() => setJuegoActivo(null)} />;
        if (appData.id === 'SOPA' || juegoActivo.tipoJuego === 'SOPA') return <SopaDeLetrasGame recursoInicial={juegoActivo} usuario={null} onExit={() => setJuegoActivo(null)} />;

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
                            <button onClick={() => { setJuegoActivo(recursoParaElegir); setRecursoParaElegir(null); }} style={{ padding: '15px', background: '#E91E63', color: 'white', border: 'none', borderRadius: '10px', fontSize: '1.1rem', cursor: 'pointer', fontWeight: 'bold' }}>🔵 Cazaburbujas Clásico</button>
                            <button onClick={() => { setJuegoActivo({ ...recursoParaElegir, modoEspecial: 'PIKATRON' }); setRecursoParaElegir(null); }} style={{ padding: '15px', background: '#2196F3', color: 'white', border: 'none', borderRadius: '10px', fontSize: '1.1rem', cursor: 'pointer', fontWeight: 'bold' }}>⚡ Pikatron Run (Runner)</button>
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
                    <p style={{ color: appData.color, fontStyle: 'italic', fontSize: '1.1rem' }}>{appData.desc}</p>
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
                        <button onClick={() => { if (joinCode.length === 6 && joinName) setLiveModeAlumno(true); else alert("Introduce código y nombre."); }} style={{ background: appData.color, color: 'white', padding: '15px 50px', border: 'none', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer', marginTop: '20px', fontSize: '1.2rem' }}>ENTRAR AL JUEGO</button>
                    </div>
                )}

                {tab === 'SEARCH' && (
                    <div style={{ background: '#f5f5f5', padding: '30px', borderRadius: '15px' }}>
                        <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
                            <input placeholder="Tema o Título..." value={filtros.tema} onChange={e => setFiltros({ ...filtros, tema: e.target.value })} style={styles.input} />
                            <select value={filtros.ciclo} onChange={e => setFiltros({ ...filtros, ciclo: e.target.value })} style={styles.input}>
                                <option value="">Cualquier Ciclo</option>
                                <option value="Primaria">Primaria</option>
                                <option value="Secundaria">Secundaria</option>
                                <option value="Bachillerato">Bachillerato</option>
                                <option value="FP">FP</option>
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
            </div>
        </div>
    );
}

const styles = {
    input: { padding: '12px',width:'100%', borderRadius: '8px', border: '1px solid #ccc', outline: 'none', flex: 1, fontSize: '0.95rem' }
};