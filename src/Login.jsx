import React, { useState } from 'react';
import { auth } from './firebase';
import { GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { Gamepad2 } from 'lucide-react';
import logoPikt from './assets/icono2.png';

import LandingGames from './components/LandingGames2';

export default function Login({ setGoogleToken }) {
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(false);

    const handleLogin = async () => {
        setLoading(true);
        setError(null);
        const provider = new GoogleAuthProvider();
        provider.addScope('https://www.googleapis.com/auth/drive.readonly');

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

    return (
        <div style={styles.container}>
            <div style={styles.scrollWrapper}>

                {/* --- 1. TU TARJETA DE LOGIN ORIGINAL (MANTENIDA) --- */}
                <div style={styles.card} id="login-card">
                    <div style={styles.logoArea}>
                        {/* AQUÍ ESTÁ EL CAMBIO:
                           Quitamos el Gamepad2 y ponemos la imagen.
                           Quitamos también el 'iconWrapper' con fondo naranja/rojo 
                           para que el logo se vea limpio, o lo ajustamos.
                        */}
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

                {/* --- 2. NUEVA SECCIÓN DE JUEGOS PÚBLICOS (AÑADIDA) --- */}
                {/* Le pasamos handleLogin para que el botón "Unirse" de Live force el login si es necesario */}
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
        padding: '40px 20px', // Espacio para que no se pegue a los bordes
        boxSizing: 'border-box',
        overflowY: 'auto' // Permite scroll en toda la página
    },
    scrollWrapper: {
        width: '100%',
        maxWidth: '600px', // Un poco más ancho para que el buscador se vea bien
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        zIndex: 10
    },
    card: {
        background: 'rgba(255, 255, 255, 0.95)',
        padding: '40px',
        borderRadius: '24px',
        boxShadow: '0 20px 50px rgba(0,0,0,0.2)',
        width: '100%',
        textAlign: 'center',
        backdropFilter: 'blur(10px)',
        marginBottom: '20px', // Separación entre Login y Buscador
        boxSizing: 'border-box'
    },
    logoArea: { display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '10px' },

   

    // NUEVOS ESTILOS PARA LA IMAGEN
    logoImageContainer: {
        marginBottom: '15px',
        // Si quieres mantener el brillo/sombra detrás del logo redondo:
        filter: 'drop-shadow(0 10px 20px rgba(0,0,0,0.2))'
    },
    logoImage: {
        width: '120px', // Ajusta el tamaño aquí
        height: '120px',
        borderRadius: '50%', // Asegura que se vea redondo si la imagen es cuadrada
        objectFit: 'cover'
    },







    iconWrapper: { background: 'linear-gradient(45deg, #FF9800, #F44336)', padding: '15px', borderRadius: '20px', marginBottom: '15px', boxShadow: '0 10px 20px rgba(244, 67, 54, 0.3)', display: 'flex', justifyContent: 'center', alignItems: 'center' },
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