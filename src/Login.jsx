import React, { useState } from 'react';
import { auth } from './firebase';
import { GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { Gamepad2, GraduationCap } from 'lucide-react';

export default function Login({ setGoogleToken }) {
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(false);

    const handleLogin = async () => {
        setLoading(true);
        setError(null);

        const provider = new GoogleAuthProvider();
        // IMPORTANTE: Mantenemos el permiso de Drive
        provider.addScope('https://www.googleapis.com/auth/drive.readonly');

        try {
            const result = await signInWithPopup(auth, provider);

            // Recuperamos el token para Drive y se lo pasamos a App.jsx
            const credential = GoogleAuthProvider.credentialFromResult(result);
            const token = credential.accessToken;
            if (setGoogleToken) setGoogleToken(token);

            // El observador en App.jsx detectará el login automáticamente
        } catch (error) {
            console.error("Error al entrar:", error);
            setError("Hubo un problema al conectar con Google.");
            setLoading(false);
        }
    };

    return (
        <div style={styles.container}>
            {/* Círculos decorativos de fondo */}
            <div style={styles.circle1}></div>
            <div style={styles.circle2}></div>

            <div style={styles.card}>
                <div style={styles.logoArea}>
                    <div style={styles.iconWrapper}>
                        <Gamepad2 size={40} color="white" />
                    </div>
                    <h1 style={styles.title}>LEARNJOY</h1>
                </div>

                <p style={styles.slogan}>Learn, enjoy and repeat</p>

                <div style={styles.divider}></div>

                <p style={styles.welcomeText}>
                    Bienvenido a tu plataforma de aprendizaje gamificado.
                </p>

                {error && <div style={styles.error}>{error}</div>}

                <button
                    onClick={handleLogin}
                    disabled={loading}
                    style={loading ? styles.buttonDisabled : styles.button}
                >
                    <img
                        src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg"
                        alt="Google"
                        style={styles.googleIcon}
                    />
                    {loading ? 'Conectando...' : 'Entrar con Google'}
                </button>

                <p style={styles.footer}>Gestión Docente & Gamificación</p>
            </div>
        </div>
    );
}

// --- ESTILOS VISUALES ---
const styles = {
    container: {
        minHeight: '100vh',
        width: '100%',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        fontFamily: "'Segoe UI', Roboto, sans-serif",
        position: 'relative',
        overflow: 'hidden'
    },
    circle1: {
        position: 'absolute',
        top: '-100px',
        left: '-100px',
        width: '300px',
        height: '300px',
        borderRadius: '50%',
        background: 'rgba(255, 255, 255, 0.1)',
        zIndex: 1
    },
    circle2: {
        position: 'absolute',
        bottom: '-50px',
        right: '-50px',
        width: '200px',
        height: '200px',
        borderRadius: '50%',
        background: 'rgba(255, 255, 255, 0.1)',
        zIndex: 1
    },
    card: {
        background: 'rgba(255, 255, 255, 0.95)',
        padding: '50px 40px',
        borderRadius: '24px',
        boxShadow: '0 20px 50px rgba(0,0,0,0.2)',
        maxWidth: '400px',
        width: '90%',
        textAlign: 'center',
        zIndex: 10,
        backdropFilter: 'blur(10px)'
    },
    logoArea: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        marginBottom: '10px'
    },
    iconWrapper: {
        background: 'linear-gradient(45deg, #FF9800, #F44336)',
        padding: '15px',
        borderRadius: '20px',
        marginBottom: '15px',
        boxShadow: '0 10px 20px rgba(244, 67, 54, 0.3)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center'
    },
    title: {
        margin: 0,
        color: '#2c3e50',
        fontSize: '2.5rem',
        fontWeight: '800',
        letterSpacing: '-1px',
        background: '-webkit-linear-gradient(45deg, #2c3e50, #3498db)',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent'
    },
    slogan: {
        margin: '5px 0 20px 0',
        color: '#7f8c8d',
        fontSize: '1.2rem',
        fontWeight: '500',
        fontStyle: 'italic',
        letterSpacing: '1px'
    },
    divider: {
        height: '2px',
        background: '#f0f0f0',
        margin: '20px auto',
        width: '50%'
    },
    welcomeText: {
        color: '#555',
        marginBottom: '30px',
        fontSize: '0.95rem',
        lineHeight: '1.5'
    },
    button: {
        width: '100%',
        padding: '12px',
        borderRadius: '50px',
        border: '2px solid #e0e0e0',
        background: 'white',
        color: '#333',
        fontSize: '1rem',
        fontWeight: 'bold',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '10px',
        transition: 'all 0.3s ease',
        boxShadow: '0 4px 6px rgba(0,0,0,0.05)'
    },
    buttonDisabled: {
        width: '100%',
        padding: '12px',
        borderRadius: '50px',
        border: '2px solid #f0f0f0',
        background: '#f9f9f9',
        color: '#999',
        cursor: 'not-allowed',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '10px'
    },
    googleIcon: {
        width: '24px',
        height: '24px'
    },
    error: {
        color: '#e74c3c',
        fontSize: '0.9rem',
        marginBottom: '15px',
        background: '#fadbd8',
        padding: '10px',
        borderRadius: '8px'
    },
    footer: {
        marginTop: '30px',
        fontSize: '0.8rem',
        color: '#bdc3c7'
    }
};