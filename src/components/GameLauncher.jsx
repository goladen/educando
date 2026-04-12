import { useEffect, useRef, useMemo, useState } from 'react';

export default function GameLauncher({ src, title = 'Juego', onMessage, onSalir }) {
    const iframeRef  = useRef(null);
    const [saliendo, setSaliendo] = useState(false);

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

        // 1. Tell Unity to Quit (releases WebGL context on the iframe side)
        try {
            iframeRef.current?.contentWindow?.postMessage('UNITY_QUIT', '*');
        } catch (_) {}

        // 2. Blank the iframe src immediately so the browser starts releasing GPU memory
        try {
            iframeRef.current.src = 'about:blank';
        } catch (_) {}

        // 3. Wait for WebGL context to be freed before unmounting
        setTimeout(() => {
            onSalir?.();
        }, 900);
    };

    return (
        <div style={{ width: '100vw', height: '100dvh', position: 'fixed', top: 0, left: 0, zIndex: 9999, background: '#000' }}>
            <div style={{ position: 'relative', width: '100%', height: '100%' }}>
                {!saliendo && (
                    <iframe
                        ref={iframeRef}
                        key={bustSrc}
                        src={bustSrc}
                        title={title}
                        style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
                        allow="pointer-lock"
                    />
                )}
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
            </div>
        </div>
    );
}
