import React, { useState, useEffect } from 'react';

export default function FullscreenBtn({ style = {} }) {
    const [full, setFull] = useState(false);

    useEffect(() => {
        const h = () => setFull(!!document.fullscreenElement);
        document.addEventListener('fullscreenchange', h);
        return () => document.removeEventListener('fullscreenchange', h);
    }, []);

    const toggle = () => {
        if (!document.fullscreenElement) document.documentElement.requestFullscreen?.();
        else document.exitFullscreen?.();
    };

    return (
        <button
            onClick={toggle}
            title={full ? 'Salir de pantalla completa' : 'Pantalla completa'}
            style={{
                background: 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(255,255,255,0.15)',
                color: 'white', borderRadius: 8,
                padding: '6px 10px', cursor: 'pointer',
                fontSize: '1.1rem', lineHeight: 1,
                ...style,
            }}
        >
            {full ? '⊡' : '⛶'}
        </button>
    );
}
