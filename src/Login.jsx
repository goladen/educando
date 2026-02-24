//import LandingGames from './components/LandingGames3';
import MathWordleGame from './MathWordleGame';
import TextWordleGame from './TextWordleGame'; // <--- IMPORTA TU NUEVO COMPONENTE
import React, { useState, useEffect } from 'react';
import { auth } from './firebase';
import { GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { Menu, X } from 'lucide-react';
import logoPikt from './assets/icono2.png';
import LandingGames, { APPS, SpecificGamePage, ResourceCard } from './components/LandingGames3';
import { collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from './firebase';
import SopaDeLetrasGame from './SopaDeLetrasGame';

export default function Login({ setGoogleToken }) {
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(false);
    const [menuOpen, setMenuOpen] = useState(false);

    // VISTAS: 'MAIN', 'POPULARES', o el ID del juego (ej: 'PASAPALABRA', 'WORDLE', etc.)
    const [vistaActual, setVistaActual] = useState('MAIN');
    const [topGames, setTopGames] = useState([]);

    // --- DETECTOR DE RUTAS (ESTO HACE QUE SE ABRA LA PANTALLA COMPLETA) ---
    useEffect(() => {
        const handleRoute = () => {
            const path = window.location.pathname.toLowerCase().replace('/', '');

            if (!path || path === 'inicio') {
                setVistaActual('MAIN');
            } else if (path === 'populares') {
                setVistaActual('POPULARES');
                cargarPopulares();
            } else {
                // Buscamos si la ruta coincide con algún juego
                const app = APPS.find(a => a.name.toLowerCase() === path || a.id.toLowerCase() === path);
                if (app) setVistaActual(app.id);
                else setVistaActual('MAIN');
            }
        };

        handleRoute();
        window.addEventListener('popstate', handleRoute);
        return () => window.removeEventListener('popstate', handleRoute);
    }, []);

    const cargarPopulares = async () => {
        try {
            const q = query(collection(db, 'resources'), orderBy('playCount', 'desc'), limit(15));
            const snap = await getDocs(q);
            setTopGames(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        } catch (e) { console.error(e); }
    };

    const handleLogin = async () => {
        setLoading(true); setError(null);
        const provider = new GoogleAuthProvider();
        provider.addScope('https://www.googleapis.com/auth/drive.readonly');
        provider.addScope('https://www.googleapis.com/auth/drive.file');
        provider.addScope('https://www.googleapis.com/auth/forms.body');

        try {
            const result = await signInWithPopup(auth, provider);
            const credential = GoogleAuthProvider.credentialFromResult(result);
            if (setGoogleToken) setGoogleToken(credential.accessToken);
        } catch (error) {
            setError("Error conectando con Google.");
            setLoading(false);
        }
    };

    const handleMenuClick = (opcion) => {
        setMenuOpen(false);
        if (opcion === 'inicio') {
            window.history.pushState({}, '', '/');
            window.dispatchEvent(new Event('popstate'));
        }
        else if (opcion === 'populares') {
            window.history.pushState({}, '', '/populares');
            window.dispatchEvent(new Event('popstate'));
        }
        else if (opcion === 'que-hacer') window.open('https://goladen.wixsite.com/matematicas/copia-de-pikt', '_blank');
        else if (opcion === 'privacidad') window.open('https://www.pikt.es/politica.html', '_blank');
    };

    // --- RENDERIZADO CONDICIONAL DE VISTAS ---

    // 1. VISTA DE LOS MÁS POPULARES
    if (vistaActual === 'POPULARES') {
        return (
            <div style={styles.container}>
                <button onClick={() => handleMenuClick('inicio')} style={styles.homeBtnAbsolute}>Volver al Inicio</button>
                <div style={{ background: 'rgba(255,255,255,0.95)', padding: '30px', borderRadius: '20px', width: '90%', maxWidth: '1000px', margin: '60px auto' }}>
                    <h2 style={{ textAlign: 'center', color: '#2c3e50', marginBottom: '30px' }}>🔥 Los Juegos Más Populares</h2>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px' }}>
                        {topGames.map(r => <ResourceCard key={r.id} r={r} onClick={() => console.log("Abriendo desde populares")} />)}
                    </div>
                </div>
            </div>
        );
    }

    // 2. VISTA ESPECÍFICA DE UN JUEGO (A pantalla completa)
    // 2. JUEGOS DIRECTOS (WordLe y MathLe abren su propia interfaz original)
    if (vistaActual === 'WORDLE') {
        return <TextWordleGame usuario={null} onExit={() => handleMenuClick('inicio')} />;
    }
    if (vistaActual === 'MATHLE') {
        return <MathWordleGame usuario={null} onExit={() => handleMenuClick('inicio')} />;
    }


    const appData = APPS.find(a => a.id === vistaActual);
    if (appData) {
        return <SpecificGamePage appData={appData} onHome={() => handleMenuClick('inicio')} />;
    }

    // 3. VISTA PRINCIPAL (Landing normal + Login Arriba a la derecha)
    return (
        <div style={styles.container}>
            {/* CABECERA */}
            <header style={styles.header}>
                <button onClick={() => setMenuOpen(true)} style={styles.menuButton}><Menu size={28} color="white" /></button>

                {/* LOGIN PEQUEÑO SUPERIOR DERECHO */}
                <div style={styles.smallLoginBox}>
                    <img src={logoPikt} alt="Logo" style={{ width: '30px', height: '30px', borderRadius: '50%' }} />
                    <button onClick={handleLogin} disabled={loading} style={styles.smallLoginBtn}>
                        <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="G" style={{ width: '16px' }} />
                        {loading ? '...' : 'Entrar'}
                    </button>
                    {error && <span style={{ color: 'red', fontSize: '10px' }}>{error}</span>}
                </div>
            </header>


           



            {/* MENÚ LATERAL */}
            {menuOpen && (
                <div style={styles.menuOverlay} onClick={() => setMenuOpen(false)}>
                    <div style={styles.menuPanel} onClick={(e) => e.stopPropagation()}>
                        <div style={styles.menuHeader}>
                            <h2 style={{ margin: 0 }}>Menú</h2>
                            <button onClick={() => setMenuOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={28} /></button>
                        </div>
                        <ul style={styles.menuList}>
                            <li style={styles.menuItem} onClick={() => handleMenuClick('inicio')}>🏠 Inicio</li>
                            <li style={styles.menuItem} onClick={() => handleMenuClick('populares')}>🔥 Los juegos más populares</li>
                            <li style={styles.menuItem} onClick={() => handleMenuClick('que-hacer')}>❓ ¿Qué puedo hacer?</li>
                            <li style={styles.menuItem} onClick={() => handleMenuClick('privacidad')}>🔒 Política de privacidad</li>
                        </ul>
                    </div>
                </div>
            )}

            {/* CONTENIDO PRINCIPAL */}
            <div style={{ width: '80%', maxWidth: '1000px', margin: '80px auto 0 auto', padding: '0 20px', zIndex: 10 }}>
                <div style={{ textAlign: 'center', color: 'white', marginBottom: '20px', textShadow: '0 2px 4px rgba(0,0,0,0.3)' }}>
                    <h1 style={{ fontSize: '3rem', margin: 0 }}>PiKT</h1>
                    <p style={{ fontSize: '1.2rem', fontStyle: 'italic', opacity: 0.9 }}>Juega, aprende y repite</p>
                </div>

                {/* AQUÍ CARGA EL COMPONENTE QUE HAS ACTUALIZADO ARRIBA */}
                <LandingGames />
            </div>
        </div>
    );
}

const styles = {
    container: { minHeight: '100vh', width: '100%', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', fontFamily: "'Segoe UI', Roboto, sans-serif", overflowY: 'auto', position: 'relative' },

    // Header y Menu
    header: { position: 'fixed', top: 0, left: 0, width: '100%', padding: '15px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 50, boxSizing: 'border-box' },
    menuButton: { background: 'rgba(255, 255, 255, 0.2)', border: 'none', borderRadius: '8px', padding: '8px', cursor: 'pointer', backdropFilter: 'blur(5px)' },

    // Login Mini Top Right
    smallLoginBox: { background: 'rgba(255, 255, 255, 0.9)', padding: '5px 15px', borderRadius: '30px', display: 'flex', alignItems: 'center', gap: '10px', boxShadow: '0 4px 10px rgba(0,0,0,0.2)' },
    smallLoginBtn: { background: 'white', border: '1px solid #ccc', borderRadius: '20px', padding: '6px 12px', fontSize: '0.9rem', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' },

    // Panel Menú Lateral
    menuOverlay: { position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(0, 0, 0, 0.5)', zIndex: 100 },
    menuPanel: { width: '80%', maxWidth: '300px', height: '100%', backgroundColor: 'white', display: 'flex', flexDirection: 'column' },
    menuHeader: { display: 'flex', justifyContent: 'space-between', padding: '20px', borderBottom: '1px solid #eee' },
    menuList: { listStyle: 'none', padding: 0, margin: 0 },
    menuItem: { padding: '20px', borderBottom: '1px solid #eee', cursor: 'pointer', fontSize: '1.1rem', color: '#333' },

    homeBtnAbsolute: { position: 'absolute', top: '20px', left: '20px', background: 'rgba(255,255,255,0.9)', border: 'none', padding: '10px 15px', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer' }
};