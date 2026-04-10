import { useState, useRef } from 'react';
import { requestGameFullscreen } from '../hooks/useGameFullscreen';

export default function GameLauncher({ src, title = 'Juego', onMessage, onSalir }) {
    const containerRef = useRef(null);
    const isMobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
    const [launched, setLaunched] = useState(!isMobile); // escritorio lanza directo

    const launch = async () => {
        await requestGameFullscreen(containerRef.current);
        setLaunched(true);

        // Al salir de fullscreen volver a la app
        // Esperamos un poco para evitar que el evento de orientación dispare el listener
        setTimeout(() => {
            const onFsChange = () => {
                if (!document.fullscreenElement && !document.webkitFullscreenElement) {
                    document.removeEventListener('fullscreenchange', onFsChange);
                    document.removeEventListener('webkitfullscreenchange', onFsChange);
                    onSalir?.();
                }
            };
            document.addEventListener('fullscreenchange', onFsChange);
            document.addEventListener('webkitfullscreenchange', onFsChange);
        }, 800);
    };

    // Recibir mensajes de Unity
    const handleIframeLoad = () => {
        if (!onMessage) return;
        const handler = (e) => { if (e.data?.type) onMessage(e.data); };
        window.addEventListener('message', handler);
    };

    return (
        <div
            ref={containerRef}
            style={{ width: '100vw', height: '100dvh', position: 'fixed', top: 0, left: 0, zIndex: 9999, background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
            {!launched ? (
                <button
                    onClick={launch}
                    style={{
                        background: 'linear-gradient(135deg,#FF6B00,#CC4400)',
                        border: 'none',
                        borderRadius: 20,
                        padding: '30px 60px',
                        color: 'white',
                        fontSize: '1.6rem',
                        fontWeight: 900,
                        fontFamily: "'Segoe UI', sans-serif",
                        cursor: 'pointer',
                        boxShadow: '0 8px 32px rgba(255,107,0,0.5)',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: 12,
                    }}
                >
                    <span style={{ fontSize: '3rem' }}>🏎️</span>
                    <span>{title}</span>
                    <span style={{ fontSize: '1rem', fontWeight: 400, color: 'rgba(255,255,255,0.8)' }}>
                        Toca para jugar a pantalla completa
                    </span>
                </button>
            ) : (
                <iframe
                    key={src}
                    src={src}
                    title={title}
                    onLoad={handleIframeLoad}
                    style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
                    allow="fullscreen; pointer-lock"
                    sandbox="allow-scripts allow-same-origin allow-pointer-lock"
                />
            )}
        </div>
    );
}
