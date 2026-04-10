import { useState, useEffect, useRef } from 'react';

export default function GameLauncher({ src, title = 'Juego', onMessage, onSalir }) {
    const containerRef = useRef(null);
    const isMobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
    const [launched, setLaunched] = useState(!isMobile);
    const fsListenerRef = useRef(null);

    // Limpiar listener al desmontar
    useEffect(() => {
        return () => {
            if (fsListenerRef.current) {
                document.removeEventListener('fullscreenchange', fsListenerRef.current);
                document.removeEventListener('webkitfullscreenchange', fsListenerRef.current);
            }
        };
    }, []);

    // Recibir mensajes de Unity
    useEffect(() => {
        if (!launched || !onMessage) return;
        const handler = (e) => { if (e.data?.type) onMessage(e.data); };
        window.addEventListener('message', handler);
        return () => window.removeEventListener('message', handler);
    }, [launched, onMessage]);

    const launch = async () => {
        setLaunched(true);

        // Intentar fullscreen — si falla, el juego sigue funcionando igual
        let fsEntrado = false;
        try {
            const el = containerRef.current || document.documentElement;
            if (el.requestFullscreen) {
                await el.requestFullscreen();
                fsEntrado = true;
            } else if (el.webkitRequestFullscreen) {
                el.webkitRequestFullscreen();
                fsEntrado = true;
            }
        } catch (e) {
            console.warn('Fullscreen no disponible:', e);
        }

        // Intentar girar pantalla (solo si fullscreen entró)
        if (fsEntrado) {
            try {
                if (screen.orientation?.lock) await screen.orientation.lock('landscape');
            } catch (_) { /* iOS no lo soporta, ignorar */ }

            // Solo escuchar salida de fullscreen si realmente entramos en él
            const onFsChange = () => {
                if (!document.fullscreenElement && !document.webkitFullscreenElement) {
                    document.removeEventListener('fullscreenchange', onFsChange);
                    document.removeEventListener('webkitfullscreenchange', onFsChange);
                    fsListenerRef.current = null;
                    screen.orientation?.unlock?.();
                    onSalir?.();
                }
            };
            fsListenerRef.current = onFsChange;
            document.addEventListener('fullscreenchange', onFsChange);
            document.addEventListener('webkitfullscreenchange', onFsChange);
        }
        // Si fullscreen no entró, el juego simplemente ocupa la pantalla fija
        // y el usuario puede volver con el botón del navegador
    };

    return (
        <div
            ref={containerRef}
            style={{ width:'100vw', height:'100dvh', position:'fixed', top:0, left:0, zIndex:9999, background:'#000', display:'flex', alignItems:'center', justifyContent:'center' }}
        >
            {!launched ? (
                <button onClick={launch} style={{
                    background:'linear-gradient(135deg,#FF6B00,#CC4400)', border:'none', borderRadius:20,
                    padding:'30px 60px', color:'white', fontSize:'1.6rem', fontWeight:900,
                    fontFamily:"'Segoe UI', sans-serif", cursor:'pointer',
                    boxShadow:'0 8px 32px rgba(255,107,0,0.5)',
                    display:'flex', flexDirection:'column', alignItems:'center', gap:12,
                }}>
                    <span style={{ fontSize:'3rem' }}>🏎️</span>
                    <span>{title}</span>
                    <span style={{ fontSize:'1rem', fontWeight:400, color:'rgba(255,255,255,0.8)' }}>
                        Toca para jugar
                    </span>
                </button>
            ) : (
                <iframe
                    key={src}
                    src={src}
                    title={title}
                    style={{ width:'100%', height:'100%', border:'none', display:'block' }}
                    allow="fullscreen; pointer-lock; autoplay"
                    allowFullScreen
                    sandbox="allow-scripts allow-same-origin allow-pointer-lock allow-fullscreen"
                />
            )}
        </div>
    );
}
