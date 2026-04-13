import { useEffect, useRef, useMemo, useState } from 'react';

function isMobile() {
    return /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

export default function GameLauncher({ src, title = 'Juego', onMessage, onSalir }) {
    const iframeRef  = useRef(null);
    const [saliendo, setSaliendo] = useState(false);
    // En móvil mostramos primero el splash y pedimos fullscreen
    const [listo, setListo] = useState(!isMobile());

    // Cache-bust: each mount gets a fresh URL so Unity never reuses a stale WebGL context
    const bustSrc = useMemo(() => {
        const sep = src.includes('?') ? '&' : '?';
        return src + sep + '_t=' + Date.now();
    }, [src]);

    useEffect(() => {
        if (!onMessage) return;
        const handler = (e) => { if (e.data?.type) onMessage(e.data); };
        window.addEventListener('message', handler);
        return () => window.removeEventListener('message', handler);
    }, [onMessage]);

    const handleSalir = () => {
        if (saliendo) return;
        setSaliendo(true);

        if (document.fullscreenElement) {
            try { document.exitFullscreen(); } catch (_) {}
        }

        // Tell Unity to Quit (releases WebGL context on the iframe side)
        try {
            iframeRef.current?.contentWindow?.postMessage('UNITY_QUIT', '*');
        } catch (_) {}

        // Blank the iframe src immediately so the browser starts releasing GPU memory
        try {
            iframeRef.current.src = 'about:blank';
        } catch (_) {}

        // Wait for WebGL context to be freed before unmounting
        setTimeout(() => {
            onSalir?.();
        }, 900);
    };

    const entrarFullscreen = () => {
        const el = document.documentElement;
        if (el.requestFullscreen)             el.requestFullscreen();
        else if (el.webkitRequestFullscreen)  el.webkitRequestFullscreen();
        setListo(true);
    };

    return (
        <div style={{ width: '100vw', height: '100dvh', position: 'fixed', top: 0, left: 0, zIndex: 9999, background: '#000' }}>

            {/* Splash móvil — "toca para jugar a pantalla completa" */}
            {!listo && (
                <div
                    onClick={entrarFullscreen}
                    style={{
                        position: 'absolute', inset: 0, zIndex: 10001,
                        display: 'flex', flexDirection: 'column',
                        alignItems: 'center', justifyContent: 'center',
                        gap: 20, cursor: 'pointer', userSelect: 'none',
                        background: 'linear-gradient(135deg,#1a1a2e,#0f3460)',
                        color: 'white', fontFamily: "'Segoe UI', sans-serif",
                    }}
                >
                    <div style={{ fontSize: 64 }}>🏎️</div>
                    <div style={{ fontSize: 22, fontWeight: 800 }}>{title}</div>
                    <div style={{ fontSize: 15, color: 'rgba(255,255,255,0.65)', textAlign: 'center', maxWidth: 260, lineHeight: 1.5 }}>
                        Toca la pantalla para jugar<br/>a pantalla completa
                    </div>
                    <div style={{
                        marginTop: 8, padding: '13px 36px', borderRadius: 50,
                        background: 'linear-gradient(135deg,#FF6B00,#FFD700)',
                        color: '#1a1a2e', fontWeight: 900, fontSize: 16, letterSpacing: 1,
                    }}>
                        ▶ JUGAR
                    </div>
                </div>
            )}

            <div style={{ position: 'relative', width: '100%', height: '100%' }}>
                {/* El iframe se monta siempre para que Unity cargue en background,
                    pero solo es visible tras pulsar el splash */}
                {!saliendo && (
                    <iframe
                        ref={iframeRef}
                        key={bustSrc}
                        src={bustSrc}
                        title={title}
                        style={{ width: '100%', height: '100%', border: 'none', display: listo ? 'block' : 'none' }}
                        allow="pointer-lock *"
                    />
                )}
                {listo && (
                    <button
                        onClick={handleSalir}
                        disabled={saliendo}
                        style={{
                            position: 'absolute', top: 10, right: 10,
                            background: saliendo ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.55)',
                            border: '1px solid rgba(255,255,255,0.3)', borderRadius: 8,
                            padding: '6px 14px', color: 'white', fontSize: '0.85rem',
                            cursor: saliendo ? 'default' : 'pointer',
                            zIndex: 10000, fontFamily: "'Segoe UI', sans-serif"
                        }}
                    >
                        {saliendo ? '…' : '✕ Salir'}
                    </button>
                )}
            </div>
        </div>
    );
}
