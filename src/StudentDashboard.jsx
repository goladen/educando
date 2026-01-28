import { useState, useEffect } from 'react';
import { db } from './firebase';
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { Search, MapPin, User, Globe, ArrowLeft, Play, Medal, Trophy, Gamepad2 } from 'lucide-react';
import GamePlayer from './GamePlayer';
import ThinkHootGame from './ThinkHootGame';

// --- ESTILOS GLOBALES ---
const ESTILO_FONDO = {
    background: 'radial-gradient(circle, #2f3640, #1e272e)',
    minHeight: '100vh',
    color: 'white',
    fontFamily: "'Segoe UI', Roboto, sans-serif",
    padding: '20px'
};

const TARJETA_ESTILO = {
    background: 'rgba(0,0,0,0.7)',
    padding: '30px',
    borderRadius: '20px',
    backdropFilter: 'blur(10px)',
    border: '1px solid rgba(255,255,255,0.1)',
    boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
    maxWidth: '900px',
    margin: '0 auto'
};

// Helper para limpiar texto
const cleanText = (text) => text ? text.toString().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim() : "";

// Helper para obtener color según juego
const getColor = (t) => {
    if (!t) return '#999';
    const tipo = t.toUpperCase();
    if (tipo === 'PASAPALABRA') return '#3F51B5';
    if (tipo === 'THINKHOOT') return '#9C27B0';
    if (tipo === 'APAREJADOS') return '#FF9800';
    if (tipo === 'CAZABURBUJAS') return '#E91E63';
    return '#E91E63';
};

// Helper para mostrar nombre bonito del juego
const getNombreJuego = (tipo) => {
    if (!tipo) return 'Juego';
    const t = tipo.toUpperCase();
    if (t === 'PASAPALABRA') return 'Pasapalabra';
    if (t === 'CAZABURBUJAS') return 'CazaBurbujas';
    if (t === 'APAREJADOS') return 'Aparejados';
    if (t === 'THINKHOOT') return 'ThinkHoot';
    return t;
};

export default function StudentDashboard({ usuario }) {
    // --- ESTADOS ---
    const [cargando, setCargando] = useState(false); // Estado general
    const [vistaActual, setVistaActual] = useState('JUEGOS'); // 'JUEGOS' | 'RECORDS'
    const [fase, setFase] = useState('SELECCION'); // 'SELECCION', 'BUSQUEDA', 'JUGANDO', 'EN_VIVO'
    const [juegoElegido, setJuegoElegido] = useState(null);

    // Búsqueda
    const [modoBusqueda, setModoBusqueda] = useState('FILTROS');
    const [filtros, setFiltros] = useState({ profesor: '', pais: '', region: '', poblacion: '', tema: '' });
    const [codigo, setCodigo] = useState('');
    const [resultados, setResultados] = useState([]);
    const [buscando, setBuscando] = useState(false);

    // Juego Activo
    const [recursoActivo, setRecursoActivo] = useState(null);
    const [joinData, setJoinData] = useState({ codigo: '', alias: '' });

    // Récords
    const [misRecords, setMisRecords] = useState([]);
    const [cargandoRecords, setCargandoRecords] = useState(false);

    // --- 1. CARGAR RÉCORDS ---
    const cargarMisRecords = async () => {
        if (!usuario || !usuario.email) {
            console.log("Esperando usuario...");
            return;
        }

        setCargandoRecords(true);
        try {
            // Requiere índice: email (Asc) + fecha (Desc)
            const q = query(
                collection(db, "ranking"),
                where("email", "==", usuario.email),
                orderBy("fecha", "desc")
            );

            const snapshot = await getDocs(q);

            if (snapshot.empty) {
                setMisRecords([]);
            } else {
                setMisRecords(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
            }
        } catch (error) {
            console.error("Error records:", error);
            if (error.message.includes("index")) {
                alert("⚠️ FALTA ÍNDICE: Abre la consola (F12) y haz clic en el enlace de Firebase.");
            }
        }
        setCargandoRecords(false);
    };

    // Carga inicial automática
    useEffect(() => {
        if (usuario?.email) cargarMisRecords();
    }, [usuario]);

    // --- 2. BUSCAR RECURSOS ---
    const buscar = async () => {
        setBuscando(true);
        setResultados([]);
        const ref = collection(db, 'resources');
        try {
            if (modoBusqueda === 'CODIGO') {
                if (!codigo.trim()) { setBuscando(false); return alert("Escribe un código."); }
                const q = query(ref, where("accessCode", "==", codigo.toUpperCase().trim()));
                const snap = await getDocs(q);
                const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));

                if (docs.length === 0) alert("Código no encontrado.");
                else {
                    if (docs[0].tipoJuego === 'THINKHOOT') {
                        alert("Este es un código de ThinkHoot. Usa 'Unirse' en el menú principal.");
                        setFase('SELECCION');
                    } else {
                        setResultados(docs);
                    }
                }
            } else {
                // Filtros
                const q = query(ref, where("tipoJuego", "==", juegoElegido), orderBy("fechaCreacion", "desc"));
                const snap = await getDocs(q);
                const raw = snap.docs.map(d => ({ id: d.id, ...d.data() }));

                // Filtrado en cliente
                const docs = raw.filter(r => {
                    const f = filtros;
                    const check = (d, f) => !f || cleanText(d).includes(cleanText(f));
                    const checkTema = () => {
                        if (!f.tema) return true;
                        const busqueda = cleanText(f.tema);
                        return cleanText(r.titulo).includes(busqueda) || (r.temas && cleanText(r.temas).includes(busqueda));
                    };
                    return check(r.profesorNombre, f.profesor) && check(r.pais, f.pais) && check(r.region, f.region) && check(r.poblacion, f.poblacion) && checkTema();
                });

                if (docs.length === 0) alert("❌ No se encontraron recursos.");
                else setResultados(docs);
            }
        } catch (error) { console.error(error); alert("Error buscando."); }
        finally { setBuscando(false); }
    };

    // --- 3. UNIRSE A THINKHOOT ---
    const unirsePartidaEnVivo = () => {
        if (!joinData.codigo) return alert("Introduce el código.");
        setFase('EN_VIVO');
    };

    // --- RENDERIZADO DE JUEGO ACTIVO ---
    if (fase === 'EN_VIVO') {
        return <ThinkHootGame isHost={false} codigoSala={joinData.codigo} usuario={{ ...usuario, displayName: joinData.alias || usuario.displayName }} onExit={() => setFase('SELECCION')} />;
    }

    if (fase === 'JUGANDO') {
        return <GamePlayer recurso={recursoActivo} usuario={usuario} alTerminar={() => setFase('BUSQUEDA')} />;
    }

    // --- DASHBOARD ---
    return (
        <div style={ESTILO_FONDO}>

            {/* HEADER DE NAVEGACIÓN */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', marginBottom: '30px' }}>
                <button
                    onClick={() => { setVistaActual('JUEGOS'); setFase('SELECCION'); }}
                    style={{ ...BtnNavStyle, background: vistaActual === 'JUEGOS' ? '#f1c40f' : 'rgba(255,255,255,0.1)', color: vistaActual === 'JUEGOS' ? '#000' : '#fff' }}
                >
                    🎮 Zona de Juegos
                </button>

                {/* BOTÓN MIS RÉCORDS CORREGIDO */}
                <button
                    onClick={() => { setVistaActual('RECORDS'); cargarMisRecords(); }}
                    style={{ ...BtnNavStyle, background: vistaActual === 'RECORDS' ? '#f1c40f' : 'rgba(255,255,255,0.1)', color: vistaActual === 'RECORDS' ? '#000' : '#fff' }}
                >
                    🏅 Mis Récords
                </button>
            </div>

            {/* VISTA: MIS RÉCORDS */}
            {vistaActual === 'RECORDS' && (
                <div style={TARJETA_ESTILO}>
                    <h2 style={{ color: '#f1c40f', textAlign: 'center', marginBottom: '20px', fontFamily: 'sans-serif' }}>Mis Mejores Puntuaciones</h2>

                    {cargandoRecords ? <p style={{ textAlign: 'center' }}>Cargando...</p> : (
                        <div style={{ maxHeight: '60vh', overflowY: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', color: 'white' }}>
                                <thead>
                                    <tr style={{ borderBottom: '2px solid #555', textAlign: 'left' }}>
                                        <th style={{ padding: '10px' }}>Juego</th>
                                        <th style={{ padding: '10px' }}>Recurso</th>
                                        <th style={{ padding: '10px' }}>Modo</th>
                                        <th style={{ padding: '10px' }}>Puntos</th>
                                        <th style={{ padding: '10px' }}>Medalla</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {misRecords.map((r, i) => (
                                        <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                                            <td style={{ padding: '10px', color: getColor(r.tipoJuego || r.juego || 'GENERICO') }}>
                                                {getNombreJuego(r.tipoJuego || r.juego)}
                                            </td>
                                            <td style={{ padding: '10px', fontWeight: 'bold' }}>
                                                {r.recursoTitulo || "Sin Título (Antiguo)"}
                                            </td>
                                            <td style={{ padding: '10px', fontStyle: 'italic' }}>
                                                {r.categoria || "General"}
                                            </td>
                                            <td style={{ padding: '10px', color: '#f1c40f', fontWeight: 'bold' }}>
                                                {r.aciertos !== undefined ? r.aciertos : r.puntuacion}
                                            </td>
                                            <td style={{ padding: '10px', fontSize: '1.5rem' }}>
                                                {r.medalla || (
                                                    (r.aciertos >= 10) ? '🥇' :
                                                        (r.aciertos >= 5) ? '🥈' :
                                                            (r.aciertos > 0) ? '🥉' : ''
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            {misRecords.length === 0 && <p style={{ textAlign: 'center', padding: '20px' }}>Aún no tienes partidas guardadas.</p>}
                        </div>
                    )}
                </div>
            )}

            {/* VISTA: SELECCIÓN DE JUEGO */}
            {vistaActual === 'JUEGOS' && fase === 'SELECCION' && (
                <div style={{ ...TARJETA_ESTILO, textAlign: 'center' }}>
                    <h1 style={{ fontFamily: 'sans-serif', color: '#f1c40f', fontSize: '3rem', marginBottom: '40px' }}>Elige un Juego</h1>
                    <div style={{ display: 'flex', gap: '30px', justifyContent: 'center', flexWrap: 'wrap' }}>
                        <BotonJuego color="#3F51B5" titulo="Pasapalabra" icon="🅰️" onClick={() => { setJuegoElegido('PASAPALABRA'); setFase('BUSQUEDA'); setResultados([]); setFiltros({ profesor: '', pais: '', region: '', poblacion: '', tema: '' }); }} />
                        <BotonJuego color="#E91E63" titulo="CazaBurbujas" icon="🫧" onClick={() => { setJuegoElegido('CAZABURBUJAS'); setFase('BUSQUEDA'); setResultados([]); setFiltros({ profesor: '', pais: '', region: '', poblacion: '', tema: '' }); }} />
                        <BotonJuego color="#27ae60" titulo="Aparejados" icon="🃏" onClick={() => { setJuegoElegido('APAREJADOS'); setFase('BUSQUEDA'); setResultados([]); setFiltros({ profesor: '', pais: '', region: '', poblacion: '', tema: '' }); }} />
                        <BotonJuego color="#9C27B0" titulo="ThinkHoot" icon="🦉" onClick={() => { setJuegoElegido('THINKHOOT'); setFase('BUSQUEDA'); }} />
                    </div>
                </div>
            )}

            {/* VISTA: BÚSQUEDA Y UNIRSE */}
            {vistaActual === 'JUEGOS' && fase === 'BUSQUEDA' && (
                <div style={TARJETA_ESTILO}>
                    <button onClick={() => setFase('SELECCION')} style={{ background: 'none', border: 'none', color: '#ccc', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '10px' }}><ArrowLeft size={16} /> Volver</button>

                    <h2 style={{ color: getColor(juegoElegido), textAlign: 'center', marginBottom: '30px', fontFamily: 'sans-serif', fontWeight: 'bold' }}>
                        {juegoElegido === 'THINKHOOT' ? 'Unirse a Partida en Vivo' : `Buscar Recursos de ${getNombreJuego(juegoElegido)}`}
                    </h2>

                    {juegoElegido === 'THINKHOOT' ? (
                        <div style={{ textAlign: 'center', padding: '20px' }}>
                            <p style={{ marginBottom: '10px' }}>Código de Sala:</p>
                            <input placeholder="123456" value={joinData.codigo} onChange={e => setJoinData({ ...joinData, codigo: e.target.value })} style={{ ...InputEstilo, fontSize: '24px', letterSpacing: '5px', textAlign: 'center', width: '200px', marginBottom: '15px' }} maxLength={6} />
                            <br />
                            <p style={{ marginBottom: '10px' }}>Tu Alias:</p>
                            <input placeholder={usuario.displayName || "Nombre"} value={joinData.alias} onChange={e => setJoinData({ ...joinData, alias: e.target.value })} style={{ ...InputEstilo, width: '300px', textAlign: 'center', marginBottom: '20px' }} />
                            <br />
                            <button onClick={unirsePartidaEnVivo} style={{ ...BotonAccionStyle, background: '#9C27B0' }}>🚀 UNIRSE</button>
                        </div>
                    ) : (
                            <>
                                <div style={{ display: 'flex', gap: '10px', marginBottom: '25px', justifyContent: 'center' }}>
                                    <BotonTab activo={modoBusqueda === 'FILTROS'} onClick={() => setModoBusqueda('FILTROS')}>🔍 Filtros</BotonTab>
                                    <BotonTab activo={modoBusqueda === 'CODIGO'} onClick={() => setModoBusqueda('CODIGO')}>🔑 Código</BotonTab>
                                </div>

                                {modoBusqueda === 'CODIGO' ? (
                                    <div style={{ textAlign: 'center', padding: '20px' }}><p>Código del recurso:</p><input placeholder="X9B2A" value={codigo} onChange={e => setCodigo(e.target.value.toUpperCase())} style={{ ...InputEstilo, fontSize: '24px', letterSpacing: '5px', width: '200px', textTransform: 'uppercase', textAlign: 'center' }} maxLength={5} /></div>
                                ) : (
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px', marginBottom: '20px' }}>
                                            <InputFiltro icon={<Search size={16} />} ph="Tema" val={filtros.tema} set={v => setFiltros({ ...filtros, tema: v })} />
                                            <InputFiltro icon={<User size={16} />} ph="Profesor" val={filtros.profesor} set={v => setFiltros({ ...filtros, profesor: v })} />
                                            <InputFiltro icon={<Globe size={16} />} ph="País" val={filtros.pais} set={v => setFiltros({ ...filtros, pais: v })} />
                                            <InputFiltro icon={<MapPin size={16} />} ph="Región" val={filtros.region} set={v => setFiltros({ ...filtros, region: v })} />
                                            <InputFiltro icon={<MapPin size={16} />} ph="Población" val={filtros.poblacion} set={v => setFiltros({ ...filtros, poblacion: v })} />
                                        </div>
                                    )}

                                <button onClick={buscar} style={BotonAccionStyle} disabled={buscando}>{buscando ? 'BUSCANDO...' : 'BUSCAR RECURSOS'}</button>

                                <div style={{ marginTop: '30px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '15px' }}>
                                    {resultados.map(r => (
                                        <div key={r.id} onClick={() => { setRecursoActivo(r); setFase('JUGANDO') }} style={{ background: 'rgba(255,255,255,0.95)', padding: '15px', borderRadius: '12px', cursor: 'pointer', borderLeft: `6px solid ${getColor(juegoElegido)}`, color: '#333', display: 'flex', justifyContent: 'space-between', alignItems: 'center', transition: 'transform 0.2s' }}>
                                            <div>
                                                <h3 style={{ margin: '0 0 5px 0', fontSize: '16px' }}>{r.titulo}</h3>
                                                <small style={{ color: '#666', display: 'block' }}>👨‍🏫 {r.profesorNombre}</small>
                                                <small style={{ color: '#888', fontSize: '11px' }}>📍 {r.poblacion || '-'} | {r.pais || '-'}</small>
                                            </div>
                                            <Play size={20} fill="#333" />
                                        </div>
                                    ))}
                                </div>
                            </>
                        )}
                </div>
            )}
        </div>
    );
}

// --- COMPONENTES AUXILIARES ---
const BotonJuego = ({ color, titulo, icon, onClick }) => (<div onClick={onClick} style={{ background: color, width: '140px', height: '140px', borderRadius: '20px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', cursor: 'pointer', boxShadow: '0 5px 15px rgba(0,0,0,0.3)', transition: 'transform 0.2s', color: 'white' }}><div style={{ fontSize: '40px', marginBottom: '5px' }}>{icon}</div><div style={{ fontWeight: 'bold', fontSize: '14px' }}>{titulo}</div></div>);
const InputFiltro = ({ icon, ph, val, set }) => (<div style={{ position: 'relative', width: '100%' }}><span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#888' }}>{icon}</span><input placeholder={ph} value={val} onChange={e => set(e.target.value)} style={{ ...InputEstilo, paddingLeft: '38px' }} /></div>);
const InputEstilo = { width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #ddd', background: 'white', color: '#333', fontWeight: '500', outline: 'none', boxSizing: 'border-box' };
const BotonAccionStyle = { width: '100%', padding: '15px', marginTop: '15px', borderRadius: '10px', border: 'none', background: '#2196F3', color: 'white', fontWeight: 'bold', cursor: 'pointer', fontSize: '1.1rem', boxShadow: '0 4px 0 #1976D2' };
const BotonTab = ({ activo, children, onClick }) => (<button onClick={onClick} style={{ padding: '10px 30px', background: activo ? '#f1c40f' : 'rgba(255,255,255,0.1)', border: 'none', color: activo ? '#333' : 'white', cursor: 'pointer', borderRadius: '20px', fontWeight: 'bold', transition: '0.2s' }}>{children}</button>);
const BtnNavStyle = { padding: '10px 20px', borderRadius: '25px', border: 'none', cursor: 'pointer', fontWeight: 'bold', fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '8px' };