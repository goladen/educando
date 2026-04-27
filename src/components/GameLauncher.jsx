import { useEffect, useRef, useMemo, useState } from 'react';

const LOADING_KEYFRAMES = `
@keyframes glProgressShimmer {
  0%   { width: 8%; }
  40%  { width: 55%; }
  70%  { width: 75%; }
  100% { width: 82%; }
}
@keyframes glPulse {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0.6; }
}`;

function isMobile() {
    return /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

export default function GameLauncher({ src, title = 'Juego', onMessage, onSalir }) {
    const iframeRef  = useRef(null);
    const [saliendo, setSaliendo] = useState(false);
    const [mostrarCarga, setMostrarCarga] = useState(true);
    const [barraFin, setBarraFin] = useState(false);
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

    const handleIframeLoad = () => {
        setBarraFin(true);
        setTimeout(() => setMostrarCarga(false), 1200);
    };

    return (
        <div style={{ width: '100vw', height: '100dvh', position: 'fixed', top: 0, left: 0, zIndex: 9999, background: '#000' }}>
            <style>{LOADING_KEYFRAMES}</style>

            {/* Overlay de carga — visible mientras el HTML del juego se descarga */}
            {mostrarCarga && listo && (
                <div style={{
                    position: 'absolute', inset: 0, zIndex: 10002,
                    background: 'linear-gradient(135deg,#0d0d1f,#1a1a3a)',
                    display: 'flex', flexDirection: 'column', alignItems: 'center',
                    justifyContent: 'center', color: 'white',
                    fontFamily: "'Segoe UI', sans-serif",
                    transition: 'opacity 0.8s', opacity: barraFin ? 0 : 1,
                    pointerEvents: barraFin ? 'none' : 'auto',
                }}>
                    <div style={{ fontSize: '3.5rem', marginBottom: 14, animation: 'glPulse 2s infinite' }}>🎮</div>
                    <div style={{ fontSize: '1.3rem', fontWeight: 800, marginBottom: 6 }}>{title}</div>
                    <div style={{ fontSize: '0.9rem', color: 'rgba(255,255,255,0.6)', marginBottom: 32, textAlign: 'center', maxWidth: 300 }}>
                        Cargando juego Unity…
                    </div>

                    {/* Barra de progreso */}
                    <div style={{ width: 280, height: 8, background: 'rgba(255,255,255,0.1)', borderRadius: 99, overflow: 'hidden', marginBottom: 20 }}>
                        <div style={{
                            height: '100%', borderRadius: 99,
                            background: 'linear-gradient(90deg,#7B2FFF,#00C6FF)',
                            width: barraFin ? '100%' : undefined,
                            animation: barraFin ? 'none' : 'glProgressShimmer 18s ease-out forwards',
                            transition: barraFin ? 'width 0.6s ease' : 'none',
                        }} />
                    </div>

                    {/* Avisos */}
                    <div style={{ background: 'rgba(255,200,0,0.1)', border: '1px solid rgba(255,200,0,0.3)', borderRadius: 10, padding: '10px 18px', maxWidth: 300, textAlign: 'center' }}>
                        <div style={{ fontSize: '0.82rem', color: '#ffd700', fontWeight: 700, marginBottom: 4 }}>⏳ Carga lenta en móvil</div>
                        <div style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.65)', lineHeight: 1.5 }}>
                            El tiempo de carga puede ser de <b>1–2 minutos</b>.<br/>
                            Para mejor experiencia usa <b>ordenador</b>.
                        </div>
                    </div>
                </div>
            )}

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
                    <div style={{ fontSize: 15, color: 'rgba(255,255,255,0.65)', textAlign: 'center', maxWidth: 280, lineHeight: 1.5 }}>
                        Toca la pantalla para jugar a pantalla completa
                    </div>
                    <div style={{ fontSize: 13, color: 'rgba(255,200,0,0.85)', textAlign: 'center', maxWidth: 280, lineHeight: 1.6 }}>
                        ⏳ Carga lenta en móvil (1–2 min).<br/>Mejor experiencia en <b>ordenador</b>.
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
                        onLoad={handleIframeLoad}
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
