import React, { useState, useEffect } from 'react';
import { db, auth } from './firebase';
import { collection, query, where, getDocs, orderBy, getCountFromServer, doc, getDoc } from 'firebase/firestore';
import { Menu, X, UserCircle, Trophy, LogOut } from 'lucide-react';
import UserProfile from './components/UserProfile';

// --- IMPORTAMOS LANDING GAMES 4 Y SUS COMPONENTES ---
import LandingGames4, { APPS, SpecificGamePage, ResourceCard } from './components/LandingGames4';
import MathWordleGame from './MathWordleGame';
import TextWordleGame from './TextWordleGame';
import SopaDeLetrasGame from './SopaDeLetrasGame';

const getColor = (t) => {
    if (!t) return '#999';
    const tipo = t.toUpperCase();
    if (tipo === 'PASAPALABRA') return '#3F51B5';
    if (tipo === 'THINKHOOT') return '#9C27B0';
    if (tipo === 'APAREJADOS') return '#FF9800';
    if (tipo === 'CAZABURBUJAS') return '#E91E63';
    if (tipo === 'RULETA') return '#f1c40f';
    if (tipo === 'QUESTION_SENDER') return '#2c3e50';
    return '#E91E63';
};

const getNombreJuego = (tipo) => {
    if (!tipo) return 'Juego';
    const t = tipo.toUpperCase();
    if (t === 'PASAPALABRA') return 'Pasapalabra';
    if (t === 'CAZABURBUJAS') return 'CazaBurbujas';
    if (t === 'APAREJADOS') return 'Aparejados';
    if (t === 'THINKHOOT') return 'PiLive';
    if (t === 'RULETA') return 'La Ruleta';
    if (t === 'QUESTION_SENDER') return 'Question Sender';
    return t;
};

export default function StudentDashboard2({ usuario }) {
    const [menuOpen, setMenuOpen] = useState(false);

    // VISTAS: 'MAIN', 'RECORDS', 'POPULARES', o el ID del juego
    const [vistaActual, setVistaActual] = useState('MAIN');
    const [topGames, setTopGames] = useState([]);

    // Estados para Perfil y Récords
    const [mostrandoPerfil, setMostrandoPerfil] = useState(false);
    const [perfilAlumno, setPerfilAlumno] = useState(null);
    const [misRecords, setMisRecords] = useState([]);
    const [cargandoRecords, setCargandoRecords] = useState(false);

    // Cargar perfil
    useEffect(() => {
        if (usuario) cargarPerfilAlumno();
    }, [usuario]);

    const cargarPerfilAlumno = async () => {
        if (!usuario) return;
        try {
            const d = await getDoc(doc(db, "users", usuario.uid));
            if (d.exists()) setPerfilAlumno(d.data());
        } catch (e) { console.error(e); }
    };

    const cargarMisRecords = async () => {
        if (!usuario || !usuario.email) return;
        setCargandoRecords(true);
        try {
            const q = query(collection(db, "ranking"), where("email", "==", usuario.email), orderBy("fecha", "desc"));
            const snapshot = await getDocs(q);
            if (snapshot.empty) { setMisRecords([]); } else {
                const recordsCalculados = await Promise.all(snapshot.docs.map(async (docSnapshot) => {
                    const data = docSnapshot.data();
                    const misPuntos = data.aciertos !== undefined ? data.aciertos : data.puntuacion;
                    const juegoId = data.recursoId;
                    const categoria = data.categoria;
                    const tipoJuego = data.tipoJuego || data.juego;

                    if (!juegoId) return { id: docSnapshot.id, ...data, medallaCalculada: '-', posicion: '-' };

                    const qMejores = query(collection(db, "ranking"), where("recursoId", "==", juegoId), where("categoria", "==", categoria), where("tipoJuego", "==", tipoJuego), where("aciertos", ">", misPuntos));
                    const snapshotMejores = await getCountFromServer(qMejores);
                    const ranking = snapshotMejores.data().count + 1;
                    let medallaReal = '❌';
                    if (ranking === 1) medallaReal = '🥇';
                    if (ranking === 2) medallaReal = '🥈';
                    if (ranking === 3) medallaReal = '🥉';
                    return { id: docSnapshot.id, ...data, medallaCalculada: medallaReal, posicion: ranking };
                }));
                setMisRecords(recordsCalculados);
            }
        } catch (error) { console.error("Error records:", error); }
        setCargandoRecords(false);
    };

    const cargarPopulares = async () => {
        try {
            const q = query(collection(db, 'resources'), orderBy('playCount', 'desc'), limit(15));
            const snap = await getDocs(q);
            setTopGames(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        } catch (e) { console.error(e); }
    };

    // Navegación emulada
    const handleMenuClick = (opcion) => {
        setMenuOpen(false);
        if (opcion === 'inicio') setVistaActual('MAIN');
        else if (opcion === 'populares') { setVistaActual('POPULARES'); cargarPopulares(); }
        else if (opcion === 'records') { setVistaActual('RECORDS'); cargarMisRecords(); }
        else if (opcion === 'perfil') setMostrandoPerfil(true);
        else if (opcion === 'logout') auth.signOut();
        else if (opcion === 'que-hacer') window.open('https://goladen.wixsite.com/matematicas/copia-de-copia-de-pikt-web', '_blank');
        else if (opcion === 'privacidad') window.open('https://www.pikt.es/politica.html', '_blank');
    };

    // Interceptar la URL para abrir los juegos desde las tarjetas
    useEffect(() => {
        const handleRoute = () => {
            const path = window.location.pathname.toLowerCase().replace('/', '');
            if (!path || path === 'inicio') setVistaActual('MAIN');
            else {
                const app = APPS.find(a => a.name.toLowerCase() === path || a.id.toLowerCase() === path);
                if (app) setVistaActual(app.id);
            }
        };

        handleRoute();
        window.addEventListener('popstate', handleRoute);
        return () => window.removeEventListener('popstate', handleRoute);
    }, []);

    // --- RENDERIZADO CONDICIONAL DE VISTAS A PANTALLA COMPLETA ---

    // Juegos Directos
    if (vistaActual === 'WORDLE') return <TextWordleGame usuario={usuario} onExit={() => handleMenuClick('inicio')} />;
    if (vistaActual === 'MATHLE') return <MathWordleGame usuario={usuario} onExit={() => handleMenuClick('inicio')} />;
    if (vistaActual === 'SOPA') return <SopaDeLetrasGame usuario={usuario} onExit={() => handleMenuClick('inicio')} />;

    const appData = APPS.find(a => a.id === vistaActual);
    if (appData) {
        return <SpecificGamePage appData={appData} onHome={() => handleMenuClick('inicio')} usuario={usuario} />;
    }

    return (
        <div style={styles.container}>
            {/* CABECERA ALUMNO */}
            <header style={styles.header}>
                <button onClick={() => setMenuOpen(true)} style={styles.menuButton}>
                    <Menu size={28} color="white" />
                </button>

                <div style={styles.studentControls}>
                    <button onClick={() => { setVistaActual('RECORDS'); cargarMisRecords(); }} style={{ ...styles.controlBtn, background: vistaActual === 'RECORDS' ? '#f1c40f' : 'white', color: vistaActual === 'RECORDS' ? 'black' : '#333' }}>
                        <Trophy size={18} /> <span className="hide-mobile">Mis Récords</span>
                    </button>

                    <button onClick={() => setMostrandoPerfil(true)} style={styles.controlBtn}>
                        <UserCircle size={18} /> <span className="hide-mobile">Mi Perfil</span>
                    </button>

                 
                </div>
            </header>

            {/* MENÚ LATERAL */}
            {menuOpen && (
                <div style={styles.menuOverlay} onClick={() => setMenuOpen(false)}>
                    <div style={styles.menuPanel} onClick={(e) => e.stopPropagation()}>
                        <div style={styles.menuHeader}>
                            <h2 style={{ margin: 0, color: '#333' }}>Menú Alumno</h2>
                            <button onClick={() => setMenuOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={28} /></button>
                        </div>
                        <ul style={styles.menuList}>
                            <li style={styles.menuItem} onClick={() => handleMenuClick('inicio')}>🎮 Inicio</li>
                            <li style={styles.menuItem} onClick={() => handleMenuClick('populares')}>🔥 Los juegos más populares</li>
                            <li style={styles.menuItem} onClick={() => handleMenuClick('records')}>🏆 Mis Récords</li>
                            <li style={styles.menuItem} onClick={() => handleMenuClick('perfil')}>👤 Mi Perfil</li>
                            <li style={{ ...styles.menuItem, color: '#e74c3c', borderTop: '1px solid #eee' }} onClick={() => handleMenuClick('logout')}>
                                <LogOut size={18} style={{ marginRight: '10px' }} /> Cerrar Sesión
                            </li>
                        </ul>
                    </div>
                </div>
            )}

            {/* CONTENIDO PRINCIPAL */}
            {vistaActual === 'MAIN' && (
                <div style={{ width: '80%', maxWidth: '1000px', margin: '80px auto 0 auto', padding: '0 20px', zIndex: 10 }}>
                    <div style={{ textAlign: 'center', color: 'white', marginBottom: '20px', textShadow: '0 2px 4px rgba(0,0,0,0.3)' }}>
                        <h1 style={{ fontSize: '3rem', margin: 0 }}>PiKT</h1>
                        <p style={{ fontSize: '1.2rem', fontStyle: 'italic', opacity: 0.9 }}>Hola, {usuario.displayName?.split(' ')[0] || 'Alumno'}</p>
                    </div>

                    {/* USAMOS EL LANDINGGAMES4 Y PASAMOS USUARIO */}
                    <LandingGames4 usuario={usuario} />
                </div>
            )}

            {/* VISTA DE POPULARES */}
            {vistaActual === 'POPULARES' && (
                <div style={{ width: '90%', maxWidth: '1000px', margin: '80px auto 0 auto', zIndex: 10 }}>
                    <div style={{ background: 'rgba(255,255,255,0.95)', padding: '30px', borderRadius: '20px' }}>
                        <h2 style={{ textAlign: 'center', color: '#2c3e50', marginBottom: '30px' }}>🔥 Los Juegos Más Populares</h2>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px' }}>
                            {topGames.map(r => <ResourceCard key={r.id} r={r} onClick={() => console.log("Abriendo populares")} />)}
                        </div>
                    </div>
                </div>
            )}

            {/* VISTA DE RÉCORDS */}
            {vistaActual === 'RECORDS' && (
                <div style={{ width: '90%', maxWidth: '1000px', margin: '80px auto 0 auto', zIndex: 10 }}>
                    <div style={styles.recordsCard}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                            <h2 style={{ color: '#2c3e50', margin: 0 }}>🏆 Historial de Partidas</h2>
                            <button onClick={() => setVistaActual('MAIN')} style={styles.backBtn}>Volver a Juegos</button>
                        </div>

                        {cargandoRecords ? <p style={{ textAlign: 'center', color: '#666' }}>Cargando puntuaciones...</p> : (
                            <div style={{ maxHeight: '60vh', overflowY: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', color: '#333' }}>
                                    <thead style={{ background: '#f8f9fa', position: 'sticky', top: 0 }}>
                                        <tr style={{ borderBottom: '2px solid #ddd', textAlign: 'left' }}>
                                            <th style={{ padding: '12px' }}>Juego</th>
                                            <th style={{ padding: '12px' }}>Recurso</th>
                                            <th style={{ padding: '12px' }}>Puntos</th>
                                            <th style={{ padding: '12px', textAlign: 'center' }}>Rank</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {misRecords.map((r, i) => (
                                            <tr key={i} style={{ borderBottom: '1px solid #eee' }}>
                                                <td style={{ padding: '12px', fontWeight: 'bold', color: getColor(r.tipoJuego || r.juego) }}>
                                                    {getNombreJuego(r.tipoJuego || r.juego)}
                                                </td>
                                                <td style={{ padding: '12px' }}>{r.recursoTitulo || "Sin Título"}</td>
                                                <td style={{ padding: '12px', color: '#e67e22', fontWeight: 'bold' }}>
                                                    {r.aciertos !== undefined ? r.aciertos : r.puntuacion}
                                                </td>
                                                <td style={{ padding: '12px', fontSize: '1.2rem', textAlign: 'center' }}>
                                                    {r.medallaCalculada}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                {misRecords.length === 0 && (
                                    <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
                                        <p>Aún no has jugado ninguna partida registrada.</p>
                                        <button onClick={() => setVistaActual('MAIN')} style={{ color: '#3F51B5', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>¡Empieza ahora!</button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* MODAL DE PERFIL */}
            {mostrandoPerfil && (
                <UserProfile
                    usuario={usuario}
                    perfil={perfilAlumno}
                    onClose={() => setMostrandoPerfil(false)}
                    onUpdate={() => cargarPerfilAlumno()}
                    showSupport={false}
                />
            )}

            <style>{`.hide-mobile { display: inline; } @media (max-width: 600px) { .hide-mobile { display: none; } }`}</style>
        </div>
    );
}

// ESTILOS DE LOGIN/STUDENT
const styles = {
    container: { minHeight: '100vh', width: '100%', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', fontFamily: "'Segoe UI', Roboto, sans-serif", overflowY: 'auto', position: 'relative' },
    header: { position: 'fixed', top: 0, left: 0, width: '100%', padding: '15px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 50, boxSizing: 'border-box' },
    menuButton: { background: 'rgba(255, 255, 255, 0.2)', border: 'none', borderRadius: '8px', padding: '8px', cursor: 'pointer', backdropFilter: 'blur(5px)' },
    studentControls: { background: 'rgba(255, 255, 255, 0.2)', padding: '5px', borderRadius: '30px', display: 'flex', alignItems: 'center', gap: '10px', backdropFilter: 'blur(5px)' },
    controlBtn: { background: 'white', border: 'none', borderRadius: '20px', padding: '8px 15px', fontSize: '0.9rem', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', color: '#333', boxShadow: '0 2px 5px rgba(0,0,0,0.1)' },
    menuOverlay: { position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(0, 0, 0, 0.5)', zIndex: 100 },
    menuPanel: { width: '80%', maxWidth: '300px', height: '100%', backgroundColor: 'white', display: 'flex', flexDirection: 'column' },
    menuHeader: { display: 'flex', justifyContent: 'space-between', padding: '20px', borderBottom: '1px solid #eee' },
    menuList: { listStyle: 'none', padding: 0, margin: 0 },
    menuItem: { padding: '20px', borderBottom: '1px solid #eee', cursor: 'pointer', fontSize: '1.1rem', color: '#333', display: 'flex', alignItems: 'center' },
    recordsCard: { background: 'rgba(255,255,255,0.95)', padding: '30px', borderRadius: '20px', boxShadow: '0 10px 30px rgba(0,0,0,0.2)', minHeight: '60vh' },
    backBtn: { background: '#eee', border: 'none', padding: '8px 15px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }
};