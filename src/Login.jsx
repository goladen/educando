import React, { useState } from 'react';
import { auth } from './firebase';
import { GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { Gamepad2, Menu, X } from 'lucide-react'; // Importamos Menu y X
import logoPikt from './assets/icono2.png';

import LandingGames from './components/LandingGames2';

export default function Login({ setGoogleToken }) {
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(false);
    const [menuOpen, setMenuOpen] = useState(false); // Estado para el menú

    const handleLogin = async () => {
        setLoading(true);
        setError(null);
        const provider = new GoogleAuthProvider();
        // AÑADIMOS EL SCOPE DE FORMS ADEMÁS DEL DE DRIVE
        provider.addScope('https://www.googleapis.com/auth/drive.file');
        provider.addScope('https://www.googleapis.com/auth/forms.body'); // <--- NUEVO IMPRESCINDIBLE
        try {
            const result = await signInWithPopup(auth, provider);
            const credential = GoogleAuthProvider.credentialFromResult(result);
            const token = credential.accessToken;
            if (setGoogleToken) setGoogleToken(token);
        } catch (error) {
            console.error("Error al entrar:", error);
            setError("Hubo un problema al conectar con Google.");
            setLoading(false);
        }
    };

    // Función para alternar el menú
    const toggleMenu = () => {
        setMenuOpen(!menuOpen);
    };

    // Manejador de clics en el menú (para cerrar y navegar si fuese necesario)
    const handleMenuClick = (opcion) => {
        console.log("Navegar a:", opcion);
        setMenuOpen(false);
        // Aquí podrías añadir lógica de navegación o scroll
        // Por ejemplo:
        if (opcion === 'unete') {
            document.getElementById('login-card')?.scrollIntoView({ behavior: 'smooth' });
        }
        else if (opcion === 'buscador' || opcion === 'populares') {
            // Scroll hacia la zona de juegos (si LandingGames tiene un id, sino puedes dejarlo vacío)
            // Asumiendo que LandingGames está abajo
            window.scrollTo({ top: window.innerHeight, behavior: 'smooth' });
        }
        else if (opcion === 'que-hacer') {
            // --- AQUÍ PONES TU URL DE AYUDA ---
            window.open('https://goladen.wixsite.com/matematicas/copia-de-pikt', '_blank');
        }
        else if (opcion === 'privacidad') {
            // --- AQUÍ PONES TU URL DE PRIVACIDAD ---
            window.open('https://goladen.wixsite.com/matematicas/copia-de-copia-de-pikt-web', '_blank');
        }





    };

    return (
        <div style={styles.container}>

            {/* --- BOTÓN MENÚ HAMBURGUESA --- */}
            <button onClick={toggleMenu} style={styles.menuButton}>
                <Menu size={32} color="white" />
            </button>

            {/* --- MENÚ DESPLEGABLE (OVERLAY) --- */}
            {menuOpen && (
                <div style={styles.menuOverlay} onClick={toggleMenu}>
                    <div style={styles.menuPanel} onClick={(e) => e.stopPropagation()}>
                        <div style={styles.menuHeader}>
                            <h2 style={styles.menuTitle}>Menú</h2>
                            <button onClick={toggleMenu} style={styles.closeButton}>
                                <X size={28} color="#2c3e50" />
                            </button>
                        </div>

                        <ul style={styles.menuList}>
                            <li style={styles.menuItem} onClick={() => handleMenuClick('unete')}>
                                 Únete a PiKT
                            </li>
                            <li style={styles.menuItem} onClick={() => handleMenuClick('buscador')}>
                                 Buscador de juegos
                            </li>
                            <li style={styles.menuItem} onClick={() => handleMenuClick('populares')}>
                                 Los juegos más populares
                            </li>
                            <li style={styles.menuItem} onClick={() => handleMenuClick('que-hacer')}>
                                 ¿Qué puedo hacer?
                            </li>
                            <li style={styles.menuItem} onClick={() => handleMenuClick('privacidad')}>
                                 Política de privacidad
                            </li>
                        </ul>

                        <div style={styles.menuFooter}>
                            PiKT © 2024
                        </div>
                    </div>
                </div>
            )}

            <div style={styles.scrollWrapper}>

                {/* --- 1. TU TARJETA DE LOGIN ORIGINAL --- */}
                <div style={styles.card} id="login-card">
                    <div style={styles.logoArea}>
                        <div style={styles.logoImageContainer}>
                            <img src={logoPikt} alt="PiKT Logo" style={styles.logoImage} />
                        </div>

                        <h1 style={styles.title}>PiKT</h1>
                    </div>

                    <p style={styles.slogan}>Juega, aprende y repite</p>
                    <div style={styles.divider}></div>
                    <p style={styles.welcomeText}>Bienvenido a tu plataforma de aprendizaje gamificado.</p>

                    {error && <div style={styles.error}>{error}</div>}

                    <button
                        onClick={handleLogin}
                        disabled={loading}
                        style={loading ? styles.buttonDisabled : styles.button}
                    >
                        <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="G" style={styles.googleIcon} />
                        {loading ? 'Conectando...' : 'Entrar con Google'}
                    </button>

                    <p style={styles.footer}>Gestión Docente & Gamificación</p>
                </div>

                {/* --- 2. SECCIÓN DE JUEGOS PÚBLICOS --- */}
                <LandingGames onLoginRequest={handleLogin} />

            </div>
        </div>
    );
}

const styles = {
    container: {
        minHeight: '100vh',
        width: '100%',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        fontFamily: "'Segoe UI', Roboto, sans-serif",
        display: 'flex',
        justifyContent: 'center',
        padding: '40px 20px',
        boxSizing: 'border-box',
        overflowY: 'auto',
        position: 'relative' // Necesario para posicionar el botón de menú
    },
    // --- ESTILOS DEL MENÚ ---
    menuButton: {
        position: 'absolute',
        top: '20px',
        left: '20px',
        background: 'rgba(255, 255, 255, 0.2)',
        border: 'none',
        borderRadius: '8px',
        padding: '8px',
        cursor: 'pointer',
        zIndex: 50,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backdropFilter: 'blur(5px)'
    },
    menuOverlay: {
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        zIndex: 100,
        display: 'flex',
        justifyContent: 'flex-start'
    },
    menuPanel: {
        width: '80%',
        maxWidth: '300px',
        height: '100%',
        backgroundColor: 'white',
        boxShadow: '2px 0 10px rgba(0,0,0,0.3)',
        display: 'flex',
        flexDirection: 'column',
        animation: 'slideIn 0.3s ease-out'
    },
    menuHeader: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '20px',
        borderBottom: '1px solid #eee'
    },
    menuTitle: {
        margin: 0,
        color: '#2c3e50',
        fontSize: '1.5rem',
        fontWeight: 'bold'
    },
    closeButton: {
        background: 'transparent',
        border: 'none',
        cursor: 'pointer',
        padding: '5px'
    },
    menuList: {
        listStyle: 'none',
        padding: '0',
        margin: '0',
        flex: 1,
        overflowY: 'auto'
    },
    menuItem: {
        padding: '20px',
        borderBottom: '1px solid #f0f0f0',
        color: '#34495e',
        fontSize: '1.1rem',
        fontWeight: '500',
        cursor: 'pointer',
        transition: 'background 0.2s'
    },
    menuFooter: {
        padding: '20px',
        textAlign: 'center',
        color: '#bdc3c7',
        fontSize: '0.8rem',
        borderTop: '1px solid #eee'
    },
    // --- FIN ESTILOS MENÚ ---

    scrollWrapper: {
        width: '100%',
        maxWidth: '600px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        zIndex: 10,
        marginTop: '20px' // Espacio extra para no chocar con el botón menú
    },
    card: {
        background: 'rgba(255, 255, 255, 0.95)',
        padding: '40px',
        borderRadius: '24px',
        boxShadow: '0 20px 50px rgba(0,0,0,0.2)',
        width: '100%',
        textAlign: 'center',
        backdropFilter: 'blur(10px)',
        marginBottom: '20px',
        boxSizing: 'border-box'
    },
    logoArea: { display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '10px' },

    logoImageContainer: {
        marginBottom: '15px',
        filter: 'drop-shadow(0 10px 20px rgba(0,0,0,0.2))'
    },
    logoImage: {
        width: '120px',
        height: '120px',
        borderRadius: '50%',
        objectFit: 'cover'
    },

    title: { margin: 0, color: '#2c3e50', fontSize: '2.5rem', fontWeight: '800', letterSpacing: '-1px', background: '-webkit-linear-gradient(45deg, #2c3e50, #3498db)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' },
    slogan: { margin: '5px 0 20px 0', color: '#7f8c8d', fontSize: '1.2rem', fontWeight: '500', fontStyle: 'italic', letterSpacing: '1px' },
    divider: { height: 2, background: '#f0f0f0', margin: '20px auto', width: '50%' },
    welcomeText: { color: '#555', marginBottom: '30px', fontSize: '0.95rem', lineHeight: '1.5' },
    button: { width: '100%', padding: '12px', borderRadius: '50px', border: '2px solid #e0e0e0', background: 'white', color: '#333', fontSize: '1rem', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', transition: 'all 0.3s ease', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' },
    buttonDisabled: { width: '100%', padding: '12px', borderRadius: '50px', border: '2px solid #f0f0f0', background: '#f9f9f9', color: '#999', cursor: 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' },
    googleIcon: { width: '24px', height: '24px' },
    error: { color: '#e74c3c', fontSize: '0.9rem', marginBottom: '15px', background: '#fadbd8', padding: '10px', borderRadius: '8px' },
    footer: { marginTop: '30px', fontSize: '0.8rem', color: '#bdc3c7' }
};

// Añadimos la animación de entrada para el menú
const styleSheet = document.createElement("style");
styleSheet.type = "text/css";
styleSheet.innerText = `
@keyframes slideIn {
  from { transform: translateX(-100%); }
  to { transform: translateX(0); }
}
`;
document.head.appendChild(styleSheet);