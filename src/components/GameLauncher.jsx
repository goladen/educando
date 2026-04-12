import { useEffect, useRef, useMemo } from 'react';

export default function GameLauncher({ src, title = 'Juego', onMessage, onSalir }) {
    const iframeRef  = useRef(null);
    const handlerRef = useRef(null);

    // Cache-bust: each mount gets a fresh URL so Unity never reuses corrupted IndexedDB state
    const bustSrc = useMemo(() => {
        const sep = src.includes('?') ? '&' : '?';
        return src + sep + '_t=' + Date.now();
    }, [src]);

    useEffect(() => {
        if (!onMessage) return;
        const handler = (e) => { if (e.data?.type) onMessage(e.data); };
        handlerRef.current = handler;
        window.addEventListener('message', handler);
        return () => {
            window.removeEventListener('message', handler);
            handlerRef.current = null;
            // Tell Unity inside the iframe to quit gracefully before unmount
            try { iframeRef.current?.contentWindow?.postMessage('UNITY_QUIT', '*'); } catch (_) {}
        };
    }, [onMessage]);

    return (
        <div style={{ width: '100vw', height: '100dvh', position: 'fixed', top: 0, left: 0, zIndex: 9999, background: '#000' }}>
            <div style={{ position: 'relative', width: '100%', height: '100%' }}>
                <iframe
                    ref={iframeRef}
                    key={bustSrc}
                    src={bustSrc}
                    title={title}
                    style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
                    allow="pointer-lock"
                />
                <button
                    onClick={onSalir}
                    style={{ position: 'absolute', top: 10, right: 10, background: 'rgba(0,0,0,0.55)', border: '1px solid rgba(255,255,255,0.3)', borderRadius: 8, padding: '6px 14px', color: 'white', fontSize: '0.85rem', cursor: 'pointer', zIndex: 10000, fontFamily: "'Segoe UI', sans-serif" }}
                >
                    ✕ Salir
                </button>
            </div>
        </div>
    );
}
