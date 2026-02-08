import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, where, getDocs, orderBy, limit, setDoc, doc } from 'firebase/firestore';
import { Search, MapPin, User, Globe, Play, Share2, Users, Gamepad2, Key, Filter, Zap } from 'lucide-react';
import GamePlayer from '../GamePlayer';
import ThinkHootGame from '../ThinkHootGame'; // Importante para el modo Host
import RuletaGame from '../RuletaGame';
import MathLive from '../MathLive';

// --- ESTILOS ---
const styles = {
    container: { width: '100%', marginTop: '30px', paddingBottom: '50px' },
    sectionTitle: { color: 'white', fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '20px', textAlign: 'center', textShadow: '0 2px 4px rgba(0,0,0,0.3)' },

    card: { background: 'rgba(255, 255, 255, 0.95)', padding: '25px', borderRadius: '20px', boxShadow: '0 10px 30px rgba(0,0,0,0.2)', marginBottom: '30px', width: '100%', boxSizing: 'border-box' },

    tabContainer: { display: 'flex', gap: '10px', marginBottom: '20px', justifyContent: 'center' },
    tabButton: (active) => ({ padding: '10px 25px', borderRadius: '20px', border: 'none', background: active ? '#f1c40f' : '#eee', color: active ? '#333' : '#777', fontWeight: 'bold', cursor: 'pointer', transition: '0.2s', display: 'flex', alignItems: 'center', gap: '5px' }),

    // Nueva Grid para los filtros
    filterGroup: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '15px', marginBottom: '15px' },
    select: { width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #ddd', fontSize: '0.9rem', backgroundColor: 'white', cursor: 'pointer' },
    input: { width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #ddd', fontSize: '0.9rem', boxSizing: 'border-box' },

    searchButton: { width: '100%', padding: '12px', background: '#2196F3', color: 'white', border: 'none', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer', fontSize: '1rem', marginTop: '10px' },

    liveSection: { background: 'linear-gradient(135deg, #8e44ad, #9b59b6)', padding: '20px', borderRadius: '20px', color: 'white', textAlign: 'center', marginBottom: '30px', boxShadow: '0 10px 20px rgba(142, 68, 173, 0.4)' },

    gridList: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '15px' },
    verticalList: { display: 'flex', flexDirection: 'column', gap: '15px', width: '100%' },

    resourceCard: (color) => ({ background: 'white', padding: '15px', borderRadius: '12px', cursor: 'pointer', borderLeft: `6px solid ${color}`, position: 'relative', transition: 'transform 0.2s', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }),

    codeBadge: { background: '#f8f9fa', padding: '4px 8px', borderRadius: '6px', fontSize: '12px', fontWeight: 'bold', border: '1px solid #dee2e6', color: '#333', display: 'inline-flex', alignItems: 'center', gap: '5px' }
};

const getColor = (t) => {
    if (!t) return '#999';
    // Mapeo incluyendo ThinkHoot/PRO como Live
    const map = {
        PASAPALABRA: '#3F51B5',
        THINKHOOT: '#9C27B0',
        PRO: '#9C27B0', // Para compatibilidad
        APAREJADOS: '#FF9800',
        CAZABURBUJAS: '#E91E63',
        RULETA: '#f1c40f'
    };
    return map[t.toUpperCase()] || '#555';
};

const cleanText = (text) => text ? text.toString().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim() : "";

export default function LandingGames({ onLoginRequest }) {
    // ESTADOS
    const [modoBusqueda, setModoBusqueda] = useState('FILTROS');

    // NUEVOS FILTROS
    const [filtros, setFiltros] = useState({
        tipoJuego: '',
        ciclo: '',
        tema: ''
    });

    const [codigo, setCodigo] = useState('');
    const [resultados, setResultados] = useState([]);
    const [buscando, setBuscando] = useState(false);

    const [juegoActivo, setJuegoActivo] = useState(null); // Para Single Player

    // ESTADOS PARA JUGAR EN VIVO (ALUMNO)
    const [joinLiveCode, setJoinLiveCode] = useState('');
    const [joinLiveName, setJoinLiveName] = useState('');
    const [liveModeAlumno, setLiveModeAlumno] = useState(false);

    // ESTADOS PARA JUGAR EN VIVO (HOST / GESTOR)
    const [liveModeHost, setLiveModeHost] = useState(false);
    const [hostRoomCode, setHostRoomCode] = useState(null);
    const [isMathLive, setIsMathLive] = useState(false); // <--- AÑADIR ESTE ESTADO

    const [topGames, setTopGames] = useState([]);

    // --- CARGAR TOP GAMES (Inicial) ---
    useEffect(() => {
        const loadTopGames = async () => {
            try {
                const types = ['PASAPALABRA', 'CAZABURBUJAS', 'APAREJADOS', 'RULETA'];
                const topList = [];
                for (const type of types) {
                    const q = query(
                        collection(db, 'resources'),
                        where('tipoJuego', '==', type),
                        orderBy('playCount', 'desc'),
                        limit(5)
                    );
                    const snap = await getDocs(q);
                    const primerTerminado = snap.docs.find(doc => {
                        const d = doc.data();
                        return d.isFinished === true || d.config?.isFinished === true;
                    });
                    if (primerTerminado) topList.push({ id: primerTerminado.id, ...primerTerminado.data() });
                }
                setTopGames(topList);
            } catch (e) { console.warn("Error cargando top games:", e); }
        };
        loadTopGames();
    }, []);

    // --- LÓGICA DE BÚSQUEDA ---
    const buscar = async () => {
        setBuscando(true); setResultados([]);
        const ref = collection(db, 'resources');
        try {
            if (modoBusqueda === 'CODIGO') {
                if (!codigo.trim()) { alert("Escribe un código."); setBuscando(false); return; }
                const q = query(ref, where("accessCode", "==", codigo.toUpperCase().trim()));
                const snap = await getDocs(q);
                if (snap.empty) alert("Código no encontrado.");
                else {
                    const docs = snap.docs.map(d => ({ ...d.data(), id: d.id }));
                    const r = docs[0];
                    if (r.isFinished === true || r.config?.isFinished === true) {
                        setResultados(docs);
                    } else {
                        alert("Este recurso aún no está terminado.");
                    }
                }
            } else {
                // BÚSQUEDA POR FILTROS
                // Traemos los últimos 100 recursos para filtrar en cliente (Firestore tiene limites con múltiples 'where')
                const q = query(ref, orderBy("fechaCreacion", "desc"), limit(100));
                const snap = await getDocs(q);
                const raw = snap.docs.map(d => ({ ...d.data(), id: d.id }));

                const filtrados = raw.filter(r => {
                    const f = filtros;

                    // 1. Filtro Tipo Juego
                    if (f.tipoJuego) {
                        if (f.tipoJuego === 'THINKHOOT') {
                            // Si busca Live, aceptamos THINKHOOT o PRO (MathLive)
                            if (r.tipoJuego !== 'THINKHOOT' && r.tipo !== 'PRO') return false;
                        } else {
                            if (r.tipoJuego !== f.tipoJuego) return false;
                        }
                    }

                    // 2. Filtro Terminado
                    const isTerminado = r.isFinished === true || r.config?.isFinished === true;
                    if (!isTerminado) return false;

                    // 3. Filtro Tema (Búsqueda en título o campo temas)
                    const matchTema = !f.tema || cleanText(r.titulo).includes(cleanText(f.tema)) || (r.temas && cleanText(r.temas).includes(cleanText(f.tema)));
                    if (!matchTema) return false;

                    // 4. Filtro Ciclo (Búsqueda en campo ciclo o dentro de temas/título si no existe campo específico)
                    // Asumimos que 'ciclo' puede estar en r.ciclo, r.config.ciclo, o ser parte de los temas/etiquetas
                    if (f.ciclo) {
                        const cicloBusqueda = cleanText(f.ciclo);
                        const enCampo = r.ciclo && cleanText(r.ciclo) === cicloBusqueda;
                        const enConfig = r.config?.ciclo && cleanText(r.config.ciclo) === cicloBusqueda;
                        const enTemas = r.temas && cleanText(r.temas).includes(cicloBusqueda);

                        if (!enCampo && !enConfig && !enTemas) return false;
                    }

                    return true;
                });

                if (filtrados.length === 0) alert("No se encontraron recursos terminados con esos filtros.");
                setResultados(filtrados);
            }
        } catch (e) { console.error(e); alert("Error en la búsqueda."); }
        setBuscando(false);
    };

    const compartir = (e, r) => {
        e.stopPropagation();
        const texto = `¡Juega a ${r.titulo} en PiKT! Código: ${r.accessCode}`;
        if (navigator.share) navigator.share({ title: r.titulo, text: texto, url: window.location.href }).catch(() => { });
        else { navigator.clipboard.writeText(texto); alert("¡Código copiado!"); }
    };

    // --- FUNCIÓN PARA LANZAR SESIÓN EN VIVO COMO GESTOR ---
    const lanzarComoGestor = async (r) => {
        if (!window.confirm("¿Quieres iniciar una sesión en vivo como gestor de este juego?")) return;

        try {
            // 1. Generar Código de Sala
            const sala = Math.floor(100000 + Math.random() * 900000).toString();

            // 2. Preparar Preguntas (Lógica similar a ProfesorDashboard)
            const limitePreguntas = parseInt(r.config?.numPreguntas) || 10;
            let pool = [];
            if (r.hojas) r.hojas.forEach(h => pool.push(...h.preguntas));

            // Mezclar preguntas si es aleatorio
            if (r.config?.aleatorio !== false) {
                pool.sort(() => Math.random() - 0.5);
            }

            if (!pool.length) return alert("El recurso no tiene preguntas válidas.");

            const pFin = pool.slice(0, limitePreguntas).map(p => {
                if (r.tipo !== 'PRO') { // Adaptar clásicos a formato PRO
                    return {
                        ...p, q: p.pregunta, a: p.correcta || p.respuesta,
                        tipo: (p.incorrectas?.length > 0) ? 'MULTIPLE' : 'SIMPLE',
                        opcionesFijas: (p.incorrectas?.length > 0) ? [p.correcta || p.respuesta, ...p.incorrectas].sort(() => Math.random() - 0.5) : []
                    };
                }
                return p;
            });

            // 3. Crear Usuario Invitado si no hay login
            // (Asumimos invitado aquí ya que estamos en Landing)
            const myHostId = "host_invitado_" + Date.now();
            const myHostName = "Profe Invitado";

            // 4. Crear documento en Firebase
            await setDoc(doc(db, "live_games", sala), {
                hostId: myHostId,
                recursoId: r.id || 'temp_id',
                recursoTitulo: r.titulo,
                profesorNombre: myHostName,
                config: r.config || {},
                preguntas: pFin,
                estado: 'LOBBY',
                indicePregunta: 0,
                jugadores: {},
                respuestasRonda: {},
                timestamp: new Date()
            });

            // 5. Activar modo Host
            setHostRoomCode(sala);
            // Detectamos si es MathLive mirando la configuración
            setIsMathLive(r.config?.isMathLive === true);
            setLiveModeHost(true);

        } catch (error) {
            console.error("Error lanzando host:", error);
            alert("Hubo un error al crear la sala.");
        }
    };

    const handleCardClick = (r) => {
        // Si es tipo Live (ThinkHoot o MathLive)
        if (r.tipoJuego === 'THINKHOOT' || r.tipo === 'PRO') {
            lanzarComoGestor(r);
        } else {
            // Juego Normal Single Player
            setJuegoActivo(r);
        }
    };

    // --- RENDERIZADOS DE JUEGO ---

    // 1. Modo Host (Profesor Invitado)
    if (liveModeHost && hostRoomCode) {
        // Usuario invitado temporal para que no falle
        const tempUser = { uid: "host_invitado_" + Date.now(), displayName: "Profe Invitado", email: null };

        if (isMathLive) {
            return (
                <MathLive
                    isHost={true}
                    codigoSala={hostRoomCode}
                    usuario={tempUser}
                    onExit={() => setLiveModeHost(false)}
                />
            );
        }

        return (
            <ThinkHootGame
                isHost={true}
                codigoSala={hostRoomCode}
                usuario={tempUser}
                onExit={() => setLiveModeHost(false)}
            />
        );
    }

    // 2. Modo Alumno (Unirse a sala)
    if (liveModeAlumno) {
        return (
            <ThinkHootGame
                isHost={false}
                codigoSala={joinLiveCode}
                usuario={{ displayName: joinLiveName || "Invitado", email: null }}
                onExit={() => setLiveModeAlumno(false)}
            />
        );
    }

    // 3. Modo Juego Single Player
    if (juegoActivo) {
        if (juegoActivo.tipoJuego === 'RULETA') return <RuletaGame recurso={juegoActivo} usuario={null} alTerminar={() => setJuegoActivo(null)} />;
        return <GamePlayer recurso={juegoActivo} usuario={null} alTerminar={() => setJuegoActivo(null)} />;
    }

    // --- RENDERIZADO PRINCIPAL (LANDING) ---
    return (
        <div style={styles.container}>

            {/* TARJETA BUSCADOR */}
            <div style={styles.card}>
                <h3 style={{ color: '#333', textAlign: 'center', margin: '0 0 20px 0' }}>🔍 Encuentra un Recurso</h3>

                <div style={styles.tabContainer}>
                    <button style={styles.tabButton(modoBusqueda === 'FILTROS')} onClick={() => setModoBusqueda('FILTROS')}><Filter size={16} /> Filtros</button>
                    <button style={styles.tabButton(modoBusqueda === 'CODIGO')} onClick={() => setModoBusqueda('CODIGO')}><Key size={16} /> Código</button>
                </div>

                {modoBusqueda === 'CODIGO' ? (
                    <div style={{ textAlign: 'center' }}>
                        <input placeholder="Ej: A1B2C" value={codigo} onChange={e => setCodigo(e.target.value.toUpperCase())} style={{ ...styles.input, textAlign: 'center', fontSize: '1.5rem', letterSpacing: '5px', textTransform: 'uppercase', width: '200px' }} maxLength={5} />
                    </div>
                ) : (
                        // GRUPO DE FILTROS NUEVOS
                        <div style={styles.filterGroup}>

                            {/* 1. TIPO DE JUEGO */}
                            <select
                                style={styles.select}
                                value={filtros.tipoJuego}
                                onChange={e => setFiltros({ ...filtros, tipoJuego: e.target.value })}
                            >
                                <option value="">📂 Todos los Juegos</option>
                                <option value="PASAPALABRA">Pasapalabra</option>
                                <option value="CAZABURBUJAS">Caza Burbujas</option>
                                <option value="APAREJADOS">Aparejados</option>
                                <option value="RULETA">La Ruleta</option>
                                <option value="THINKHOOT">📡 Live (En Vivo)</option>
                            </select>

                            {/* 2. CICLO EDUCATIVO */}
                            <select
                                style={styles.select}
                                value={filtros.ciclo}
                                onChange={e => setFiltros({ ...filtros, ciclo: e.target.value })}
                            >
                                <option value="">🎓 Cualquier Ciclo</option>
                                <option value="Infantil">Infantil</option>
                                <option value="Primaria">Primaria</option>
                                <option value="Secundaria">Secundaria</option>
                                <option value="Bachillerato">Bachillerato</option>
                                <option value="Otros">Otros</option>
                            </select>

                            {/* 3. TEMA */}
                            <input
                                style={styles.input}
                                placeholder="Tema (Ej: Mates, Historia...)"
                                value={filtros.tema}
                                onChange={e => setFiltros({ ...filtros, tema: e.target.value })}
                            />
                        </div>
                    )}

                <button style={styles.searchButton} onClick={buscar} disabled={buscando}>
                    {buscando ? 'BUSCANDO...' : 'Buscar Recursos'}
                </button>

                {/* RESULTADOS DE BÚSQUEDA */}
                {resultados.length > 0 && (
                    <div style={{ marginTop: '25px' }}>
                        <h4 style={{ color: '#666', marginBottom: '10px' }}>Resultados ({resultados.length}):</h4>
                        <div style={styles.verticalList}>
                            {resultados.map(r => (
                                <ResourceCard
                                    key={r.id}
                                    r={r}
                                    onClick={() => handleCardClick(r)}
                                    onShare={(e) => compartir(e, r)}
                                />
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* SECCIÓN JUGAR EN VIVO (UNIRSE) */}
            <div style={styles.liveSection}>
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '10px', marginBottom: '15px' }}>
                    <Gamepad2 size={32} />
                    <h2 style={{ margin: 0 }}>UNIRSE A SESIÓN EN VIVO</h2>
                </div>
                <p style={{ marginBottom: '15px' }}>Si tu profesor te ha dado un código de sala, introdúcelo aquí:</p>
                <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
                    <input placeholder="Código Sala" value={joinLiveCode} onChange={e => setJoinLiveCode(e.target.value)} style={{ ...styles.input, width: '140px', textAlign: 'center', color: '#333' }} />
                    <input placeholder="Tu Nombre" value={joinLiveName} onChange={e => setJoinLiveName(e.target.value)} style={{ ...styles.input, width: '180px', textAlign: 'center', color: '#333' }} />
                    <button onClick={() => { if (joinLiveCode && joinLiveName) setLiveModeAlumno(true); else alert("Rellena código y nombre"); }} style={{ ...styles.searchButton, width: 'auto', marginTop: 0, background: '#f1c40f', color: '#333' }}>ENTRAR</button>
                </div>
            </div>

            {/* TOP RECURSOS */}
            <h2 style={styles.sectionTitle}>🔥 Los Más Populares</h2>
            {topGames.length > 0 ? (
                <div style={styles.gridList}>
                    {topGames.map(r => (
                        <ResourceCard key={r.id} r={r} onClick={() => handleCardClick(r)} onShare={(e) => compartir(e, r)} />
                    ))}
                </div>
            ) : (
                    <p style={{ textAlign: 'center', color: 'white', opacity: 0.7 }}>Cargando destacados...</p>
                )}

        </div>
    );
}

// Subcomponente Tarjeta
const ResourceCard = ({ r, onClick, onShare }) => {
    // Detectamos si es Live para mostrar icono especial
    const isLive = r.tipoJuego === 'THINKHOOT' || r.tipo === 'PRO';

    return (
        <div style={styles.resourceCard(getColor(r.tipoJuego))} onClick={onClick}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                    <h4 style={{ margin: '0 0 5px 0', color: '#333', fontSize: '1rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '220px' }} title={r.titulo}>{r.titulo}</h4>
                    <div style={styles.codeBadge}>
                        <Key size={12} /> {r.accessCode || '----'}
                    </div>
                </div>
                <button onClick={onShare} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#777' }} title="Compartir">
                    <Share2 size={18} />
                </button>
            </div>

            <div style={{ marginTop: '10px', fontSize: '0.85rem', color: '#666' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}><User size={12} /> {r.profesorNombre}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginTop: '3px' }}><MapPin size={12} /> {r.poblacion}, {r.pais}</div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '15px' }}>
                <div style={{ background: getColor(r.tipoJuego), color: 'white', padding: '3px 8px', borderRadius: '10px', fontSize: '0.7rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '5px' }}>
                    {isLive && <Zap size={10} fill="white" />}
                    {r.tipoJuego === 'THINKHOOT' || r.tipo === 'PRO' ? 'LIVE' : r.tipoJuego}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.8rem', color: '#555', fontWeight: 'bold' }}><Users size={14} /> {r.playCount || 0}</div>
            </div>

            <div style={{ position: 'absolute', bottom: '15px', right: '15px', opacity: 0.1 }}>
                <Play size={40} color={getColor(r.tipoJuego)} fill={getColor(r.tipoJuego)} />
            </div>
        </div>
    );
};