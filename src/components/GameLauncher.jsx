import { useState } from 'react';

export default function GameLauncher({ src, title = 'Juego', onMessage, onSalir }) {
    const isMobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
    const [launched, setLaunched] = useState(!isMobile);

    const launch = () => {
        setLaunched(true);
        // Intentar girar pantalla si el navegador lo permite (sin fullscreen API)
        try {
            if (screen.orientation?.lock) screen.orientation.lock('landscape').catch(() => {});
        } catch (_) {}
    };

    // Recibir mensajes de Unity
    const handleIframeLoad = () => {
        if (!onMessage) return;
        const handler = (e) => { if (e.data?.type) onMessage(e.data); };
        window.addEventListener('message', handler);
    };

    return (
        <div style={{ width: '100vw', height: '100dvh', position: 'fixed', top: 0, left: 0, zIndex: 9999, background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {!launched ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
                    <button
                        onClick={launch}
                        style={{
                            background: 'linear-gradient(135deg,#FF6B00,#CC4400)',
                            border: 'none', borderRadius: 20, padding: '30px 60px',
                            color: 'white', fontSize: '1.6rem', fontWeight: 900,
                            fontFamily: "'Segoe UI', sans-serif", cursor: 'pointer',
                            boxShadow: '0 8px 32px rgba(255,107,0,0.5)',
                            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
                        }}
                    >
                        <span style={{ fontSize: '3rem' }}>🏎️</span>
                        <span>{title}</span>
                        <span style={{ fontSize: '1rem', fontWeight: 400, color: 'rgba(255,255,255,0.8)' }}>
                            Toca para jugar
                        </span>
                    </button>
                    <button onClick={onSalir} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 10, padding: '10px 24px', color: 'white', fontSize: '0.9rem', cursor: 'pointer', fontFamily: "'Segoe UI', sans-serif" }}>
                        ← Volver
                    </button>
                </div>
            ) : (
                <div style={{ position: 'relative', width: '100%', height: '100%' }}>
                    <iframe
                        key={src}
                        src={src}
                        title={title}
                        onLoad={handleIframeLoad}
                        style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
                        allow="pointer-lock"
                        sandbox="allow-scripts allow-same-origin allow-pointer-lock"
                    />
                    <button
                        onClick={onSalir}
                        style={{ position: 'absolute', top: 10, right: 10, background: 'rgba(0,0,0,0.55)', border: '1px solid rgba(255,255,255,0.3)', borderRadius: 8, padding: '6px 14px', color: 'white', fontSize: '0.85rem', cursor: 'pointer', zIndex: 10000, fontFamily: "'Segoe UI', sans-serif" }}
                    >
                        ✕ Salir
                    </button>
                </div>
            )}
        </div>
    );
}
