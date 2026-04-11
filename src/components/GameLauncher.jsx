
export default function GameLauncher({ src, title = 'Juego', onMessage, onSalir }) {
    const handleIframeLoad = () => {
        if (!onMessage) return;
        const handler = (e) => { if (e.data?.type) onMessage(e.data); };
        window.addEventListener('message', handler);
    };

    return (
        <div style={{ width: '100vw', height: '100dvh', position: 'fixed', top: 0, left: 0, zIndex: 9999, background: '#000' }}>
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
        </div>
    );
}
